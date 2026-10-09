/**
 * `booksguard hook pre-tool-use --client claude|codex|gemini`: what Claude Code (and Cowork),
 * Codex and Gemini CLI run before a tool call once `booksguard install` (or the plugin) wrote the
 * hook. Answers on stdout in the harness's own shape; nothing else goes to stdout.
 *
 * In order:
 * 1. Not a ledger write (classify.ts): no output, the harness's own permission flow decides.
 * 2. The agent touching booksguard itself (`booksguard approve`, its home): refused.
 * 3. okgate's kill switch (OKGATE_KILL / AGENTGUARD_KILL, or a KILL file in ~/.okgate,
 *    ~/.agentguard or ~/.booksguard): every ledger write refused.
 * 4. rules.mode "watch": logged as would-hold, a note to the person, the call runs.
 * 5. The identical call already held:
 *    - approved in a terminal, or approved by the person's own message after the hold → released
 *      once, logged with who approved it, the call runs;
 *    - otherwise refused again with the same hold id and why the latest message did not count.
 * 6. Otherwise: a new hold with its dry-run diff, logged, and the call is refused with
 *    APPROVAL_REQUIRED. The model reads the diff and the instruction to ask; the person sees a
 *    one-line note.
 *
 * Never throws. An error inside booksguard on a ledger write refuses the write and says why
 * (fail closed); on anything else it stays silent.
 */
import path from "node:path";
import {
  CompositeKillSwitch,
  EnvKillSwitch,
  KILL_ENV,
  LEGACY_KILL_ENV,
  type GuardErrorBody,
  type KillState,
} from "@agentwares/agentguard-core";
import { FileKillSwitch } from "@agentwares/agentguard-core/node";
import { appendAudit, recordOf, type LedgerRecord } from "./audit.js";
import { approvalFromTurn, latestHumanTurn } from "./approval.js";
import {
  classify,
  type Client,
  type GuardConfigWrite,
  type HookInput,
  type LedgerWrite,
} from "./classify.js";
import { renderDiff } from "./diff.js";
import { HoldStore, identityOf, newHoldId, type Hold } from "./holds.js";
import { INSTALL } from "./install.js";
import { readRules } from "./rules.js";

export interface Ctx {
  env: NodeJS.ProcessEnv;
  home: string;
  /** booksguard's home: rules, holds, audit log */
  guardDir: string;
  cwd: string;
  now: () => number;
}

export interface HookAnswer {
  /** what the hook prints (empty: no opinion, the harness decides) */
  stdout: string;
  code: number;
  decision: "allow" | "deny";
  body?: GuardErrorBody;
  hold?: Hold;
}

export function parseInput(text: string): HookInput {
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as HookInput) : {};
  } catch {
    return {};
  }
}

export function denyOutput(client: Client, body: GuardErrorBody, userLine: string): string {
  const reason = JSON.stringify(body);
  if (client === "gemini")
    return JSON.stringify({ decision: "deny", reason, systemMessage: userLine });
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
    systemMessage: userLine,
  });
}

/** A note to the person in all three harnesses; no decision, so the call runs. */
const noteOutput = (line: string): string => JSON.stringify({ systemMessage: line });

const ALLOW_SILENT: HookAnswer = { stdout: "", code: 0, decision: "allow" };

function killSwitch(ctx: Ctx) {
  return new CompositeKillSwitch([
    new EnvKillSwitch(KILL_ENV, ctx.env),
    new EnvKillSwitch(LEGACY_KILL_ENV, ctx.env),
    new FileKillSwitch(path.join(ctx.home, ".okgate", "KILL"), [
      path.join(ctx.home, ".agentguard", "KILL"),
      path.join(ctx.guardDir, "KILL"),
    ]),
  ]);
}

const approveCmd = (id: string): string => `${INSTALL} approve ${id}`;

function heldBody(client: Client, hold: Hold, notYet?: string): GuardErrorBody {
  const viaChat = client === "claude";
  const fix = viaChat
    ? `Show the person the change in details.diff and ask, in your reply, whether to post it. Wait for their answer in their own message. If they say yes, call the same tool again with exactly the same arguments. If they want something different, call it with the changed arguments (that is held again with a new diff). They can also approve it in a terminal: \`${approveCmd(hold.id)}\`. Do not try another route to the books.`
    : `Show the person the change in details.diff and ask them to approve it in their own terminal: \`${approveCmd(hold.id)}\`. When they say they have, call the same tool again with exactly the same arguments. Do not try another route to the books.`;
  const dup = hold.duplicate_of
    ? ` DUPLICATE: an identical write was released at ${hold.duplicate_of.released_at.slice(0, 16).replace("T", " ")} UTC (hold ${hold.duplicate_of.id}); make sure the person wants a second one.`
    : "";
  return {
    code: "APPROVAL_REQUIRED",
    cause: `booksguard is holding this ${hold.ledger === "booksguard" ? "change" : `${hold.ledger} write`} until a person approves it: ${hold.title} (hold ${hold.id}).${dup}${notYet ? ` Not yet approved: ${notYet}.` : ""}`,
    fix,
    retryable: true,
    details: {
      hold: hold.id,
      diff: hold.diff,
      ...(hold.duplicate_of ? { duplicate_of: hold.duplicate_of } : {}),
      approve_in_terminal: approveCmd(hold.id),
      approve_in_chat: viaChat,
    },
  };
}

/** What the person can type to approve: "yes, post it" for a create, "yes, delete it" for a delete. */
export function replyFor(hold: Pick<Hold, "op">): string {
  const verb: Record<string, string> = {
    create: "post",
    import: "post",
    upload: "post",
    batch: "post",
    delete: "delete",
    void: "void",
    send: "send",
    update: "update",
  };
  return verb[hold.op] ? `yes, ${verb[hold.op]} it` : "approve";
}

function heldLine(client: Client, hold: Hold): string {
  const dup = hold.duplicate_of ? " DUPLICATE of a write released earlier." : "";
  const how =
    client === "claude"
      ? `Reply "${replyFor(hold)}" to approve, or run: ${approveCmd(hold.id)}`
      : `Approve it in a terminal: ${approveCmd(hold.id)}`;
  return `booksguard held ${hold.title} (hold ${hold.id}).${dup} ${how}`;
}

export async function runHook(client: Client, stdin: string, ctx: Ctx): Promise<HookAnswer> {
  const input = parseInput(stdin);
  const toolName = typeof input.tool_name === "string" ? input.tool_name : "";
  if (!toolName) return ALLOW_SILENT;
  const loaded = readRules(ctx.guardDir);
  const rules = loaded.rules;
  const cls = classify(client, input, {
    rules,
    home: ctx.home,
    guardDir: ctx.guardDir,
    env: ctx.env,
  });
  if (cls.kind === "pass" || cls.kind === "read") return ALLOW_SILENT;
  const session = typeof input.session_id === "string" ? input.session_id : undefined;
  const cwd = path.resolve(input.cwd || ctx.cwd);
  const folder = path.basename(cwd) || cwd;
  const now = ctx.now();

  if (cls.kind === "refuse") {
    const body: GuardErrorBody = {
      code: "TOOL_DENIED",
      cause: cls.why,
      fix: cls.fix,
      retryable: false,
    };
    const record: LedgerRecord = {
      ledger: "booksguard",
      server: "booksguard",
      tool: cls.tool,
      op: "guard-config",
      entity: "booksguard",
      folder,
      title: cls.tool,
    };
    await appendAudit(ctx.guardDir, {
      event: "refused",
      client,
      session,
      toolName,
      args: input.tool_input,
      record,
      reason: cls.why,
      error: body,
      now,
    });
    return {
      stdout: denyOutput(client, body, `booksguard refused ${cls.tool}: ${cls.why}`),
      code: 0,
      decision: "deny",
      body,
    };
  }

  const write: LedgerWrite | GuardConfigWrite = cls;
  try {
    const diff = renderDiff(write);
    const server = write.kind === "guard-config" ? "booksguard" : write.server;
    const tool = write.kind === "guard-config" ? write.tool : write.tool;
    const args =
      write.kind === "guard-config"
        ? { target: write.target, input: input.tool_input }
        : write.args;
    const identity = identityOf(server, tool, args);
    const base = {
      client,
      session,
      tool_use_id: typeof input.tool_use_id === "string" ? input.tool_use_id : undefined,
      tool_name: toolName,
      tool,
      server,
      ledger: write.kind === "guard-config" ? ("booksguard" as const) : write.ledger,
      op: write.kind === "guard-config" ? ("guard-config" as const) : write.op,
      entity: write.kind === "guard-config" ? "hook settings" : write.entity,
      company: write.kind === "guard-config" ? undefined : write.company,
      folder,
      title: diff.title,
      diff: diff.lines,
      money: diff.money,
    };
    const why = write.why;

    // 3. the kill switch
    let kill: KillState;
    try {
      kill = await killSwitch(ctx).check();
    } catch {
      kill = { killed: false };
    }
    if (kill.killed) {
      const body: GuardErrorBody = {
        code: "KILLED",
        cause: `the kill switch is on (${kill.reason ?? "killed"}${kill.source ? `, ${kill.source}` : ""}); every QuickBooks and Xero write is refused`,
        fix: "stop and tell the person. A person turns the kill switch off: `okgate resume`, or unset OKGATE_KILL / AGENTGUARD_KILL, or delete the KILL file.",
        retryable: false,
      };
      await appendAudit(ctx.guardDir, {
        event: "killed",
        client,
        session,
        toolName,
        args,
        record: { ...base, ledger: base.ledger, op: base.op },
        reason: body.cause,
        error: body,
        now,
      });
      return {
        stdout: denyOutput(client, body, `booksguard refused ${diff.title}: the kill switch is on`),
        code: 0,
        decision: "deny",
        body,
      };
    }

    // 4. watch mode
    if (rules.mode === "watch") {
      await appendAudit(ctx.guardDir, {
        event: "would-hold",
        client,
        session,
        toolName,
        args,
        record: { ...base },
        reason: `would hold: ${why} (rules.mode is watch)`,
        now,
      });
      return {
        stdout: noteOutput(
          `booksguard (watch mode) would have held ${diff.title}; it ran. Set "mode": "hold" in ${path.join(ctx.guardDir, "rules.json")} to hold writes.`,
        ),
        code: 0,
        decision: "allow",
      };
    }

    const store = new HoldStore(ctx.guardDir);
    type Step =
      | { kind: "same-call-released"; hold: Hold }
      | { kind: "same-call-held"; hold: Hold }
      | { kind: "released"; hold: Hold; humanTurn?: { ok: boolean; reason: string; at?: string } }
      | {
          kind: "still-held";
          hold: Hold;
          reason: string;
          humanTurn?: { ok: boolean; reason: string; at?: string };
        }
      | { kind: "new"; hold: Hold };

    const step = store.locked((): Step => {
      const already = store.releasedFor(identity, base.tool_use_id);
      if (already) return { kind: "same-call-released", hold: already };
      const open = store.open(identity, now);
      if (open) {
        if (base.tool_use_id && open.tool_use_id === base.tool_use_id)
          return { kind: "same-call-held", hold: open };
        if (open.status === "approved") {
          const released: Hold = {
            ...open,
            status: "released",
            released_at: new Date(now).toISOString(),
            released_tool_use_id: base.tool_use_id,
          };
          store.put(released);
          return { kind: "released", hold: released };
        }
        const evidence =
          client === "claude"
            ? latestHumanTurn(input.transcript_path)
            : {
                missing: `${client === "codex" ? "Codex" : "Gemini CLI"} transcripts are not a format booksguard reads, so a person approves in a terminal`,
              };
        const verdict = approvalFromTurn(evidence, open, now, rules.approval_window_minutes);
        const humanTurn = { ok: verdict.ok, reason: verdict.reason, at: verdict.at };
        if (verdict.ok) {
          const released: Hold = {
            ...open,
            status: "released",
            approved_at: verdict.at,
            approved_by: verdict.by,
            released_at: new Date(now).toISOString(),
            released_tool_use_id: base.tool_use_id,
          };
          store.put(released);
          return { kind: "released", hold: released, humanTurn };
        }
        const refreshed: Hold = { ...open, tool_use_id: base.tool_use_id ?? open.tool_use_id };
        store.put(refreshed);
        return { kind: "still-held", hold: refreshed, reason: verdict.reason, humanTurn };
      }
      const createdAt = new Date(now).toISOString();
      const dup = store.lastRelease(identity, now, rules.duplicate_window_hours * 3_600_000);
      const hold: Hold = {
        id: newHoldId(identity, createdAt),
        created_at: createdAt,
        identity,
        status: "held",
        ...base,
        ...(dup ? { duplicate_of: { id: dup.id, released_at: dup.released_at! } } : {}),
      };
      store.put(hold);
      return { kind: "new", hold };
    });

    if (step.kind === "same-call-released") return ALLOW_SILENT;
    if (step.kind === "same-call-held") {
      const body = heldBody(client, step.hold);
      return {
        stdout: denyOutput(client, body, heldLine(client, step.hold)),
        code: 0,
        decision: "deny",
        body,
        hold: step.hold,
      };
    }
    if (step.kind === "released") {
      const by = step.hold.approved_by ?? "the terminal";
      await appendAudit(ctx.guardDir, {
        event: "released",
        client,
        session,
        toolName,
        args,
        record: recordOf(step.hold),
        reason: `released: approved by ${by}`,
        humanTurn: step.humanTurn,
        now,
      });
      return {
        stdout: noteOutput(
          `booksguard released ${step.hold.title} (hold ${step.hold.id}), approved by ${step.hold.approved_by ? `your ${step.hold.approved_by}` : "a terminal approve"}.`,
        ),
        code: 0,
        decision: "allow",
        hold: step.hold,
      };
    }
    const notYet = step.kind === "still-held" ? step.reason : undefined;
    const body = heldBody(client, step.hold, notYet);
    await appendAudit(ctx.guardDir, {
      event: step.kind === "new" ? "held" : "still-held",
      client,
      session,
      toolName,
      args,
      record: recordOf(step.hold),
      reason: step.kind === "new" ? `held: ${why}` : `still held: ${notYet}`,
      error: body,
      humanTurn: step.kind === "still-held" ? step.humanTurn : undefined,
      now,
    });
    return {
      stdout: denyOutput(client, body, heldLine(client, step.hold)),
      code: 0,
      decision: "deny",
      body,
      hold: step.hold,
    };
  } catch (err) {
    // fail closed on a ledger write: refuse it and say why
    const body: GuardErrorBody = {
      code: "INTERNAL",
      cause: `booksguard could not check this ${write.kind === "guard-config" ? "change" : `${write.ledger} write`} (${(err as Error).message}); it is refused rather than let through unchecked`,
      fix: "tell the person booksguard failed; they can run `booksguard status` in a terminal, or remove the hook with `booksguard uninstall`",
      retryable: true,
    };
    return {
      stdout: denyOutput(
        client,
        body,
        `booksguard error, write refused: ${(err as Error).message}`,
      ),
      code: 0,
      decision: "deny",
      body,
    };
  }
}

/** A person's terminal: approve or deny a hold. Returns what changed, for the CLI to print. */
export function decideHold(
  ctx: Ctx,
  id: string,
  decision: "approve" | "deny",
): { ok: boolean; message: string; hold?: Hold } {
  const store = new HoldStore(ctx.guardDir);
  return store.locked(() => {
    const hold = store.get(id);
    if (!hold) return { ok: false, message: `no hold ${id} in ${store.dir}` };
    if (hold.status === "released")
      return { ok: false, message: `${id} was already released at ${hold.released_at}`, hold };
    if (hold.status === "denied") return { ok: false, message: `${id} was already denied`, hold };
    const at = new Date(ctx.now()).toISOString();
    const next: Hold =
      decision === "approve"
        ? {
            ...hold,
            status: "approved",
            approved_at: at,
            approved_by: `terminal at ${at.slice(11, 16)} UTC`,
          }
        : { ...hold, status: "denied" };
    store.put(next);
    return {
      ok: true,
      message:
        decision === "approve"
          ? `approved ${id}: ${hold.title}. The agent's identical retry runs once; tell it to go ahead.`
          : `denied ${id}: ${hold.title}. The agent's retry is held again as a new write.`,
      hold: next,
    };
  });
}
