/**
 * booksguard's record: `~/.booksguard/audit.jsonl`, in okgate's hash-chained format (each entry
 * carries the previous entry's hash; `booksguard verify` recomputes the chain). One entry per
 * decision:
 *
 * - `pending`: held, with the diff;
 * - `ok`: released, with who approved it (the person's message and its time, or the terminal);
 * - `blocked`: refused (the agent approving itself, writing booksguard's home, the kill switch);
 * - mode `dry-run`: rules.mode "watch", logged and not held.
 *
 * The ledger's own answer is not recorded: the hook runs before the call. The entry's `args`
 * holds booksguard's reading of the call (company, record, amounts, diff), never the raw
 * arguments; `args_hash` fingerprints those.
 */
import {
  sha256Hex,
  stableStringify,
  type AuditEntry,
  type AuditEntryInput,
  type GuardErrorBody,
} from "@agentwares/agentguard-core";
import { FileAuditSink, readAuditFile, verifyAuditFile } from "@agentwares/agentguard-core/node";
import type { Money } from "./diff.js";
import { money as fmt } from "./diff.js";
import type { Hold } from "./holds.js";
import { auditFile } from "./rules.js";

export interface LedgerRecord {
  hold?: string;
  ledger: string;
  server: string;
  tool: string;
  op: string;
  entity: string;
  company?: string;
  folder: string;
  title: string;
  diff?: string[];
  money?: Money;
  duplicate_of?: string;
  approved_by?: string;
}

export type Event = "held" | "released" | "still-held" | "refused" | "would-hold" | "killed";

const OUTCOME: Record<Event, AuditEntryInput["outcome"]> = {
  held: "pending",
  "still-held": "pending",
  released: "ok",
  refused: "blocked",
  killed: "halted",
  "would-hold": "ok",
};

const VERB: Record<string, AuditEntryInput["verb"]> = {
  create: "create",
  import: "create",
  upload: "create",
  batch: "update",
  update: "update",
  approve: "update",
  revert: "update",
  "guard-config": "update",
  delete: "delete",
  void: "delete",
  send: "send",
};

export function recordOf(hold: Hold): LedgerRecord {
  return {
    hold: hold.id,
    ledger: hold.ledger,
    server: hold.server,
    tool: hold.tool,
    op: hold.op,
    entity: hold.entity,
    company: hold.company,
    folder: hold.folder,
    title: hold.title,
    diff: hold.diff,
    money: hold.money,
    duplicate_of: hold.duplicate_of?.id,
    approved_by: hold.approved_by,
  };
}

export interface AppendInput {
  event: Event;
  client: string;
  session?: string;
  toolName: string;
  args: unknown;
  record: LedgerRecord;
  reason: string;
  error?: GuardErrorBody;
  humanTurn?: { ok: boolean; reason: string; at?: string };
  now: number;
}

/** Append one decision. Never throws: a log that cannot be written must not let a write through. */
export async function appendAudit(
  guardDir: string,
  e: AppendInput,
): Promise<AuditEntry | undefined> {
  try {
    const sink = new FileAuditSink(auditFile(guardDir));
    const entry: AuditEntryInput = {
      ts: new Date(e.now).toISOString(),
      run_id: `booksguard_${e.client}_${e.session ?? "unknown"}`,
      agent: "booksguard",
      ...(e.session ? { session_id: e.session } : {}),
      tool: e.toolName,
      class: "write",
      verb: VERB[e.record.op] ?? "unknown",
      mode: e.event === "would-hold" ? "dry-run" : "enforce",
      outcome: OUTCOME[e.event],
      ...(e.error ? { error: e.error } : {}),
      args_hash: await sha256Hex(stableStringify(e.args ?? null)),
      args: { booksguard: e.event, ledger: e.record },
      reason: e.reason,
      hook: {
        client: e.client,
        summary: e.record.title,
        decision: e.event === "released" || e.event === "would-hold" ? "allow" : "deny",
        ...(e.record.hold ? { approval_id: e.record.hold } : {}),
        ...(e.humanTurn ? { human_turn: e.humanTurn } : {}),
      },
    };
    return await sink.append(entry);
  } catch {
    return undefined;
  }
}

export interface LogRow {
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
export function readLog(guardDir: string): LogRow[] {
  const rows: LogRow[] = [];
  for (const e of readAuditFile(auditFile(guardDir))) {
    if (e.agent !== "booksguard") continue;
    const a = e.args as { booksguard?: Event; ledger?: LedgerRecord } | undefined;
    if (!a?.ledger || !a.booksguard) continue;
    rows.push({
      ts: e.ts,
      event: a.booksguard,
      client: e.hook?.client ?? "",
      hold: a.ledger.hold,
      ledger: a.ledger.ledger,
      company: a.ledger.company,
      folder: a.ledger.folder,
      title: a.ledger.title,
      total: a.ledger.money?.total,
      approved_by: a.ledger.approved_by,
      hash: e.hash,
    });
  }
  return rows;
}

export const verifyLog = (guardDir: string) => verifyAuditFile(auditFile(guardDir));

/** The client a row belongs to: the company the call named, else the folder it ran in. */
export const clientOf = (r: Pick<LogRow, "company" | "folder" | "ledger">): string =>
  r.company ? `${r.ledger} ${r.company}` : `folder ${r.folder}`;

export interface MonthSummary {
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
export function summarize(rows: LogRow[], month: string, company?: string): MonthSummary {
  const inMonth = rows.filter((r) => r.ts.startsWith(month));
  const byClient = new Map<string, LogRow[]>();
  for (const r of inMonth) {
    const c = clientOf(r);
    if (company && !c.toLowerCase().includes(company.toLowerCase())) continue;
    byClient.set(c, [...(byClient.get(c) ?? []), r]);
  }
  const releasedHolds = new Set(rows.filter((r) => r.event === "released").map((r) => r.hold));
  return {
    month,
    clients: [...byClient.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([client, list]) => {
        const held = list.filter((r) => r.event === "held");
        const released = list.filter((r) => r.event === "released");
        return {
          client,
          held: held.length,
          released: released.length,
          refused: list.filter((r) => r.event === "refused" || r.event === "killed").length,
          waiting: held.filter((r) => !releasedHolds.has(r.hold)).length,
          released_total: Math.round(released.reduce((n, r) => n + (r.total ?? 0), 0) * 100) / 100,
          rows: list,
        };
      }),
  };
}

const csvCell = (v: unknown): string => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const CSV_HEADER = [
  "time",
  "event",
  "client",
  "ledger",
  "company",
  "folder",
  "what",
  "total",
  "approved_by",
  "hold",
  "harness",
  "entry_hash",
];

export function toCsv(rows: LogRow[]): string {
  const lines = [CSV_HEADER.join(",")];
  for (const r of rows)
    lines.push(
      [
        r.ts,
        r.event,
        clientOf(r),
        r.ledger,
        r.company ?? "",
        r.folder,
        r.title,
        r.total !== undefined ? r.total.toFixed(2) : "",
        r.approved_by ?? "",
        r.hold ?? "",
        r.client,
        r.hash,
      ]
        .map(csvCell)
        .join(","),
    );
  return lines.join("\n") + "\n";
}

export function renderSummary(s: MonthSummary): string {
  if (s.clients.length === 0) return `${s.month}: no AI writes to QuickBooks or Xero were held.\n`;
  const out: string[] = [`AI writes to the books, ${s.month}, per client`];
  for (const c of s.clients) {
    out.push("");
    out.push(
      `${c.client}: ${c.held} held, ${c.released} released${c.released_total ? ` (${fmt(c.released_total)})` : ""}, ${c.waiting} still waiting, ${c.refused} refused`,
    );
    for (const r of c.rows) {
      if (r.event === "still-held") continue;
      const when = `${r.ts.slice(5, 10)} ${r.ts.slice(11, 16)}`;
      const who = r.event === "released" && r.approved_by ? ` — ${r.approved_by}` : "";
      out.push(`  ${when}  ${r.event.padEnd(10)} ${r.title}${who}`);
    }
  }
  return out.join("\n") + "\n";
}
