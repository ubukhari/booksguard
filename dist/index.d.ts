import * as _agentwares_agentguard_core from '@agentwares/agentguard-core';
import { SimpleCommand, HumanTurn, GuardErrorBody } from '@agentwares/agentguard-core';

/**
 * The QuickBooks and Xero MCP servers booksguard knows, and every tool each one exposes, read from
 * public sources on 9 October 2026. A tool listed under `writes` changes the books (or sends
 * something from them) and is held until a person approves it; a tool under `reads` passes.
 *
 * Sources, all read 9 Oct 2026:
 * - Intuit QuickBooks (hosted connector in Claude's directory): the tool list in the page data of
 *   https://claude.com/connectors/intuit-quickbooks — MCP URL https://ai-inc.quickbooks.intuit.com/v1/mcp,
 *   74 tools.
 * - Intuit's open-source server: https://github.com/intuit/quickbooks-online-mcp-server at commit
 *   31a1dd5c3e17 (15 Sep 2026), `src/tools/*.tool.ts` (the `toolName` of each, 142 files) and
 *   `src/helpers/register-tool.ts` (create_/update_/delete_ prefixes, hyphen or underscore, are its
 *   own write categories; `QUICKBOOKS_DISABLE_WRITE/UPDATE/DELETE` remove them).
 * - Meridian Connector for QuickBooks (Pilot): the tool list in the page data of
 *   https://claude.com/connectors/meridian-connector-for-quickbooks — MCP URL
 *   https://qbo-connector.meridian.pilot.com/mcp, 63 tools.
 * - Xero (hosted): https://mcp.xero.com/mcp, read-only at launch ("read only and session only",
 *   https://www.xero.com/ai-in-accounting/claude/). It has no write tools to list; any tool on a
 *   Xero server that is not a read is held.
 * - Xero's open-source server: https://github.com/XeroAPI/xero-mcp-server at commit f24583c867df
 *   (5 Jun 2026), `src/tools/{create,update,delete,get,list}/*.tool.ts` (50 tools), npm
 *   `@xeroapi/xero-mcp-server`.
 */
type Ledger = "QuickBooks" | "Xero";
type FamilyId = "intuit-hosted" | "intuit-local" | "meridian" | "xero-hosted" | "xero-local";
interface ServerFamily {
    id: FamilyId;
    ledger: Ledger;
    label: string;
    /** where the server runs: an MCP URL, or the repo of a local server */
    where: string;
    /** where the tool names were read */
    source: string;
    read: string;
    writes: readonly string[];
    reads: readonly string[];
}
declare const FAMILIES: readonly ServerFamily[];
/**
 * Names other kinds of server use too (Stripe has `create_invoice` and `create_customer`). On a
 * server whose name says nothing about a ledger they pass; on a ledger server, or on a connector
 * whose server id is opaque, they are held. Every other catalogued write is distinctive enough to
 * hold on any server.
 */
declare const GENERIC_WRITES: ReadonlySet<string>;
type Op = "create" | "update" | "delete" | "void" | "send" | "import" | "upload" | "batch" | "approve" | "revert" | "unknown";
interface ToolVerdict {
    kind: "read" | "write";
    op: Op;
    /** what the write touches, in words: "invoice", "journal entry" */
    entity: string;
    family?: ServerFamily;
    /** listed by a family (rather than judged from the name) */
    catalogued: boolean;
    /** catalogued and also used by other kinds of server */
    generic: boolean;
}
/** `qbo_sales_create_invoice` → ["create", "invoice"]; `create-manual-journal` → ["create", "manual journal"]. */
declare function verbAndEntity(name: string): {
    verb: string;
    entity: string;
};
/**
 * What a tool name does to the books. `onLedger` says whether the server is known to be a
 * QuickBooks or Xero server; off a ledger server, a name booksguard has not catalogued is not its
 * business (undefined).
 */
declare function judgeTool(name: string, onLedger: boolean): ToolVerdict | undefined;
/** "154 write tools across 4 servers, read 9 Oct 2026", for --help and the README. */
declare const CATALOG_SUMMARY: string;

interface Rules {
    version: 1;
    /** hold: every ledger write waits for a yes. watch: nothing is held; each would-be hold is logged. */
    mode: "hold" | "watch";
    /** how old the person's approving message may be */
    approval_window_minutes: number;
    /** a write identical to one released this recently is flagged in its diff */
    duplicate_window_hours: number;
    /**
     * MCP server names that are QuickBooks or Xero servers, beyond the names that say so
     * (quickbooks, qbo, intuit, xero, meridian). Exact names or `*` globs; `install` adds the ones it
     * finds in the harnesses' MCP configs.
     */
    ledger_servers: string[];
    /** tool names (or `*` globs) to hold on any server */
    hold_tools: string[];
    /** tool names (or `*` globs) never to hold, e.g. a sandbox company's own server */
    pass_tools: string[];
}
declare const DEFAULT_RULES: Rules;
interface LoadedRules {
    rules: Rules;
    /** why the file was not used, when it exists and could not be */
    problem?: string;
    exists: boolean;
}
declare function readRules(dir: string): LoadedRules;

type Client = "claude" | "codex" | "gemini";
interface HookInput {
    session_id?: string;
    transcript_path?: string;
    cwd?: string;
    tool_name?: string;
    tool_input?: unknown;
    tool_use_id?: string;
    hook_event_name?: string;
    permission_mode?: string;
    turn_id?: string;
    mcp_context?: {
        server_name?: string;
        [k: string]: unknown;
    };
}
interface LedgerWrite {
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
interface GuardConfigWrite {
    kind: "guard-config";
    tool: string;
    target: string;
    why: string;
}
type Classification = {
    kind: "pass";
    why: string;
} | {
    kind: "read";
    ledger: Ledger;
    server: string;
    tool: string;
    why: string;
} | LedgerWrite | GuardConfigWrite | {
    kind: "refuse";
    tool: string;
    why: string;
    fix: string;
};
interface ClassifyContext {
    rules: Rules;
    home: string;
    /** booksguard's home: the agent may not write into it */
    guardDir: string;
    env: NodeJS.ProcessEnv;
}
/** `mcp__srv__tool` (Claude Code, Codex) or `mcp_srv_tool` (Gemini CLI) → server and bare name. */
declare function splitMcpName(client: Client, toolName: string, serverHint?: string): {
    server: string;
    tool: string;
} | undefined;
/** The QuickBooks realm or Xero tenant a call names, searched two levels deep. */
declare function companyOf(args: unknown, depth?: number): string | undefined;
interface HttpCall {
    method: string;
    url: URL;
    body?: string;
    headers: Record<string, string>;
}
/** One `curl`, `wget`, `http`, `https` or `xh` command → the request it makes, when its URL is literal. */
declare function httpCallOf(cmd: SimpleCommand): HttpCall | undefined;
/** A REST call against a ledger API → read or write, the entity and the company. */
declare function judgeRest(call: HttpCall): Classification | undefined;
/** Classify one hook input. Never throws. */
declare function classify(client: Client, input: HookInput, ctx: ClassifyContext): Classification;

/**
 * The dry-run diff: what a held write would create, change or delete, read from the call's own
 * arguments. booksguard never calls QuickBooks or Xero, so an update shows the fields it would set,
 * not the values they replace.
 *
 * Money is added up where the arguments carry it:
 * - lines (`Line`, `line_items`, `lineItems`, `manualJournalLines`, `lines`) by `Amount`/`amount`/
 *   `lineAmount`, or quantity × unit price (`qty`·`unit_price`, `Qty`·`UnitPrice` in a line
 *   detail, `quantity`·`unitAmount`);
 * - journal entries by debit and credit: QuickBooks' `JournalEntryLineDetail.PostingType`, a
 *   `posting_type`, `debit`/`credit` fields, or Xero's signed `lineAmount` (debits positive);
 * - otherwise a top-level `total_amt`, `TotalAmt`, `total`, `amount` or `Amount`.
 */

interface Money {
    total?: number;
    lines?: number;
    debits?: number;
    credits?: number;
    balanced?: boolean;
    currency?: string;
}
interface Diff {
    /** one line: what, where */
    title: string;
    /** the diff itself, prefixed + (adds), ~ (sets), - (removes), → (sends) */
    lines: string[];
    money: Money;
    /** the record an update, delete or void names */
    target?: string;
}
declare function moneyOf(args: unknown): Money;
declare function renderDiff(w: LedgerWrite | GuardConfigWrite): Diff;

type HoldStatus = "held" | "approved" | "released" | "denied";
interface Hold {
    id: string;
    created_at: string;
    identity: string;
    status: HoldStatus;
    client: Client;
    session?: string;
    tool_use_id?: string;
    /** the tool name as the harness sent it */
    tool_name: string;
    tool: string;
    server: string;
    ledger: Ledger | "booksguard";
    op: Op | "guard-config";
    entity: string;
    company?: string;
    folder: string;
    title: string;
    diff: string[];
    money: Money;
    duplicate_of?: {
        id: string;
        released_at: string;
    };
    approved_at?: string;
    /** "terminal", or the person's message: "message at 14:02 (“yes, post it”)" */
    approved_by?: string;
    released_at?: string;
    released_tool_use_id?: string;
}
declare class HoldStore {
    readonly dir: string;
    constructor(guardDir: string);
    private file;
    /** Run `fn` with the holds directory locked. */
    locked<T>(fn: () => T): T;
    get(id: string): Hold | undefined;
    put(hold: Hold): void;
    all(): Hold[];
    /** The open hold (waiting or approved, not expired) for this exact call. */
    open(identity: string, now: number): Hold | undefined;
    /** Holds still waiting for a person, newest last. */
    pending(now: number): Hold[];
    /** The latest release of this exact call inside the window. */
    lastRelease(identity: string, now: number, windowMs: number): Hold | undefined;
    /** The release that answered this very tool call (a second hook on the same call). */
    releasedFor(identity: string, toolUseId: string | undefined): Hold | undefined;
}

interface TurnEvidence {
    turn?: HumanTurn;
    missing?: string;
}
/** The latest message a person typed, from the end of the transcript (widening if needed). */
declare function latestHumanTurn(file: string | undefined): TurnEvidence;
interface ApprovalVerdict {
    ok: boolean;
    reason: string;
    /** "message at 14:02 (“yes, post it”)" */
    by?: string;
    at?: string;
}
declare function approvalFromTurn(evidence: TurnEvidence, hold: Pick<Hold, "id" | "entity" | "ledger" | "created_at">, now: number, windowMinutes: number): ApprovalVerdict;

interface Ctx {
    env: NodeJS.ProcessEnv;
    home: string;
    /** booksguard's home: rules, holds, audit log */
    guardDir: string;
    cwd: string;
    now: () => number;
}
interface HookAnswer {
    /** what the hook prints (empty: no opinion, the harness decides) */
    stdout: string;
    code: number;
    decision: "allow" | "deny";
    body?: GuardErrorBody;
    hold?: Hold;
}
declare function runHook(client: Client, stdin: string, ctx: Ctx): Promise<HookAnswer>;
/** A person's terminal: approve or deny a hold. Returns what changed, for the CLI to print. */
declare function decideHold(ctx: Ctx, id: string, decision: "approve" | "deny"): {
    ok: boolean;
    message: string;
    hold?: Hold;
};

type Event = "held" | "released" | "still-held" | "refused" | "would-hold" | "killed";
interface LogRow {
    ts: string;
    event: Event;
    client: string;
    hold?: string;
    ledger: string;
    company?: string;
    folder: string;
    title: string;
    total?: number;
    approved_by?: string;
    hash: string;
}
/** booksguard's own entries, oldest first. */
declare function readLog(guardDir: string): LogRow[];
declare const verifyLog: (guardDir: string) => Promise<_agentwares_agentguard_core.VerifyResult>;
interface MonthSummary {
    month: string;
    clients: {
        client: string;
        held: number;
        released: number;
        refused: number;
        waiting: number;
        released_total: number;
        rows: LogRow[];
    }[];
}
/** The month's AI writes per client: what was held, released (and its total) and refused. */
declare function summarize(rows: LogRow[], month: string, company?: string): MonthSummary;
declare function toCsv(rows: LogRow[]): string;

declare const NAME = "booksguard";
declare const REPO = "https://github.com/agentwares/booksguard";
/** What a person types. */
declare const INSTALL: string;
/** What an agent or a plugin hook runs unattended: no install prompt. */
declare const RUN: string;

interface Io {
    out: {
        write(chunk: string): unknown;
        isTTY?: boolean;
    };
    err: {
        write(chunk: string): unknown;
    };
    stdin?: () => Promise<string>;
}
interface MainOptions {
    cliPath?: string;
    execPath?: string;
    ctx?: Partial<Ctx>;
}
declare function main(argv: string[], io: Io, opts?: MainOptions): Promise<number>;

export { type ApprovalVerdict, CATALOG_SUMMARY, type Classification, type Client, type Ctx, DEFAULT_RULES, type Diff, FAMILIES, type FamilyId, GENERIC_WRITES, type Hold, HoldStore, type HookAnswer, type HookInput, INSTALL, type Ledger, type LedgerWrite, type Money, NAME, type Op, REPO, RUN, type Rules, type ServerFamily, type ToolVerdict, approvalFromTurn, classify, companyOf, decideHold, httpCallOf, judgeRest, judgeTool, latestHumanTurn, main, moneyOf, readLog, readRules, renderDiff, runHook, splitMcpName, summarize, toCsv, verbAndEntity, verifyLog };
