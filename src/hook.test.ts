/**
 * The hook end to end, in a temporary home: hold, retry, approve (message or terminal), release
 * once, duplicate, refuse, kill switch, watch mode, and the parallel-hooks case.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readLog, verifyLog } from "./audit.js";
import type { Client } from "./classify.js";
import {
  appendTranscript,
  assistantEntry,
  claudeInput,
  humanEntry,
  MERIDIAN_JOURNAL_ENTRY,
  QBO_CREATE_INVOICE,
} from "./fixtures.js";
import { decideHold, runHook, type HookAnswer } from "./hook.js";
import { writeRules, DEFAULT_RULES } from "./rules.js";
import { tempHome, type TempHome } from "./testing.js";

let t: TempHome;
afterEach(() => t?.cleanup());

let seq = 0;
async function call(
  tool: string,
  args: unknown,
  o: { client?: Client; id?: string; advance?: number } = {},
): Promise<HookAnswer> {
  t.clock.now += (o.advance ?? 1) * 60_000;
  const input = claudeInput(tool, args, {
    cwd: t.project,
    transcript: t.transcript,
    id: o.id ?? `toolu_${++seq}`,
  });
  return runHook(o.client ?? "claude", JSON.stringify(input), t.ctx);
}

const json = (a: HookAnswer) => JSON.parse(a.stdout) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function person(text: string, asked?: string) {
  if (asked) {
    t.clock.now += 10_000;
    appendTranscript(t.transcript, assistantEntry(asked, t.clock.now));
  }
  t.clock.now += 20_000;
  appendTranscript(t.transcript, humanEntry(text, t.clock.now));
}

describe("a QuickBooks write", () => {
  it("is held with its diff until the person approves in their own message, then released once", async () => {
    t = tempHome();
    person("Bill Acme for October, invoice 1042");
    const held = await call("mcp__quickbooks__create_invoice", QBO_CREATE_INVOICE);
    expect(held.decision).toBe("deny");
    const out = json(held);
    expect(out.hookSpecificOutput.permissionDecision).toBe("deny");
    const body = JSON.parse(out.hookSpecificOutput.permissionDecisionReason);
    expect(body.code).toBe("APPROVAL_REQUIRED");
    expect(body.retryable).toBe(true);
    expect(body.details.diff).toContain("= total 1,250.00 across 2 lines");
    expect(body.fix).toMatch(/ask, in your reply, whether to post it/);
    expect(out.systemMessage).toMatch(/^booksguard held create invoice 1,250.00/);
    const id = held.hold!.id;

    // the agent retries before anyone answers: the same hold, not a new one
    const again = await call("mcp__quickbooks__create_invoice", QBO_CREATE_INVOICE);
    expect(again.decision).toBe("deny");
    expect(again.hold!.id).toBe(id);
    expect(again.body!.cause).toMatch(
      /Not yet approved: the person's latest message .* came before the hold/,
    );

    person("yes, post it", "booksguard is holding invoice 1042. Shall I post it?");
    const released = await call("mcp__quickbooks__create_invoice", QBO_CREATE_INVOICE);
    expect(released.decision).toBe("allow");
    expect(json(released).systemMessage).toMatch(
      /released create invoice .* approved by your message at \d\d:\d\d UTC \(“yes, post it”\)/,
    );

    // released once: the identical call is a new hold, flagged as a duplicate of the first
    const dup = await call("mcp__quickbooks__create_invoice", QBO_CREATE_INVOICE);
    expect(dup.decision).toBe("deny");
    expect(dup.hold!.id).not.toBe(id);
    expect(dup.hold!.duplicate_of?.id).toBe(id);
    expect(dup.body!.cause).toMatch(/DUPLICATE/);

    const rows = readLog(t.guardDir);
    expect(rows.map((r) => r.event)).toEqual(["held", "still-held", "released", "held"]);
    expect(rows[2]!.approved_by).toMatch(/^message at/);
    expect((await verifyLog(t.guardDir)).ok).toBe(true);
  });

  it("changed arguments are a new hold with a new diff", async () => {
    t = tempHome();
    const a = await call("mcp__quickbooks__create_invoice", QBO_CREATE_INVOICE);
    const changed = structuredClone(QBO_CREATE_INVOICE);
    changed.params.line_items[0]!.qty = 8;
    const b = await call("mcp__quickbooks__create_invoice", changed);
    expect(b.hold!.id).not.toBe(a.hold!.id);
    expect((b.body!.details as { diff: string[] }).diff).toContain(
      "= total 1,000.00 across 2 lines",
    );
  });

  it("is released by a terminal approve, once", async () => {
    t = tempHome();
    const held = await call("mcp__quickbooks__create_invoice", QBO_CREATE_INVOICE, {
      client: "codex",
    });
    expect(json(held).hookSpecificOutput.permissionDecision).toBe("deny");
    expect(held.body!.fix).toMatch(/approve it in their own terminal/);
    expect(decideHold(t.ctx, held.hold!.id, "approve").ok).toBe(true);
    const released = await call("mcp__quickbooks__create_invoice", QBO_CREATE_INVOICE, {
      client: "codex",
    });
    expect(released.decision).toBe("allow");
    const next = await call("mcp__quickbooks__create_invoice", QBO_CREATE_INVOICE, {
      client: "codex",
    });
    expect(next.decision).toBe("deny");
    expect(decideHold(t.ctx, held.hold!.id, "approve").ok).toBe(false);
  });

  it("is not released for Codex or Gemini CLI by a message: their transcripts are not read", async () => {
    t = tempHome();
    const held = await call("mcp_quickbooks_create_invoice", QBO_CREATE_INVOICE, {
      client: "gemini",
    });
    const out = json(held);
    expect(out.decision).toBe("deny");
    expect(JSON.parse(out.reason).code).toBe("APPROVAL_REQUIRED");
    person("yes, post it");
    const again = await call("mcp_quickbooks_create_invoice", QBO_CREATE_INVOICE, {
      client: "gemini",
    });
    expect(again.decision).toBe("deny");
    expect(again.body!.cause).toMatch(/Gemini CLI transcripts are not a format booksguard reads/);
  });

  it("is not approved twice by one message when the hooks run in parallel", async () => {
    t = tempHome();
    const first = await call("mcp__quickbooks__create_invoice", QBO_CREATE_INVOICE, {
      id: "toolu_same",
    });
    // a second hook (the plugin and the user-level hook) on the very same tool call
    const second = await call("mcp__quickbooks__create_invoice", QBO_CREATE_INVOICE, {
      id: "toolu_same",
      advance: 0,
    });
    expect(second.hold!.id).toBe(first.hold!.id);
    expect(readLog(t.guardDir).map((r) => r.event)).toEqual(["held"]);
    person("approve");
    const r1 = await call("mcp__quickbooks__create_invoice", QBO_CREATE_INVOICE, {
      id: "toolu_retry",
    });
    const r2 = await call("mcp__quickbooks__create_invoice", QBO_CREATE_INVOICE, {
      id: "toolu_retry",
      advance: 0,
    });
    expect([r1.decision, r2.decision]).toEqual(["allow", "allow"]);
    expect(r2.stdout).toBe("");
    expect(readLog(t.guardDir).map((r) => r.event)).toEqual(["held", "released"]);
  });
});

describe("what passes and what is refused", () => {
  it("lets reads and non-ledger calls through with no output", async () => {
    t = tempHome();
    for (const [tool, args] of [
      ["mcp__quickbooks__search_invoices", { params: {} }],
      ["mcp__stripe__create_invoice", { customer: "cus_1" }],
      ["Bash", { command: "npm test" }],
      ["Write", { file_path: "/tmp/notes.md", content: "x" }],
    ] as const) {
      const a = await call(tool, args);
      expect(a, tool).toMatchObject({ decision: "allow", stdout: "" });
    }
    expect(existsSync(path.join(t.guardDir, "audit.jsonl"))).toBe(false);
  });

  it("refuses the agent approving its own hold", async () => {
    t = tempHome();
    const held = await call("mcp__quickbooks__create_invoice", QBO_CREATE_INVOICE);
    const a = await call("Bash", {
      command: `npx --allow-git=root github:agentwares/booksguard approve ${held.hold!.id}`,
    });
    expect(a.decision).toBe("deny");
    expect(a.body!.code).toBe("TOOL_DENIED");
    expect(readLog(t.guardDir).at(-1)!.event).toBe("refused");
  });

  it("refuses every ledger write while okgate's kill switch is on", async () => {
    t = tempHome();
    mkdirSync(path.join(t.home, ".okgate"), { recursive: true });
    writeFileSync(path.join(t.home, ".okgate", "KILL"), "stop everything\n");
    const a = await call("mcp__xero__create-manual-journal", {
      narration: "x",
      manualJournalLines: [],
    });
    expect(a.body!.code).toBe("KILLED");
    expect(a.body!.retryable).toBe(false);
    t.ctx.env.OKGATE_KILL = "1";
    expect((await call("mcp__quickbooks__search_invoices", {})).decision).toBe("allow");
  });

  it("in watch mode logs what it would hold and lets it run", async () => {
    t = tempHome();
    writeRules(t.guardDir, { ...DEFAULT_RULES, mode: "watch" });
    const a = await call("mcp__meridian__create_journal_entry", MERIDIAN_JOURNAL_ENTRY);
    expect(a.decision).toBe("allow");
    expect(json(a).systemMessage).toMatch(
      /watch mode\) would have held create journal entry 2,500.00 OUT OF BALANCE/,
    );
    expect(readLog(t.guardDir).map((r) => r.event)).toEqual(["would-hold"]);
  });

  it("holds an edit of the hook settings like a ledger write", async () => {
    t = tempHome();
    const a = await call("Edit", {
      file_path: path.join(t.home, ".claude", "settings.json"),
      old_string: "booksguard",
      new_string: "",
    });
    expect(a.decision).toBe("deny");
    expect(a.body!.cause).toMatch(/holding this change until a person approves it/);
  });

  it("fails closed on a ledger write when its state cannot be written", async () => {
    t = tempHome();
    mkdirSync(path.dirname(t.guardDir), { recursive: true });
    writeFileSync(t.guardDir, "not a directory");
    const a = await call("mcp__quickbooks__create_invoice", QBO_CREATE_INVOICE);
    expect(a.decision).toBe("deny");
    expect(a.body!.code).toBe("INTERNAL");
    expect((await call("mcp__quickbooks__search_invoices", {})).stdout).toBe("");
  });

  it("answers garbage input with silence", async () => {
    t = tempHome();
    expect(await runHook("claude", "not json", t.ctx)).toMatchObject({
      decision: "allow",
      stdout: "",
    });
  });
});
