/**
 * `booksguard demo`: synthetic calls through the real hook, in a temporary home that is deleted
 * afterwards. Nothing of the person's is read or written: not their settings, not their
 * transcripts, not their `~/.booksguard`. The README's recorded run is this output.
 */
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readLog, renderSummary, summarize, verifyLog } from "./audit.js";
import type { Client } from "./classify.js";
import {
  appendTranscript,
  assistantEntry,
  claudeInput,
  humanEntry,
  MERIDIAN_JOURNAL_ENTRY,
  OPAQUE_SERVER,
  QBO_CREATE_INVOICE,
  QBO_DELETE_INVOICE,
  XERO_CURL,
} from "./fixtures.js";
import { entryFor, installHook, tilde } from "./harnesses.js";
import { runHook, type Ctx, type HookAnswer } from "./hook.js";
import { INSTALL } from "./install.js";
import { guardHome } from "./rules.js";

export const DEMO_START = Date.parse("2026-10-09T14:00:00Z");

interface Out {
  write(s: string): unknown;
}

function said(answer: HookAnswer): { decision: string; line?: string; diff?: string[] } {
  if (!answer.stdout) return { decision: "passes (no output: the harness decides as usual)" };
  const parsed = JSON.parse(answer.stdout) as {
    systemMessage?: string;
    hookSpecificOutput?: { permissionDecision?: string };
    decision?: string;
  };
  const decision =
    parsed.hookSpecificOutput?.permissionDecision ?? parsed.decision ?? "allow (a note only)";
  const diff = (answer.body?.details as { diff?: string[] } | undefined)?.diff;
  return { decision, line: parsed.systemMessage, diff };
}

export async function runDemo(out: Out, opts: { keep?: boolean } = {}): Promise<number> {
  const root = mkdtempSync(path.join(tmpdir(), "booksguard-demo-"));
  const home = path.join(root, "home");
  const project = path.join(home, "clients", "acme-landscaping");
  mkdirSync(path.join(home, ".claude"), { recursive: true });
  mkdirSync(project, { recursive: true });
  const transcript = path.join(home, ".claude", "projects", "demo", "session.jsonl");
  let clock = DEMO_START;
  const env: NodeJS.ProcessEnv = { HOME: home };
  const ctx: Ctx = {
    env,
    home,
    guardDir: guardHome(home, env),
    cwd: project,
    now: () => clock,
  };
  const t = (ms: number) => new Date(ms).toISOString().slice(11, 16);
  const w = (s = "") => out.write(`${s}\n`);
  let n = 0;
  const call = async (client: Client, tool: string, input: unknown, note: string) => {
    clock += 60_000;
    n += 1;
    w(`${t(clock)}  agent   ${tool}${note ? `  (${note})` : ""}`);
    const answer = await runHook(
      client,
      JSON.stringify(claudeInput(tool, input, { cwd: project, transcript, id: `toolu_demo_${n}` })),
      ctx,
    );
    const s = said(answer);
    w(`        hook    ${s.decision}`);
    if (s.diff) for (const line of s.diff) w(`                  ${line}`);
    if (s.line) w(`        person  sees: ${s.line}`);
    w();
    return answer;
  };
  const person = (text: string, assistantAsked?: string) => {
    if (assistantAsked) {
      clock += 20_000;
      appendTranscript(transcript, assistantEntry(assistantAsked, clock));
      w(`${t(clock)}  agent   says: ${assistantAsked}`);
    }
    clock += 40_000;
    appendTranscript(transcript, humanEntry(text, clock));
    w(`${t(clock)}  person  types: ${text}`);
    w();
  };

  try {
    w("booksguard demo: synthetic calls through the real hook, in a temporary home.");
    w("Nothing of yours is read or written. Tool names and argument shapes are the public ones.");
    w();
    const res = installHook(
      "claude",
      `node /path/to/booksguard/dist/cli.js hook pre-tool-use --client claude`,
      {
        home,
        env,
      },
    );
    w(`$ ${INSTALL} install --client claude`);
    w(`${res.action.padEnd(7)} Claude Code PreToolUse hook in ${tilde(res.file, home)}`);
    w(`        matcher ${entryFor("claude", "").matcher}`);
    w();
    clock += 60_000;
    appendTranscript(
      transcript,
      humanEntry(
        "Bill Acme Landscaping for October: 10 hours of bookkeeping, invoice 1042.",
        clock,
      ),
    );
    w(
      `${t(clock)}  person  types: Bill Acme Landscaping for October: 10 hours of bookkeeping, invoice 1042.`,
    );
    w();

    await call(
      "claude",
      "mcp__quickbooks__search_customers",
      { params: { name: "Acme" } },
      "a read",
    );
    const held = await call(
      "claude",
      "mcp__quickbooks__create_invoice",
      QBO_CREATE_INVOICE,
      "Intuit's server",
    );
    const id = held.hold?.id ?? "bg_?";
    await call(
      "claude",
      "mcp__quickbooks__create_invoice",
      QBO_CREATE_INVOICE,
      "the agent retries before anyone answered",
    );
    person(
      "yes, post it",
      `booksguard is holding invoice 1042 for Acme Landscaping, 1,250.00. Shall I post it?`,
    );
    await call("claude", "mcp__quickbooks__create_invoice", QBO_CREATE_INVOICE, "same arguments");
    await call(
      "claude",
      "mcp__quickbooks__create_invoice",
      QBO_CREATE_INVOICE,
      "a retry after a timeout: the official server has no idempotency, #100",
    );
    await call(
      "claude",
      `mcp__${OPAQUE_SERVER}__create_journal_entry`,
      MERIDIAN_JOURNAL_ENTRY,
      "Meridian, under a connector id the harness does not name",
    );
    await call("claude", "Bash", { command: XERO_CURL }, "Xero's REST API");
    await call("claude", "mcp__quickbooks__delete_invoice", QBO_DELETE_INVOICE, "");
    person("no, don't delete anything", "Should I also delete the old draft of invoice 1042?");
    await call(
      "claude",
      "mcp__quickbooks__delete_invoice",
      QBO_DELETE_INVOICE,
      "the agent tries anyway",
    );
    await call(
      "claude",
      "Bash",
      { command: `${INSTALL} approve ${id}` },
      "the agent tries to approve its own hold",
    );
    await call(
      "claude",
      "mcp__stripe__create_invoice",
      { customer: "cus_123" },
      "Stripe, not a ledger",
    );

    w(`$ ${INSTALL} log`);
    const month = new Date(clock).toISOString().slice(0, 7);
    w(renderSummary(summarize(readLog(ctx.guardDir), month)).trimEnd());
    w();
    const v = await verifyLog(ctx.guardDir);
    w(`$ ${INSTALL} verify`);
    w(
      v.ok
        ? `ok: ${v.entries} entries, hash chain intact (head ${v.head?.slice(0, 12)})`
        : `BROKEN at ${v.brokenAt}: ${v.reason}`,
    );
    return 0;
  } finally {
    if (!opts.keep) rmSync(root, { recursive: true, force: true });
  }
}
