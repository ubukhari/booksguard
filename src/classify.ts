/**
 * What one tool call does to the books, from the hook's input alone (nothing is called).
 *
 * - **MCP tools** are named `mcp__<server>__<tool>` by Claude Code, Cowork and Codex and
 *   `mcp_<server>_<tool>` by Gemini CLI (which also sends `mcp_context.server_name`). A connector
 *   added in claude.ai can arrive under an opaque server id, so a ledger is recognised by its tool
 *   names (catalog.ts) as well as by its server's name.
 * - **REST calls** in a shell command: `curl`, `wget`, `http`/`https` (HTTPie) and `xh` against
 *   the QuickBooks Accounting API (`quickbooks.api.intuit.com`, `sandbox-quickbooks.api.intuit.com`)
 *   or Xero's (`api.xero.com`). A GET is a read; so is a QuickBooks POST to `/query`. Any other
 *   command that names one of those hosts and is not a plain read is held: booksguard cannot see
 *   what it sends.
 * - **booksguard itself:** the agent may not run `booksguard approve` or `uninstall`, nor write into
 *   booksguard's home; a change to a harness's hook settings is held like a ledger write, since it
 *   could remove the hook.
 *
 * Not seen: a script the agent writes and then runs (`python sync.py`) when the command line does
 * not name a ledger host. The README says so.
 */
import path from "node:path";
import { parseShell, type SimpleCommand } from "@agentwares/agentguard-core";
import { FAMILIES, judgeTool, type Ledger, type Op, type ServerFamily } from "./catalog.js";
import { anyGlob, type Rules } from "./rules.js";

export type Client = "claude" | "codex" | "gemini";

export interface HookInput {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_use_id?: string;
  hook_event_name?: string;
  permission_mode?: string;
  turn_id?: string;
  mcp_context?: { server_name?: string; [k: string]: unknown };
}

export interface LedgerWrite {
  kind: "ledger-write";
  ledger: Ledger;
  via: "mcp" | "rest";
  /** the MCP server's name as the harness shows it, or the API host */
  server: string;
  /** the bare tool name, or `POST /v3/company/{realm}/invoice` */
  tool: string;
  family?: ServerFamily;
  op: Op;
  entity: string;
  /** the QuickBooks realm or Xero tenant, when the call names one */
  company?: string;
  /** what the write carries: the MCP arguments, or the request body when it is on the line */
  args: unknown;
  /** why booksguard holds it, one clause */
  why: string;
}

export interface GuardConfigWrite {
  kind: "guard-config";
  tool: string;
  target: string;
  why: string;
}

export type Classification =
  | { kind: "pass"; why: string }
  | { kind: "read"; ledger: Ledger; server: string; tool: string; why: string }
  | LedgerWrite
  | GuardConfigWrite
  | { kind: "refuse"; tool: string; why: string; fix: string };

export interface ClassifyContext {
  rules: Rules;
  home: string;
  /** booksguard's home: the agent may not write into it */
  guardDir: string;
  env: NodeJS.ProcessEnv;
}

const LEDGER_NAME = /quickbooks|qbo|intuit|xero|meridian/i;
const OPAQUE = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{24,})$/i;

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** `mcp__srv__tool` (Claude Code, Codex) or `mcp_srv_tool` (Gemini CLI) → server and bare name. */
export function splitMcpName(
  client: Client,
  toolName: string,
  serverHint?: string,
): { server: string; tool: string } | undefined {
  if (client !== "gemini") {
    const m = /^mcp__(.+?)__(.+)$/.exec(toolName);
    return m ? { server: m[1]!, tool: m[2]! } : undefined;
  }
  if (!toolName.startsWith("mcp_")) return undefined;
  const rest = toolName.slice(4);
  if (serverHint && rest.startsWith(`${serverHint}_`))
    return { server: serverHint, tool: rest.slice(serverHint.length + 1) };
  // a catalogued tool name at the end tells where the server's name stops
  for (const family of FAMILIES)
    for (const name of [...family.writes, ...family.reads])
      if (rest.endsWith(`_${name}`) && rest.length > name.length + 1)
        return { server: rest.slice(0, -name.length - 1), tool: name };
  const i = rest.indexOf("_");
  return i > 0 ? { server: rest.slice(0, i), tool: rest.slice(i + 1) } : undefined;
}

function isLedgerServer(server: string, rules: Rules): boolean {
  return LEDGER_NAME.test(server) || anyGlob(server, rules.ledger_servers) !== undefined;
}

function ledgerOf(server: string, family?: ServerFamily): Ledger {
  if (family) return family.ledger;
  return /xero/i.test(server) ? "Xero" : "QuickBooks";
}

/**
 * The family a server is, when the tool name or the server's name says. A name two families share
 * (`create_journal_entry` is Intuit's and Meridian's) on a server whose name says neither leaves
 * the family unknown.
 */
function pickFamily(server: string, tool: string): ServerFamily | undefined {
  const candidates = FAMILIES.filter((f) => f.writes.includes(tool) || f.reads.includes(tool));
  if (candidates.length <= 1) return candidates[0];
  const hint = /meridian|pilot/i.test(server)
    ? "meridian"
    : /xero/i.test(server)
      ? "xero-local"
      : /quickbooks|qbo|intuit/i.test(server)
        ? "intuit-local"
        : undefined;
  return candidates.find((f) => f.id === hint);
}

/** QuickBooks or Xero, from the family, the tool's catalogue entries, or the server's name. */
function ledgerFor(server: string, tool: string, family?: ServerFamily): Ledger {
  if (family) return family.ledger;
  const ledgers = new Set(
    FAMILIES.filter((f) => f.writes.includes(tool) || f.reads.includes(tool)).map((f) => f.ledger),
  );
  if (ledgers.size === 1) return [...ledgers][0]!;
  return ledgerOf(server);
}

const COMPANY_KEYS = [
  "realm_id",
  "realmId",
  "realm",
  "company_id",
  "companyId",
  "company",
  "tenant_id",
  "tenantId",
  "xero_tenant_id",
  "xeroTenantId",
  "organisation_id",
  "organization_id",
];

/** The QuickBooks realm or Xero tenant a call names, searched two levels deep. */
export function companyOf(args: unknown, depth = 0): string | undefined {
  if (!isObject(args) || depth > 2) return undefined;
  for (const key of COMPANY_KEYS) {
    const v = args[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  for (const v of Object.values(args)) {
    const found = companyOf(v, depth + 1);
    if (found) return found;
  }
  return undefined;
}

/** Xero files bills as invoices of type ACCPAY: name them bills. */
export function refineEntity(entity: string, args: unknown, depth = 0): string {
  if (!/invoice/.test(entity) || depth > 3) return entity;
  if (Array.isArray(args)) {
    for (const v of args) {
      const r = refineEntity(entity, v, depth + 1);
      if (r !== entity) return r;
    }
    return entity;
  }
  if (!isObject(args)) return entity;
  if (args.type === "ACCPAY" || args.Type === "ACCPAY") return entity.replace("invoice", "bill");
  for (const v of Object.values(args)) {
    if (typeof v !== "object" || v === null) continue;
    const r = refineEntity(entity, v, depth + 1);
    if (r !== entity) return r;
  }
  return entity;
}

function classifyMcp(client: Client, input: HookInput, ctx: ClassifyContext): Classification {
  const toolName = input.tool_name ?? "";
  const split = splitMcpName(client, toolName, str(input.mcp_context?.server_name));
  if (!split) return { kind: "pass", why: "not an MCP tool" };
  const { server, tool } = split;
  const args = input.tool_input ?? {};
  if (anyGlob(tool, ctx.rules.pass_tools) || anyGlob(toolName, ctx.rules.pass_tools))
    return { kind: "pass", why: `pass_tools in rules.json` };
  const onLedger = isLedgerServer(server, ctx.rules);
  const ruleHold = anyGlob(tool, ctx.rules.hold_tools) ?? anyGlob(toolName, ctx.rules.hold_tools);
  const verdict = judgeTool(tool, onLedger || ruleHold !== undefined);
  if (ruleHold) {
    const family = pickFamily(server, tool);
    return {
      kind: "ledger-write",
      ledger: ledgerFor(server, tool, family),
      via: "mcp",
      server,
      tool,
      family,
      op: verdict?.kind === "write" ? verdict.op : "unknown",
      entity: verdict?.entity ?? "record",
      company: companyOf(args),
      args,
      why: `hold_tools "${ruleHold}" in rules.json`,
    };
  }
  if (!verdict) return { kind: "pass", why: `${server} is not a QuickBooks or Xero server` };
  const family = verdict.catalogued ? pickFamily(server, tool) : undefined;
  const ledger = ledgerFor(server, tool, family);
  if (verdict.kind === "read")
    return {
      kind: "read",
      ledger,
      server,
      tool,
      why: verdict.catalogued ? `a read of ${familiesText(tool, family)}` : "a read",
    };
  const write = (why: string): LedgerWrite => ({
    kind: "ledger-write",
    ledger,
    via: "mcp",
    server,
    tool,
    family,
    op: verdict.op,
    entity: refineEntity(verdict.entity, args),
    company: companyOf(args),
    args,
    why,
  });
  const catalogued = `a write tool of ${familiesText(tool, family)}`;
  if (onLedger)
    return write(
      verdict.catalogued
        ? catalogued
        : `a tool on a ${ledger} server that booksguard has not catalogued and that does not read, held until it is`,
    );
  if (!verdict.generic) return write(catalogued);
  if (OPAQUE.test(server))
    return write(
      `${catalogued}, on a connector whose name the harness does not show (${server.slice(0, 8)}…)`,
    );
  return {
    kind: "pass",
    why: `${tool} on ${server}, which is not a QuickBooks or Xero server`,
  };
}

/** "Intuit's QuickBooks Online MCP server", or every family that has the name. */
function familiesText(tool: string, family?: ServerFamily): string {
  if (family) return family.label;
  const labels = FAMILIES.filter((f) => f.writes.includes(tool) || f.reads.includes(tool)).map(
    (f) => f.label,
  );
  return labels.length ? labels.join(" or ") : "a QuickBooks or Xero server";
}

// ---------------------------------------------------------------------------------------------
// REST calls in shell commands

const QBO_HOSTS = ["quickbooks.api.intuit.com", "sandbox-quickbooks.api.intuit.com"];
const XERO_HOSTS = ["api.xero.com"];
export const LEDGER_HOSTS = [...QBO_HOSTS, ...XERO_HOSTS];
const HOST_RE =
  /\b(?:sandbox-quickbooks\.api\.intuit\.com|quickbooks\.api\.intuit\.com|api\.xero\.com)\b/i;

const DATA_FLAGS = new Set([
  "-d",
  "--data",
  "--data-raw",
  "--data-binary",
  "--data-ascii",
  "--data-urlencode",
  "--json",
  "-F",
  "--form",
  "--form-string",
]);

interface HttpCall {
  method: string;
  url: URL;
  body?: string;
  headers: Record<string, string>;
}

function flagValue(argv: string[], i: number): { value?: string; skip: number } {
  const a = argv[i]!;
  const eq = a.indexOf("=");
  if (a.startsWith("--") && eq > 0) return { value: a.slice(eq + 1), skip: 0 };
  return { value: argv[i + 1], skip: 1 };
}

function parseUrl(word: string): URL | undefined {
  if (!/^https?:\/\//i.test(word)) return undefined;
  try {
    return new URL(word);
  } catch {
    return undefined;
  }
}

/** One `curl`, `wget`, `http`, `https` or `xh` command → the request it makes, when its URL is literal. */
export function httpCallOf(cmd: SimpleCommand): HttpCall | undefined {
  const argv = cmd.argv;
  const bin = path.basename(argv[0] ?? "");
  const headers: Record<string, string> = {};
  let method: string | undefined;
  let body: string | undefined;
  let url: URL | undefined;
  const header = (h: string | undefined) => {
    if (!h) return;
    const c = h.indexOf(":");
    if (c > 0) headers[h.slice(0, c).trim().toLowerCase()] = h.slice(c + 1).trim();
  };
  if (bin === "curl") {
    for (let i = 1; i < argv.length; i += 1) {
      const a = argv[i]!;
      if (a === "-X" || a === "--request" || a.startsWith("--request=")) {
        const { value, skip } = flagValue(argv, i);
        method = value?.toUpperCase();
        i += skip;
      } else if (/^-X[A-Za-z]+$/.test(a)) method = a.slice(2).toUpperCase();
      else if (a === "-H" || a === "--header" || a.startsWith("--header=")) {
        const { value, skip } = flagValue(argv, i);
        header(value);
        i += skip;
      } else if (a === "-T" || a === "--upload-file") {
        method ??= "PUT";
        i += 1;
      } else if (a === "-I" || a === "--head") method ??= "HEAD";
      else if (a === "-G" || a === "--get") method = "GET";
      else if (DATA_FLAGS.has(a.split("=")[0]!)) {
        const { value, skip } = flagValue(argv, i);
        body ??= value;
        i += skip;
      } else if (a === "--url") {
        url ??= parseUrl(argv[i + 1] ?? "");
        i += 1;
      } else url ??= parseUrl(a);
    }
    if (!method) method = body !== undefined ? "POST" : "GET";
  } else if (bin === "wget") {
    for (let i = 1; i < argv.length; i += 1) {
      const a = argv[i]!;
      if (a.startsWith("--method=")) method = a.slice(9).toUpperCase();
      else if (a.startsWith("--post-data=") || a.startsWith("--body-data=")) {
        body = a.slice(a.indexOf("=") + 1);
        method ??= "POST";
      } else if (a.startsWith("--post-file=") || a.startsWith("--body-file=")) method ??= "POST";
      else if (a.startsWith("--header=")) header(a.slice(9));
      else url ??= parseUrl(a);
    }
    method ??= "GET";
  } else if (bin === "http" || bin === "https" || bin === "xh" || bin === "xhs") {
    const rest = argv.slice(1).filter((a) => !a.startsWith("-"));
    if (rest[0] && /^(GET|POST|PUT|PATCH|DELETE|HEAD)$/i.test(rest[0])) {
      method = rest.shift()!.toUpperCase();
    }
    const target = rest.shift();
    if (target) url = parseUrl(target) ?? parseUrl(`https://${target}`);
    const items = rest.filter((a) => /^[^=:]+(:=|=|@)/.test(a) || /^[\w-]+:/.test(a));
    for (const item of items) if (/^[\w-]+:[^=]/.test(item)) header(item);
    const data = items.filter((a) => /^[^=:]+(:=|=)/.test(a));
    if (data.length > 0) body = JSON.stringify(Object.fromEntries(data.map((d) => d.split(/:?=/))));
    method ??= data.length > 0 ? "POST" : "GET";
  } else return undefined;
  if (!url) return undefined;
  return { method: method ?? "GET", url, body, headers };
}

function parseBody(body: string | undefined): unknown {
  if (body === undefined) return undefined;
  if (body.startsWith("@"))
    return { body_file: body.slice(1), note: "read from a file; not opened" };
  try {
    return JSON.parse(body);
  } catch {
    return { body: body.length > 200 ? `${body.slice(0, 200)}…` : body };
  }
}

/** A REST call against a ledger API → read or write, the entity and the company. */
export function judgeRest(call: HttpCall): Classification | undefined {
  const host = call.url.hostname.toLowerCase();
  const method = call.method;
  const read = method === "GET" || method === "HEAD" || method === "OPTIONS";
  if (QBO_HOSTS.includes(host)) {
    const m = /\/v3\/company\/([^/]+)\/([^/?]+)(?:\/([^/?]+))?(?:\/([^/?]+))?/i.exec(
      call.url.pathname,
    );
    const realm = m?.[1];
    const entity = (m?.[2] ?? "").toLowerCase();
    const tool = `${method} ${call.url.pathname}${call.url.search}`;
    if (read || entity === "query" || entity === "reports" || entity === "cdc")
      return { kind: "read", ledger: "QuickBooks", server: host, tool, why: `a ${method} read` };
    const operation = call.url.searchParams.get("operation")?.toLowerCase();
    const args = parseBody(call.body);
    // QuickBooks updates are a POST of the entity with its Id (and SyncToken)
    const hasId =
      isObject(args) && ("Id" in args || Object.values(args).some((v) => isObject(v) && "Id" in v));
    let op: Op = operation === "delete" ? "delete" : operation === "void" ? "void" : "create";
    if (operation === "update" || (op === "create" && hasId)) op = "update";
    if (m?.[4] === "send" || m?.[3] === "send") op = "send";
    if (entity === "batch") op = "batch";
    if (entity === "upload") op = "upload";
    return {
      kind: "ledger-write",
      ledger: "QuickBooks",
      via: "rest",
      server: host,
      tool,
      op,
      entity: entity.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase() || "record",
      company: realm,
      args: args ?? { body: "none on the command line" },
      why: `a ${method} to the QuickBooks Accounting API`,
    };
  }
  if (XERO_HOSTS.includes(host)) {
    const tool = `${method} ${call.url.pathname}`;
    if (read) return { kind: "read", ledger: "Xero", server: host, tool, why: `a ${method} read` };
    const m = /\/[a-z]+\.xro\/[\d.]+\/([^/?]+)(?:\/([^/?]+))?/i.exec(call.url.pathname);
    const entity = (m?.[1] ?? "record")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .replace(/s$/, "");
    const op: Op =
      method === "DELETE" ? "delete" : method === "PUT" ? "create" : m?.[2] ? "update" : "create";
    return {
      kind: "ledger-write",
      ledger: "Xero",
      via: "rest",
      server: host,
      tool,
      op,
      entity: refineEntity(entity, parseBody(call.body)),
      company: call.headers["xero-tenant-id"],
      args: parseBody(call.body) ?? { body: "none on the command line" },
      why: `a ${method} to Xero's API`,
    };
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// booksguard itself, and the hook settings

const READ_ONLY_BINS = new Set([
  "cat",
  "head",
  "tail",
  "less",
  "more",
  "ls",
  "wc",
  "grep",
  "rg",
  "jq",
  "shasum",
  "sha256sum",
  "stat",
  "file",
  "diff",
  "tree",
  "find",
]);

/** Settings files that hold a harness's hooks, project and user level. */
export function hookSettingsFiles(cwd: string, home: string, env: NodeJS.ProcessEnv): string[] {
  const out: string[] = [];
  for (const root of [cwd, home]) {
    if (!root) continue;
    out.push(
      path.join(root, ".claude", "settings.json"),
      path.join(root, ".claude", "settings.local.json"),
      path.join(root, ".codex", "hooks.json"),
      path.join(root, ".codex", "config.toml"),
      path.join(root, ".gemini", "settings.json"),
    );
  }
  const claudeDir = env.CLAUDE_CONFIG_DIR?.split(",")[0]?.trim();
  if (claudeDir) out.push(path.join(path.resolve(claudeDir), "settings.json"));
  if (env.CODEX_HOME) out.push(path.join(path.resolve(env.CODEX_HOME), "hooks.json"));
  return [...new Set(out.map((p) => path.resolve(p)))];
}

const EDIT_TOOLS: Record<Client, ReadonlySet<string>> = {
  claude: new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]),
  codex: new Set(["apply_patch"]),
  gemini: new Set(["write_file", "replace"]),
};
const SHELL_TOOLS: Record<Client, ReadonlySet<string>> = {
  claude: new Set(["Bash", "PowerShell"]),
  codex: new Set(["Bash", "exec_command", "shell"]),
  gemini: new Set(["run_shell_command"]),
};

function editPaths(client: Client, tool: string, input: Json, cwd: string): string[] {
  if (client === "codex" && tool === "apply_patch") {
    const patch = str(input.command) ?? str(input.input) ?? str(input.patch) ?? "";
    const out: string[] = [];
    for (const line of patch.split("\n")) {
      const m = /^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/.exec(line.trim());
      if (m) out.push(path.resolve(cwd, m[1]!.trim()));
    }
    return out;
  }
  const p =
    str(input.file_path) ?? str(input.notebook_path) ?? str(input.absolute_path) ?? str(input.path);
  return p ? [path.resolve(cwd, p)] : [];
}

const within = (p: string, dir: string): boolean => p === dir || p.startsWith(dir + path.sep);

function shellCommandOf(client: Client, input: Json): string {
  const raw = input.command ?? input.cmd;
  if (Array.isArray(raw)) return raw.map(String).join(" ");
  return str(raw) ?? "";
}

/** The agent running `booksguard approve` or `uninstall`, under any spelling of the command. */
function selfApproval(cmds: SimpleCommand[]): string | undefined {
  for (const cmd of cmds) {
    const i = cmd.argv.findIndex(
      (a) => /booksguard(?:@[\w.^~-]+)?$/.test(a) || /booksguard\/dist\/cli\.js$/.test(a),
    );
    if (i < 0) continue;
    const verb = cmd.argv.slice(i + 1).find((a) => !a.startsWith("-"));
    if (verb === "approve" || verb === "uninstall") return verb;
  }
  return undefined;
}

function classifyShell(
  client: Client,
  input: Json,
  cwd: string,
  ctx: ClassifyContext,
): Classification {
  const command = shellCommandOf(client, input);
  if (!command.trim()) return { kind: "pass", why: "empty command" };
  const cmds = parseShell(command, { cwd, home: ctx.home });
  const self = selfApproval(cmds);
  if (self)
    return {
      kind: "refuse",
      tool: `booksguard ${self}`,
      why: `an agent may not run \`booksguard ${self}\`: a person approves held writes and removes the hook`,
      fix: "stop and ask the person to run it in their own terminal (in Claude Code they can type `!` and the command); do not try another way",
    };
  const guardDir = path.resolve(ctx.guardDir);
  const mentionsGuardDir =
    command.includes(guardDir) || /(?:^|[\s"'=~/\\])\.booksguard(?:[/\\]|\s|$|["'])/.test(command);
  if (mentionsGuardDir) {
    const readOnly = cmds.every(
      (c) =>
        READ_ONLY_BINS.has(path.basename(c.argv[0] ?? "")) &&
        c.redirects.every((r) => r.op === "<" || r.op === "2>&1" || r.op === ">&2") &&
        !c.argv.includes("-delete") &&
        !c.argv.includes("-exec"),
    );
    if (!readOnly)
      return {
        kind: "refuse",
        tool: "a shell command writing booksguard's home",
        why: "booksguard's home (rules, holds and the audit log) is changed by a person or by booksguard, not by the agent it guards",
        fix: "do not modify it; tell the person what you wanted to change",
      };
  }

  // REST calls
  const touchesHost = HOST_RE.test(command);
  if (touchesHost) {
    let firstWrite: Classification | undefined;
    let sawRead: Classification | undefined;
    let unread = false;
    for (const cmd of cmds) {
      const text = cmd.argv.join(" ");
      if (!HOST_RE.test(text)) continue;
      const call = httpCallOf(cmd);
      const verdict = call ? judgeRest(call) : undefined;
      if (!verdict) unread = true;
      else if (verdict.kind === "read") sawRead ??= verdict;
      else firstWrite ??= verdict;
    }
    if (firstWrite) return firstWrite;
    if (unread || !sawRead) {
      const host = HOST_RE.exec(command)![0].toLowerCase();
      return {
        kind: "ledger-write",
        ledger: /xero/.test(host) ? "Xero" : "QuickBooks",
        via: "rest",
        server: host,
        tool: command.replace(/\s+/g, " ").trim().slice(0, 120),
        op: "unknown",
        entity: "request",
        args: { command: command.length > 400 ? `${command.slice(0, 400)}…` : command },
        why: `a command naming ${host} that booksguard cannot read as a plain GET`,
      };
    }
    return sawRead;
  }

  // the hook settings, written by a shell command
  const settings = hookSettingsFiles(cwd, ctx.home, ctx.env);
  const named = settings.find(
    (f) => command.includes(f) || command.includes(f.replace(ctx.home, "~")),
  );
  if (named) {
    const readOnly = cmds.every(
      (c) =>
        READ_ONLY_BINS.has(path.basename(c.argv[0] ?? "")) &&
        c.redirects.every((r) => r.op === "<" || r.op === "2>&1" || r.op === ">&2"),
    );
    if (!readOnly)
      return {
        kind: "guard-config",
        tool: SHELL_TOOLS[client].values().next().value ?? "shell",
        target: named,
        why: "a shell command that may change a harness's hook settings, where booksguard's hook lives",
      };
  }
  return { kind: "pass", why: "a shell command that touches no ledger" };
}

/** Classify one hook input. Never throws. */
export function classify(client: Client, input: HookInput, ctx: ClassifyContext): Classification {
  const tool = input.tool_name ?? "";
  const toolInput = isObject(input.tool_input) ? input.tool_input : {};
  const cwd = path.resolve(input.cwd || process.cwd());
  if (/^mcp_/.test(tool)) return classifyMcp(client, input, ctx);
  if (SHELL_TOOLS[client].has(tool)) return classifyShell(client, toolInput, cwd, ctx);
  if (EDIT_TOOLS[client].has(tool)) {
    const paths = editPaths(client, tool, toolInput, cwd);
    const guardDir = path.resolve(ctx.guardDir);
    const intoGuard = paths.find((p) => within(p, guardDir));
    if (intoGuard)
      return {
        kind: "refuse",
        tool,
        why: `booksguard's home (${intoGuard}) is changed by a person or by booksguard, not by the agent it guards`,
        fix: "do not modify it; tell the person what you wanted to change",
      };
    const settings = new Set(hookSettingsFiles(cwd, ctx.home, ctx.env));
    const hit = paths.find((p) => settings.has(p));
    if (hit)
      return {
        kind: "guard-config",
        tool,
        target: hit,
        why: "an edit of a harness's hook settings, where booksguard's hook lives",
      };
    return { kind: "pass", why: "an edit outside booksguard's concern" };
  }
  return { kind: "pass", why: `${tool || "this tool"} is not booksguard's concern` };
}
