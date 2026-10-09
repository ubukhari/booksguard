/**
 * `booksguard`: nothing an AI agent writes to QuickBooks or Xero posts until a person says yes.
 *
 *   booksguard install            write the hook into Claude Code, Codex and Gemini CLI (user level)
 *   booksguard status             each harness, the rulebook, the ledger servers found, what waits
 *   booksguard holds              the writes waiting, with their diffs
 *   booksguard approve <id>       a person releases one held write (an agent is refused)
 *   booksguard deny <id>          a person turns one down
 *   booksguard log                this month's AI writes per client (--csv, --json)
 *   booksguard verify             check the log's hash chain
 *   booksguard check <tool> …     what would be held, and its diff, without a harness
 *   booksguard demo               the whole thing on synthetic calls in a temporary home
 *   booksguard mcp                a read-only MCP server (check, holds, month log)
 *   booksguard uninstall          remove every hook booksguard wrote
 *   booksguard hook pre-tool-use --client claude|codex|gemini      what the hooks run
 *
 * Local only: no network request, no LLM, no telemetry. It never calls QuickBooks or Xero.
 */
import { existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { appendAudit, readLog, renderSummary, summarize, toCsv, verifyLog } from "./audit.js";
import { CATALOG_SUMMARY } from "./catalog.js";
import { classify, type Client } from "./classify.js";
import { renderDiff } from "./diff.js";
import {
  CLIENT_LABEL,
  CLIENTS,
  findLedgerServers,
  harnessDir,
  HOW_APPROVED,
  hookCommand,
  hookState,
  installHook,
  stableCli,
  tilde,
  uninstallHook,
  type Paths,
} from "./harnesses.js";
import { HoldStore } from "./holds.js";
import { decideHold, runHook, type Ctx } from "./hook.js";
import { FIRM_LOG, INSTALL, PAGE, REPO } from "./install.js";
import { guardHome, readRules, rulesFile, UsageError, writeRules } from "./rules.js";
import { version } from "./version.js";

const HELP =
  () => `booksguard ${version()} — nothing an AI agent writes to QuickBooks or Xero posts until a person says yes

Usage
  ${INSTALL} install [--client claude,codex,gemini|all] [--project] [--command <cmd>] [--no-hooks]
      write the pre-tool-use hook (user level unless --project) and ~/.booksguard/rules.json;
      --no-hooks when the booksguard plugin (Claude Code, Cowork) already carries the hook
  ${INSTALL} status            each harness, the rulebook, the ledger servers found, what is waiting
  ${INSTALL} holds             the writes waiting for a person, with their diffs
  ${INSTALL} approve <id>      release one held write (a person runs it; an agent is refused)
  ${INSTALL} deny <id>         turn one down
  ${INSTALL} log [--month YYYY-MM] [--company <text>] [--csv | --json]
                               the month's AI writes per client: held, released (who said yes), refused
  ${INSTALL} verify            check the log's hash chain
  ${INSTALL} check <tool> [--args '<json>'] [--client claude|codex|gemini]
                               would this call be held, and its dry-run diff
  ${INSTALL} demo              the whole thing on synthetic calls in a temporary home
  ${INSTALL} mcp               a read-only MCP server: check, holds, month log
  ${INSTALL} uninstall [--project]   remove every hook booksguard wrote

What is held
  Every create, update, delete, void, send or import through Intuit's QuickBooks connector and
  open-source server, Meridian's QuickBooks connector and Xero's open-source server
  (${CATALOG_SUMMARY}), any other tool on a server named for QuickBooks or Xero
  that is not a read, and curl/wget/HTTPie calls to the QuickBooks and Xero APIs that are not a GET.
  Reads pass. The agent may not approve its own holds or write booksguard's home.

How a person approves
  Claude Code and Cowork: their own message after the hold ("yes, post it"), read from the
  transcript; or ${INSTALL} approve <id> in a terminal.
  Codex and Gemini CLI: ${INSTALL} approve <id> in a terminal.

Not seen: a script the agent writes and then runs, when the command line does not name a ledger
API host. A local hook is a seatbelt, not a vault.
Pages: ${PAGE}   Source: ${REPO}`;

export interface Io {
  out: { write(chunk: string): unknown; isTTY?: boolean };
  err: { write(chunk: string): unknown };
  stdin?: () => Promise<string>;
}

export interface MainOptions {
  cliPath?: string;
  execPath?: string;
  ctx?: Partial<Ctx>;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export function contextFrom(env: NodeJS.ProcessEnv, over: Partial<Ctx> = {}): Ctx {
  const fixed = env.BOOKSGUARD_NOW ? Date.parse(env.BOOKSGUARD_NOW) : NaN;
  const home = over.home ?? homedir();
  return {
    env,
    home,
    guardDir: guardHome(home, env),
    cwd: process.cwd(),
    now: () => (Number.isFinite(fixed) ? fixed : Date.now()),
    ...over,
  };
}

function clientsFrom(value: string | undefined): Client[] {
  if (!value || value === "all") return [...CLIENTS];
  return value.split(",").map((v) => {
    const c = v
      .trim()
      .toLowerCase()
      .replace(/-cli$|-code$/, "");
    if (c === "claude" || c === "codex" || c === "gemini") return c;
    throw new UsageError(`unknown --client "${v}": claude, codex, gemini or all`);
  });
}

export async function main(argv: string[], io: Io, opts: MainOptions = {}): Promise<number> {
  const ctx = contextFrom(process.env, opts.ctx);
  // everything below reads the context's environment, so a test's temporary home is the only home
  const env = ctx.env;
  const w = (s = "") => io.out.write(`${s}\n`);
  const [cmd, ...rest] = argv;
  try {
    if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
      w(HELP());
      return 0;
    }
    if (cmd === "-v" || cmd === "--version") {
      w(version());
      return 0;
    }

    if (cmd === "hook") {
      const { values, positionals } = parseArgs({
        args: rest,
        options: { client: { type: "string" } },
        allowPositionals: true,
      });
      if (positionals[0] !== "pre-tool-use")
        throw new UsageError("usage: booksguard hook pre-tool-use --client claude|codex|gemini");
      const client = clientsFrom(values.client ?? "claude")[0]!;
      const stdin = await (io.stdin ?? readStdin)();
      const answer = await runHook(client, stdin, ctx);
      if (answer.stdout) io.out.write(`${answer.stdout}\n`);
      return answer.code;
    }

    if (cmd === "install") {
      const { values } = parseArgs({
        args: rest,
        options: {
          client: { type: "string" },
          project: { type: "boolean" },
          command: { type: "string" },
          "no-hooks": { type: "boolean" },
        },
      });
      const explicit = values.client !== undefined;
      const clients = clientsFrom(values.client);
      const paths: Paths = { home: ctx.home, env, project: values.project ? ctx.cwd : undefined };
      const cliPath = opts.cliPath ?? process.argv[1] ?? "";
      const stable = values.command ? cliPath : stableCli(cliPath, ctx.guardDir);
      const loaded = readRules(ctx.guardDir);
      const found = findLedgerServers({ home: ctx.home, env }, ctx.cwd);
      const named = found
        .map((f) => f.name)
        .filter((n) => !/quickbooks|qbo|intuit|xero|meridian/i.test(n));
      const rules = {
        ...loaded.rules,
        ledger_servers: [...new Set([...loaded.rules.ledger_servers, ...named])],
      };
      writeRules(ctx.guardDir, rules);
      w(
        `${loaded.exists ? "kept   " : "wrote  "} ${tilde(rulesFile(ctx.guardDir), ctx.home)} (mode: ${rules.mode})`,
      );
      for (const f of found) w(`found   ledger server "${f.name}" in ${f.where}`);
      if (!values.command) {
        // the plugin's hook (Claude Code, Cowork) runs this copy rather than fetching booksguard
        writeFileSync(path.join(ctx.guardDir, "cli-path"), `${stable}\n`);
        w(
          `wrote   ${tilde(path.join(ctx.guardDir, "cli-path"), ctx.home)} (the plugin's hook runs this copy)`,
        );
      }
      for (const client of values["no-hooks"] ? [] : clients) {
        if (!explicit && !values.project && !harnessFound(client, paths)) {
          w(
            `skip    ${CLIENT_LABEL[client]}: not on this machine (${tilde(harnessDir(client, paths), ctx.home)} missing; --client ${client} to write it anyway)`,
          );
          continue;
        }
        const command = hookCommand(client, {
          command: values.command,
          execPath: opts.execPath ?? process.execPath,
          cliPath: stable,
        });
        const res = installHook(client, command, paths);
        if (res.action === "skipped")
          w(
            `skip    ${CLIENT_LABEL[client]}: ${tilde(res.file, ctx.home)} ${res.reason}; fix it and run install again`,
          );
        else
          w(
            `${res.action.padEnd(7)} ${CLIENT_LABEL[client]} hook in ${tilde(res.file, ctx.home)}: ${HOW_APPROVED[client]}`,
          );
      }
      w("");
      w("Next:");
      w("  1. start a new session of your agent (hooks are read at start)");
      w(
        "  2. work as usual: every QuickBooks or Xero write is held with its diff until you say yes",
      );
      w(`  3. ${INSTALL} log     # what AI wrote this month, per client, and who approved it`);
      w(`  undo: ${INSTALL} uninstall${values.project ? " --project" : ""}`);
      return 0;
    }

    if (cmd === "uninstall") {
      const { values } = parseArgs({ args: rest, options: { project: { type: "boolean" } } });
      const paths: Paths = { home: ctx.home, env, project: values.project ? ctx.cwd : undefined };
      let removed = 0;
      for (const client of CLIENTS) {
        const r = uninstallHook(client, paths);
        if (r.removed) {
          removed += 1;
          w(`removed ${CLIENT_LABEL[client]} hook from ${tilde(r.file, ctx.home)}`);
        }
      }
      if (removed === 0) w("no booksguard hooks found");
      w(
        `kept    ${tilde(ctx.guardDir, ctx.home)} (the rulebook, holds and the log); delete it yourself if you want it gone`,
      );
      return 0;
    }

    if (cmd === "status") {
      const loaded = readRules(ctx.guardDir);
      for (const scope of ["user", "project"] as const) {
        const paths: Paths = {
          home: ctx.home,
          env,
          project: scope === "project" ? ctx.cwd : undefined,
        };
        for (const client of CLIENTS) {
          const s = hookState(client, paths);
          if (scope === "project" && s.state === "missing") continue;
          w(
            `${scope.padEnd(7)} ${CLIENT_LABEL[client].padEnd(11)} ${s.state === "installed" ? "holds writes" : s.state === "broken" ? `BROKEN: ${s.reason}` : "no hook"}  (${tilde(s.file, ctx.home)})`,
          );
        }
      }
      w(
        `rules   ${tilde(rulesFile(ctx.guardDir), ctx.home)}: ${loaded.exists ? `mode ${loaded.rules.mode}` : "absent, defaults apply (mode hold)"}${loaded.problem ? `; ${loaded.problem}` : ""}`,
      );
      for (const f of findLedgerServers({ home: ctx.home, env }, ctx.cwd))
        w(`server  "${f.name}" in ${f.where}`);
      const pending = new HoldStore(ctx.guardDir).pending(ctx.now());
      w(`holds   ${pending.length} waiting${pending.length ? `: ${INSTALL} holds` : ""}`);
      return 0;
    }

    if (cmd === "holds") {
      const { values } = parseArgs({ args: rest, options: { json: { type: "boolean" } } });
      const pending = new HoldStore(ctx.guardDir).pending(ctx.now());
      if (values.json) {
        w(JSON.stringify(pending, null, 2));
        return 0;
      }
      if (pending.length === 0) w("nothing is waiting");
      for (const h of pending) {
        w(
          `${h.id}  ${h.created_at.slice(0, 16).replace("T", " ")} UTC  ${h.status === "approved" ? "APPROVED, waiting for the agent's retry" : "held"}  ${h.folder}`,
        );
        w(`  ${h.title}`);
        if (h.duplicate_of)
          w(
            `  DUPLICATE of ${h.duplicate_of.id}, released ${h.duplicate_of.released_at.slice(0, 16).replace("T", " ")} UTC`,
          );
        for (const line of h.diff) w(`    ${line}`);
        if (h.status === "held") w(`  approve: ${INSTALL} approve ${h.id}`);
        w("");
      }
      return 0;
    }

    if (cmd === "approve" || cmd === "deny") {
      const id = rest[0];
      if (!id) throw new UsageError(`usage: booksguard ${cmd} <hold id>  (see: booksguard holds)`);
      const r = decideHold(ctx, id, cmd);
      if (r.ok && r.hold && cmd === "deny")
        await appendAudit(ctx.guardDir, {
          event: "refused",
          client: "terminal",
          session: r.hold.session,
          toolName: r.hold.tool_name,
          args: r.hold.identity,
          record: {
            hold: r.hold.id,
            ledger: r.hold.ledger,
            server: r.hold.server,
            tool: r.hold.tool,
            op: r.hold.op,
            entity: r.hold.entity,
            company: r.hold.company,
            folder: r.hold.folder,
            title: r.hold.title,
          },
          reason: "denied by a person in a terminal",
          now: ctx.now(),
        });
      (r.ok ? io.out : io.err).write(`${r.message}\n`);
      return r.ok ? 0 : 1;
    }

    if (cmd === "log") {
      const { values } = parseArgs({
        args: rest,
        options: {
          month: { type: "string" },
          company: { type: "string" },
          csv: { type: "boolean" },
          json: { type: "boolean" },
        },
      });
      const month = values.month ?? new Date(ctx.now()).toISOString().slice(0, 7);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new UsageError("--month is YYYY-MM");
      const rows = readLog(ctx.guardDir);
      const s = summarize(rows, month, values.company);
      if (values.csv) io.out.write(toCsv(s.clients.flatMap((c) => c.rows)));
      else if (values.json) w(JSON.stringify(s, null, 2));
      else {
        io.out.write(renderSummary(s));
        w("");
        w(
          `One firm-wide record of every client's AI changes, with a monthly sign-off, is not built yet: ${FIRM_LOG}`,
        );
      }
      return 0;
    }

    if (cmd === "verify") {
      const v = await verifyLog(ctx.guardDir);
      if (v.ok)
        w(
          `ok: ${v.entries} entries, hash chain intact${v.head ? ` (head ${v.head.slice(0, 12)})` : ""}`,
        );
      else io.err.write(`BROKEN at entry ${v.brokenAt}: ${v.reason}\n`);
      return v.ok ? 0 : 1;
    }

    if (cmd === "check") {
      const { values, positionals } = parseArgs({
        args: rest,
        options: {
          args: { type: "string" },
          client: { type: "string" },
          json: { type: "boolean" },
        },
        allowPositionals: true,
      });
      const tool = positionals[0];
      if (!tool) throw new UsageError("usage: booksguard check <tool name> [--args '<json>']");
      let toolInput: unknown = {};
      if (values.args) {
        try {
          toolInput = JSON.parse(values.args);
        } catch {
          throw new UsageError("--args is not valid JSON");
        }
      }
      const client = clientsFrom(values.client ?? "claude")[0]!;
      const { rules } = readRules(ctx.guardDir);
      const cls = classify(
        client,
        { tool_name: tool, tool_input: toolInput, cwd: ctx.cwd },
        {
          rules,
          home: ctx.home,
          guardDir: ctx.guardDir,
          env,
        },
      );
      if (cls.kind === "pass" || cls.kind === "read") w(`passes: ${cls.why}`);
      else if (cls.kind === "refuse") w(`refused: ${cls.why}`);
      else {
        const d = renderDiff(cls);
        w(`${rules.mode === "hold" ? "held" : "would be held (watch mode)"}: ${d.title}`);
        w(`  why: ${cls.why}`);
        for (const line of d.lines) w(`    ${line}`);
      }
      return 0;
    }

    if (cmd === "demo") {
      const { runDemo } = await import("./demo.js");
      return await runDemo(io.out);
    }

    if (cmd === "mcp") {
      const { serveStdio } = await import("./mcp.js");
      await serveStdio({ home: ctx.home, guardDir: ctx.guardDir, env, cwd: ctx.cwd, now: ctx.now });
      return 0;
    }

    throw new UsageError(`unknown command "${cmd}"; see booksguard --help`);
  } catch (err) {
    if (
      err instanceof UsageError ||
      (err as { code?: string }).code?.startsWith?.("ERR_PARSE_ARGS")
    ) {
      io.err.write(`booksguard: ${(err as Error).message}\n`);
      return 2;
    }
    throw err;
  }
}

function harnessFound(client: Client, p: Paths): boolean {
  return existsSync(path.resolve(harnessDir(client, p)));
}
