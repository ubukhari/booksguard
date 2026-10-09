/**
 * The harnesses booksguard hooks into, the entries it writes, and the MCP servers it finds there.
 *
 * Installed the way agent-cap (DOOR-9) installs its hook, after okgate's hook mode (AG-HOOK): every
 * other hook and setting is kept, the first change to an existing file leaves a
 * `<file>.booksguard-backup`, the write is atomic, and `uninstall` removes only booksguard's own
 * entries (a command naming booksguard's `hook pre-tool-use`).
 *
 * Hook APIs read 9 Oct 2026:
 * - Claude Code: https://code.claude.com/docs/en/hooks — `hooks.PreToolUse[] = {matcher, hooks:
 *   [{type: "command", command, timeout}]}` in `$CLAUDE_CONFIG_DIR` or `~/.claude/settings.json`
 *   (project: `.claude/settings.json`); timeout in seconds; a `deny` still applies in
 *   bypassPermissions; the input carries `transcript_path` and `tool_use_id`. Cowork loads the same
 *   hooks from a plugin's `hooks/hooks.json` (https://claude.com/docs/plugins/platform-support).
 * - Codex: https://learn.chatgpt.com/docs/hooks — `hooks.PreToolUse[]` in `$CODEX_HOME` or
 *   `~/.codex/hooks.json`; MCP tools are `mcp__server__tool`; only `deny` is supported; a hook runs
 *   only after the person trusts it in `/hooks`.
 * - Gemini CLI: https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md —
 *   `hooks.BeforeTool[] = {matcher, hooks: [{name, type, command, timeout}]}` in
 *   `~/.gemini/settings.json`; MCP tools are `mcp_<server>_<tool>`; timeout in milliseconds.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import type { Client } from "./classify.js";

export const CLIENTS: readonly Client[] = ["claude", "codex", "gemini"];

export const CLIENT_LABEL: Record<Client, string> = {
  claude: "Claude Code",
  codex: "Codex",
  gemini: "Gemini CLI",
};

/** The calls that reach the hook: MCP tools, the shell, and file edits. Built-in reads never do. */
export const MATCHERS: Record<Client, string> = {
  claude: "^mcp__|^(Bash|PowerShell|Write|Edit|MultiEdit|NotebookEdit)$",
  codex: "^mcp__|^(Bash|apply_patch|exec_command|shell)$",
  gemini: "^mcp_|^(run_shell_command|write_file|replace)$",
};

export const HOW_APPROVED: Record<Client, string> = {
  claude:
    "the person's own message after the hold (read from the transcript), or a terminal approve",
  codex:
    "a terminal approve only (Codex transcripts are not a format booksguard reads); trust the hook once in Codex's /hooks",
  gemini:
    "a terminal approve only (Gemini CLI transcripts are not a format booksguard reads); written to Gemini CLI's hook docs, not yet run on a live Gemini CLI",
};

export interface Paths {
  home: string;
  env: NodeJS.ProcessEnv;
  /** project-level install: the project's own settings files */
  project?: string;
}

const claudeDir = ({ home, env, project }: Paths): string => {
  if (project) return path.join(project, ".claude");
  const first = env.CLAUDE_CONFIG_DIR?.split(",")
    .map((d) => d.trim())
    .find(Boolean);
  return first ? path.resolve(first) : path.join(home, ".claude");
};
const codexDir = ({ home, env, project }: Paths): string =>
  project
    ? path.join(project, ".codex")
    : env.CODEX_HOME
      ? path.resolve(env.CODEX_HOME)
      : path.join(home, ".codex");
const geminiDir = ({ home, project }: Paths): string => path.join(project ?? home, ".gemini");

/** The file booksguard's hook entry goes in. */
export function hookFile(client: Client, p: Paths): string {
  if (client === "claude") return path.join(claudeDir(p), "settings.json");
  if (client === "codex") return path.join(codexDir(p), "hooks.json");
  return path.join(geminiDir(p), "settings.json");
}

/** The directory whose existence says the harness is on this machine. Nothing inside is read. */
export function harnessDir(client: Client, p: Paths): string {
  const user = { ...p, project: undefined };
  return client === "claude"
    ? claudeDir(user)
    : client === "codex"
      ? codexDir(user)
      : geminiDir(user);
}

/** `~/.claude/settings.json`: home shown as ~, so output never carries a user name. */
export function tilde(file: string, home: string): string {
  return file === home || file.startsWith(home + path.sep) ? `~${file.slice(home.length)}` : file;
}

/** POSIX shell quoting, only where needed. */
export function shellQuote(s: string): string {
  return /^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}

/**
 * The CLI the hook should run. A copy npx made lives in npm's cache, which `npm cache clean` and
 * npx's own pruning delete; a hook pointing there would stop holding writes the day it went. So a
 * CLI running from npx is copied, with its dependencies, into `<guardDir>/runtime` first, and the
 * hook runs that copy (agent-cap's approach). Any other location is used where it is.
 */
export function stableCli(cliPath: string, guardDir: string): string {
  const parts = cliPath.split(path.sep);
  const npx = parts.lastIndexOf("_npx");
  const nm = parts.indexOf("node_modules", npx);
  if (npx < 0 || nm < 0) return cliPath;
  const from = parts.slice(0, nm + 1).join(path.sep);
  const rest = parts.slice(nm + 1);
  const to = path.join(guardDir, "runtime", "node_modules");
  const tmp = `${to}.${process.pid}.tmp`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(path.dirname(tmp), { recursive: true });
  cpSync(from, tmp, { recursive: true, dereference: true });
  rmSync(to, { recursive: true, force: true });
  renameSync(tmp, to);
  return path.join(to, ...rest);
}

export interface CommandOptions {
  /** `--command <cmd>`: run this instead (e.g. `booksguard`, when it is installed globally) */
  command?: string;
  execPath: string;
  cliPath: string;
}

export function hookCommand(client: Client, o: CommandOptions): string {
  const base = o.command?.trim() || `${shellQuote(o.execPath)} ${shellQuote(o.cliPath)}`;
  return `${base} hook pre-tool-use --client ${client}`;
}

/** Ours: any hook command naming booksguard's pre-tool-use hook. */
export const isOurs = (command: unknown): boolean =>
  typeof command === "string" &&
  /booksguard/.test(command) &&
  /\bhook pre-tool-use\b/.test(command);

/** The script a `node <script> hook …` command runs, to check it still exists. */
export function scriptOf(command: string): string | null {
  const m = /^\s*(?:'[^']*'|"[^"]*"|\S+)\s+('([^']*)'|"([^"]*)"|(\S+\.m?js))\s+hook\b/.exec(
    command,
  );
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? null;
}

type Json = Record<string, unknown>;

interface HookEntry {
  matcher?: string;
  hooks?: { type?: string; command?: string; [k: string]: unknown }[];
  [k: string]: unknown;
}

function readJson(file: string): { ok: true; value: Json } | { ok: false; reason: string } {
  if (!existsSync(file)) return { ok: true, value: {} };
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    return {
      ok: false,
      reason: `cannot read it (${(err as NodeJS.ErrnoException).code ?? "error"})`,
    };
  }
  if (text.trim() === "") return { ok: true, value: {} };
  try {
    const v = JSON.parse(text) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v))
      return { ok: false, reason: "it is not a JSON object" };
    return { ok: true, value: v as Json };
  } catch {
    return { ok: false, reason: "it is not plain JSON" };
  }
}

function writeJson(file: string, value: Json): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const backup = `${file}.booksguard-backup`;
  if (existsSync(file) && !existsSync(backup)) cpSync(file, backup);
  const tmp = `${file}.${process.pid}.booksguard.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n");
  renameSync(tmp, file);
}

const eventOf = (client: Client): string => (client === "gemini" ? "BeforeTool" : "PreToolUse");

function entriesOf(settings: Json, event: string): HookEntry[] {
  const hooks = settings.hooks;
  if (!hooks || typeof hooks !== "object" || Array.isArray(hooks)) return [];
  const list = (hooks as Json)[event];
  return Array.isArray(list) ? (list as HookEntry[]) : [];
}

function withoutOurs(entries: HookEntry[]): HookEntry[] {
  return entries
    .map((e) => {
      if (!Array.isArray(e.hooks)) return e;
      const kept = e.hooks.filter((h) => !isOurs(h?.command));
      return kept.length === e.hooks.length ? e : { ...e, hooks: kept };
    })
    .filter((e) => !Array.isArray(e.hooks) || e.hooks.length > 0);
}

export function entryFor(client: Client, command: string): HookEntry {
  if (client === "gemini")
    return {
      matcher: MATCHERS.gemini,
      hooks: [
        {
          name: "booksguard",
          type: "command",
          command,
          timeout: 30_000,
          description: "booksguard: QuickBooks and Xero writes wait for a person's yes",
        },
      ],
    };
  if (client === "claude")
    return {
      matcher: MATCHERS.claude,
      hooks: [{ type: "command", command, timeout: 30, statusMessage: "booksguard" }],
    };
  return { matcher: MATCHERS.codex, hooks: [{ type: "command", command, timeout: 30 }] };
}

export type InstallResult =
  | { client: Client; file: string; action: "added" | "updated" | "unchanged" }
  | { client: Client; file: string; action: "skipped"; reason: string };

export function installHook(client: Client, command: string, p: Paths): InstallResult {
  const file = hookFile(client, p);
  const read = readJson(file);
  if (!read.ok) return { client, file, action: "skipped", reason: read.reason };
  const settings = read.value;
  const event = eventOf(client);
  const before = entriesOf(settings, event);
  const had = before.some((e) => (e.hooks ?? []).some((h) => isOurs(h?.command)));
  const want = entryFor(client, command);
  const same = before.some((e) => JSON.stringify(e) === JSON.stringify(want));
  if (had && same) return { client, file, action: "unchanged" };
  const hooks =
    settings.hooks && typeof settings.hooks === "object" && !Array.isArray(settings.hooks)
      ? (settings.hooks as Json)
      : {};
  writeJson(file, { ...settings, hooks: { ...hooks, [event]: [...withoutOurs(before), want] } });
  return { client, file, action: had ? "updated" : "added" };
}

export function uninstallHook(
  client: Client,
  p: Paths,
): { client: Client; file: string; removed: boolean } {
  const file = hookFile(client, p);
  const read = readJson(file);
  if (!read.ok || !existsSync(file)) return { client, file, removed: false };
  const settings = read.value;
  const event = eventOf(client);
  const before = entriesOf(settings, event);
  const after = withoutOurs(before);
  if (JSON.stringify(after) === JSON.stringify(before)) return { client, file, removed: false };
  const hooks = { ...(settings.hooks as Json) };
  if (after.length > 0) hooks[event] = after;
  else delete hooks[event];
  const next: Json = { ...settings };
  if (Object.keys(hooks).length > 0) next.hooks = hooks;
  else delete next.hooks;
  writeJson(file, next);
  return { client, file, removed: true };
}

export type HookState =
  | { state: "installed"; file: string; command: string }
  | { state: "missing"; file: string }
  | { state: "broken"; file: string; reason: string };

export function hookState(client: Client, p: Paths): HookState {
  const file = hookFile(client, p);
  const read = readJson(file);
  if (!read.ok) return { state: "broken", file, reason: `cannot read the file: ${read.reason}` };
  const command = entriesOf(read.value, eventOf(client))
    .flatMap((e) => e.hooks ?? [])
    .map((h) => h?.command)
    .find(isOurs) as string | undefined;
  if (!command) return { state: "missing", file };
  const script = scriptOf(command);
  if (script !== null && !existsSync(script))
    return { state: "broken", file, reason: "the hook runs a file that no longer exists" };
  return { state: "installed", file, command };
}

// ---------------------------------------------------------------------------------------------
// Ledger servers already configured in the harnesses: names only

const LEDGER_HINT = /quickbooks|qbo|intuit|xero|meridian/i;

export interface FoundServer {
  name: string;
  /** where it is configured, home shown as ~ */
  where: string;
}

/** The MCP config files a harness keeps, user level and for the project in `cwd`. */
function mcpConfigFiles(p: Paths, cwd: string): { file: string; kind: "json" | "toml" }[] {
  const claude = claudeDir({ ...p, project: undefined });
  return [
    { file: path.join(p.home, ".claude.json"), kind: "json" as const },
    { file: path.join(claude, "settings.json"), kind: "json" as const },
    { file: path.join(cwd, ".mcp.json"), kind: "json" as const },
    {
      file: path.join(geminiDir({ ...p, project: undefined }), "settings.json"),
      kind: "json" as const,
    },
    { file: path.join(cwd, ".gemini", "settings.json"), kind: "json" as const },
    {
      file: path.join(codexDir({ ...p, project: undefined }), "config.toml"),
      kind: "toml" as const,
    },
  ];
}

function serversInJson(value: unknown, out: Map<string, unknown>, depth = 0): void {
  if (!value || typeof value !== "object" || depth > 4) return;
  for (const [k, v] of Object.entries(value as Json)) {
    if (
      (k === "mcpServers" || k === "mcp_servers") &&
      v &&
      typeof v === "object" &&
      !Array.isArray(v)
    ) {
      for (const [name, def] of Object.entries(v as Json)) out.set(name, def);
    } else if (v && typeof v === "object") serversInJson(v, out, depth + 1);
  }
}

/**
 * QuickBooks and Xero servers configured in the harnesses: a server whose name, command, arguments
 * or URL names quickbooks, qbo, intuit, xero or meridian. Only the names are kept; nothing else
 * from these files (which can hold tokens) is returned or printed.
 */
export function findLedgerServers(p: Paths, cwd: string): FoundServer[] {
  const found: FoundServer[] = [];
  for (const { file, kind } of mcpConfigFiles(p, cwd)) {
    if (!existsSync(file)) continue;
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const servers = new Map<string, unknown>();
    if (kind === "json") {
      try {
        serversInJson(JSON.parse(text), servers);
      } catch {
        continue;
      }
    } else {
      // [mcp_servers.<name>] tables and the lines under each
      let current: string | undefined;
      let body = "";
      const flush = () => {
        if (current) servers.set(current, body);
      };
      for (const line of text.split("\n")) {
        // a sub-table such as [mcp_servers.xero.env] ends the server's own lines: env is not read
        const m = /^\s*\[mcp_servers\.("?)([^\].".]+)\1\]\s*$/.exec(line);
        if (m) {
          flush();
          current = m[2]!;
          body = "";
        } else if (/^\s*\[/.test(line)) {
          flush();
          current = undefined;
        } else if (current) body += `${line}\n`;
      }
      flush();
    }
    for (const [name, def] of servers) {
      const def_ = def as Json | string;
      const text_ =
        typeof def_ === "string"
          ? def_
          : [
              def_?.command,
              def_?.url,
              def_?.httpUrl,
              ...(Array.isArray(def_?.args) ? def_.args : []),
            ]
              .filter((x) => typeof x === "string")
              .join(" ");
      if (LEDGER_HINT.test(name) || LEDGER_HINT.test(text_))
        found.push({ name, where: tilde(file, p.home) });
    }
  }
  const seen = new Set<string>();
  return found.filter((f) => (seen.has(f.name) ? false : (seen.add(f.name), true)));
}

// ---------------------------------------------------------------------------------------------
// The plugin's hook (Claude Code and Cowork): distribution/root/plugins/booksguard/hooks/hooks.json

/**
 * What the plugin's hook runs: the copy `booksguard install` recorded in `<home>/cli-path` when
 * there is one (fast, no network), else booksguard fetched by npx on each call. macOS and Linux
 * shells; plugin hooks run on the person's computer, with Node 20 or later on the PATH.
 */
export function pluginHookCommand(run: string): string {
  return (
    `d="\${BOOKSGUARD_HOME:-$HOME/.booksguard}"; f="$(cat "$d/cli-path" 2>/dev/null)"; ` +
    `if [ -n "$f" ] && [ -f "$f" ]; then exec node "$f" hook pre-tool-use --client claude; fi; ` +
    `exec ${run} hook pre-tool-use --client claude`
  );
}

/** The plugin's hooks/hooks.json, as src/distribution.test.ts writes and checks it. */
export function pluginHooks(run: string): Record<string, unknown> {
  return {
    description:
      "booksguard: every QuickBooks and Xero write by the agent waits for the person's yes, with a dry-run diff",
    hooks: {
      PreToolUse: [
        {
          matcher: MATCHERS.claude,
          hooks: [
            {
              type: "command",
              command: pluginHookCommand(run),
              timeout: 60,
              statusMessage: "booksguard",
            },
          ],
        },
      ],
    },
  };
}
