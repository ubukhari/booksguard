/**
 * `booksguard mcp`: a local MCP server over stdio with three read-only tools, so an agent can ask
 * what booksguard would hold, what is waiting for the person, and what AI wrote this month.
 *
 * There is no tool that approves, denies or changes anything, by design: approval is the person's
 * own message or their terminal, never the agent's call.
 *
 * Implemented here rather than on the MCP SDK so the package has one runtime dependency. It speaks
 * the initialize-based protocol revisions (2025-11-25, 2025-06-18, 2025-03-26, 2024-11-05):
 * newline-delimited JSON-RPC on stdin/stdout, `initialize`, `ping`, `tools/list`, `tools/call`.
 * Any other method answers -32601. Nothing but protocol goes to stdout.
 */
import path from "node:path";
import { createInterface } from "node:readline";
import { readLog, summarize } from "./audit.js";
import { classify, type Client } from "./classify.js";
import { renderDiff } from "./diff.js";
import { HoldStore } from "./holds.js";
import { INSTALL } from "./install.js";
import { readRules } from "./rules.js";
import { version } from "./version.js";

export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"] as const;

interface Annotations {
  title: string;
  readOnlyHint: true;
  destructiveHint: false;
  idempotentHint: true;
  openWorldHint: false;
}

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, Record<string, unknown>>;
    required?: string[];
    additionalProperties: false;
  };
  annotations: Annotations;
}

const annotations = (title: string): Annotations => ({
  title,
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

export const TOOLS: readonly ToolDefinition[] = [
  {
    name: "booksguard_check_write",
    title: "Would booksguard hold this call",
    description:
      "Before you call a QuickBooks or Xero tool (or run a curl against their APIs), ask whether booksguard would hold it for the person's approval, and see the dry-run diff it would show: the fields the write sets, line totals, journal debits against credits with any imbalance, and the company it names. Reads the call you describe and booksguard's rules on this machine; calls nothing, writes nothing. A held write is released only by the person: their own message after the hold, or `booksguard approve <id>` in their terminal.",
    inputSchema: {
      type: "object",
      properties: {
        tool_name: {
          type: "string",
          minLength: 1,
          description:
            "The tool exactly as your harness names it, e.g. mcp__quickbooks__create_invoice (Claude Code, Codex), mcp_xero_create-invoice (Gemini CLI), or Bash for a shell command.",
        },
        arguments: {
          type: "object",
          description:
            'The arguments you would pass to that tool; for Bash, { "command": "curl …" }.',
        },
        harness: {
          type: "string",
          enum: ["claude", "codex", "gemini"],
          description: "Which harness names the tool this way. Omitted: claude.",
        },
      },
      required: ["tool_name"],
      additionalProperties: false,
    },
    annotations: annotations("Would booksguard hold this call"),
  },
  {
    name: "booksguard_list_holds",
    title: "Writes waiting for the person",
    description:
      "Lists the QuickBooks and Xero writes booksguard is holding on this machine, newest last: the hold id, when it was made, what it would do, its dry-run diff, and how the person approves it (their own message after the hold, or `booksguard approve <id>` in their terminal). Use it to remind the person what is waiting. Reads booksguard's local state only.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: annotations("Writes waiting for the person"),
  },
  {
    name: "booksguard_month_log",
    title: "What AI wrote to the books this month",
    description:
      "The month's AI writes to QuickBooks and Xero per client, from booksguard's hash-chained local log: how many were held, released (with their total and who approved each: the person's message and its time, or a terminal approve), still waiting, or refused. A client is the company the call named, else the folder the agent ran in. Reads the local log only.",
    inputSchema: {
      type: "object",
      properties: {
        month: {
          type: "string",
          pattern: "^\\d{4}-(0[1-9]|1[0-2])$",
          description: "YYYY-MM. Omitted: the current month (UTC).",
        },
        company: {
          type: "string",
          minLength: 1,
          description: "Only clients whose name or company id contains this text.",
        },
      },
      additionalProperties: false,
    },
    annotations: annotations("What AI wrote to the books this month"),
  },
];

export interface McpContext {
  home: string;
  guardDir: string;
  env: NodeJS.ProcessEnv;
  cwd: string;
  now: () => number;
}

interface ToolError {
  code: string;
  cause: string;
  fix: string;
  retryable: boolean;
}

class InvalidInput extends Error {
  constructor(
    readonly cause_: string,
    readonly fix: string,
  ) {
    super(cause_);
  }
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

function strictArgs(name: string, args: unknown): Json {
  const tool = TOOLS.find((t) => t.name === name)!;
  if (args === undefined || args === null) args = {};
  if (!isObject(args)) throw new InvalidInput("arguments must be an object", "Pass a JSON object.");
  for (const k of Object.keys(args))
    if (!tool.inputSchema.properties[k])
      throw new InvalidInput(
        `unknown argument \`${k}\``,
        `Use only: ${Object.keys(tool.inputSchema.properties).join(", ") || "no arguments"}.`,
      );
  for (const k of tool.inputSchema.required ?? [])
    if (args[k] === undefined) throw new InvalidInput(`\`${k}\` is required`, `Pass ${k}.`);
  return args;
}

export function callTool(
  name: string,
  rawArgs: unknown,
  ctx: McpContext,
): { structured: Record<string, unknown>; isError: boolean } {
  try {
    const args = strictArgs(name, rawArgs);
    if (name === "booksguard_check_write") {
      if (typeof args.tool_name !== "string" || !args.tool_name.trim())
        throw new InvalidInput(
          "`tool_name` must be a non-empty string",
          "Pass the tool's full name.",
        );
      if (args.arguments !== undefined && !isObject(args.arguments))
        throw new InvalidInput(
          "`arguments` must be an object",
          "Pass the tool's arguments as an object.",
        );
      const harness = (args.harness ?? "claude") as Client;
      if (!["claude", "codex", "gemini"].includes(harness))
        throw new InvalidInput(
          "`harness` must be claude, codex or gemini",
          "Omit it for Claude Code.",
        );
      const { rules } = readRules(ctx.guardDir);
      const cls = classify(
        harness,
        { tool_name: args.tool_name, tool_input: args.arguments ?? {}, cwd: ctx.cwd },
        { rules, home: ctx.home, guardDir: ctx.guardDir, env: ctx.env },
      );
      if (cls.kind === "pass" || cls.kind === "read")
        return {
          structured: { held: false, kind: cls.kind, why: cls.why, mode: rules.mode },
          isError: false,
        };
      if (cls.kind === "refuse")
        return {
          structured: { held: false, refused: true, why: cls.why, fix: cls.fix },
          isError: false,
        };
      const diff = renderDiff(cls);
      return {
        structured: {
          held: rules.mode === "hold",
          mode: rules.mode,
          why: cls.why,
          ledger: cls.kind === "guard-config" ? "booksguard" : cls.ledger,
          what: diff.title,
          diff: diff.lines,
          money: diff.money,
          company: cls.kind === "guard-config" ? undefined : (cls.company ?? null),
          approve:
            harness === "claude"
              ? "the person's own message after the hold, or `booksguard approve <id>` in their terminal"
              : "`booksguard approve <id>` in the person's terminal",
        },
        isError: false,
      };
    }
    if (name === "booksguard_list_holds") {
      const holds = new HoldStore(ctx.guardDir).pending(ctx.now());
      return {
        structured: {
          holds: holds.map((h) => ({
            id: h.id,
            created_at: h.created_at,
            status: h.status,
            what: h.title,
            folder: h.folder,
            diff: h.diff,
            duplicate_of: h.duplicate_of ?? null,
            approve_in_terminal: `${INSTALL} approve ${h.id}`,
          })),
          count: holds.length,
        },
        isError: false,
      };
    }
    if (name === "booksguard_month_log") {
      const month =
        typeof args.month === "string" ? args.month : new Date(ctx.now()).toISOString().slice(0, 7);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        throw new InvalidInput("`month` must be YYYY-MM", "For October 2026 pass 2026-10.");
      const s = summarize(
        readLog(ctx.guardDir),
        month,
        typeof args.company === "string" ? args.company : undefined,
      );
      return {
        structured: {
          month: s.month,
          clients: s.clients.map((c) => ({
            client: c.client,
            held: c.held,
            released: c.released,
            released_total: c.released_total,
            still_waiting: c.waiting,
            refused: c.refused,
            writes: c.rows
              .filter((r) => r.event !== "still-held")
              .map((r) => ({
                at: r.ts,
                event: r.event,
                what: r.title,
                hold: r.hold ?? null,
                approved_by: r.approved_by ?? null,
              })),
          })),
          log: path.join(ctx.guardDir, "audit.jsonl"),
        },
        isError: false,
      };
    }
    throw new Error(`unknown tool ${name}`);
  } catch (err) {
    const body: ToolError =
      err instanceof InvalidInput
        ? { code: "INVALID_INPUT", cause: err.cause_, fix: err.fix, retryable: false }
        : {
            code: "INTERNAL",
            cause: err instanceof Error ? err.message : String(err),
            fix: "Run `booksguard status` in a terminal to see booksguard's state, and report the error at https://github.com/agentwares/booksguard/issues.",
            retryable: false,
          };
    return { structured: { ...body }, isError: true };
  }
}

const INSTRUCTIONS =
  "booksguard holds every AI write to QuickBooks and Xero until the person approves it, and keeps a per-client log of what was written and who said yes. These tools only read: ask what would be held (booksguard_check_write), what is waiting (booksguard_list_holds) and what was written this month (booksguard_month_log). Nothing here approves a write; only the person does, in their own message or their terminal.";

interface Request {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
}

export function handleMessage(msg: unknown, ctx: McpContext): unknown {
  if (Array.isArray(msg)) {
    const out = msg.map((m) => handleMessage(m, ctx)).filter((r) => r !== undefined);
    return out.length ? out : undefined;
  }
  const req = (msg && typeof msg === "object" ? msg : {}) as Request;
  const hasId = "id" in req && (typeof req.id === "string" || typeof req.id === "number");
  const id = hasId ? req.id : null;
  const error = (code: number, message: string) => ({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
  if (!("method" in req) && ("result" in req || "error" in req)) return undefined;
  if (req.jsonrpc !== "2.0" || typeof req.method !== "string")
    return hasId || !("method" in req) ? error(-32600, "Invalid Request") : undefined;
  if (!hasId) return undefined;
  const params = (isObject(req.params) ? req.params : {}) as Json;
  switch (req.method) {
    case "initialize": {
      const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      const protocolVersion = (PROTOCOL_VERSIONS as readonly string[]).includes(asked)
        ? asked
        : PROTOCOL_VERSIONS[0];
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "booksguard", title: "booksguard", version: version() },
          instructions: INSTRUCTIONS,
        },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
    case "tools/call": {
      const name = params.name;
      if (typeof name !== "string" || !TOOLS.some((t) => t.name === name))
        return error(
          -32602,
          `Unknown tool: ${String(name)}. Tools: ${TOOLS.map((t) => t.name).join(", ")}`,
        );
      const { structured, isError } = callTool(name, params.arguments, ctx);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(structured) }],
          structuredContent: structured,
          isError,
        },
      };
    }
    default:
      return error(-32601, `Method not found: ${req.method}`);
  }
}

/** Serve on stdin/stdout until stdin closes. */
export async function serveStdio(ctx: McpContext): Promise<void> {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let msg: unknown;
    try {
      msg = JSON.parse(line);
    } catch {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        }) + "\n",
      );
      continue;
    }
    try {
      const res = handleMessage(msg, ctx);
      if (res !== undefined) process.stdout.write(JSON.stringify(res) + "\n");
    } catch (err) {
      process.stderr.write(`booksguard mcp: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }
}
