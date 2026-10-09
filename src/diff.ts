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
import type { GuardConfigWrite, LedgerWrite } from "./classify.js";

export interface Money {
  total?: number;
  lines?: number;
  debits?: number;
  credits?: number;
  balanced?: boolean;
  currency?: string;
}

export interface Diff {
  /** one line: what, where */
  title: string;
  /** the diff itself, prefixed + (adds), ~ (sets), - (removes), → (sends) */
  lines: string[];
  money: Money;
  /** the record an update, delete or void names */
  target?: string;
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const MAX_LINES = 30;
const LINE_KEYS = [
  "Line",
  "line",
  "lines",
  "Lines",
  "line_items",
  "lineItems",
  "LineItems",
  "manualJournalLines",
  "journalLines",
  "JournalLines",
  "items",
];
const ID_KEYS = [
  "id",
  "Id",
  "ID",
  "idOrEntity",
  "invoice_id",
  "invoiceId",
  "invoiceID",
  "entity_id",
  "entityId",
  "transaction_id",
  "transactionId",
  "estimate_id",
  "estimateId",
  "customer_id",
  "customerId",
  "bill_id",
  "billId",
  "contactId",
  "contactID",
  "quoteId",
  "creditNoteId",
  "bankTransactionId",
  "itemId",
  "timesheetID",
  "timesheetId",
];
const TOTAL_KEYS = ["total_amt", "TotalAmt", "total", "Total", "amount", "Amount", "totalAmount"];
const CURRENCY_KEYS = ["currency", "currency_ref", "CurrencyRef", "currencyCode", "CurrencyCode"];

export function money(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const num = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
  return undefined;
};

/** `{ params: { bill: {...} } }` → the bill. Peels `params` and one single-object wrapper. */
export function unwrap(args: unknown): unknown {
  let cur = args;
  for (let i = 0; i < 3; i += 1) {
    if (!isObject(cur)) return cur;
    const here: Json = cur;
    const keys = Object.keys(here);
    if (keys.some((k) => LINE_KEYS.includes(k))) return cur;
    // { company_id, journal_entry: { … } }: one record beside a few plain values
    const objects = keys.filter((k) => isObject(here[k]));
    if (
      keys.length > 1 &&
      objects.length === 1 &&
      keys.every((k) => k === objects[0] || (!isObject(here[k]) && !Array.isArray(here[k])))
    ) {
      cur = here[objects[0]!];
      continue;
    }
    if (keys.length !== 1) return cur;
    const only = here[keys[0]!];
    if (ID_KEYS.includes(keys[0]!)) return cur;
    // Xero's REST bodies wrap one record in an array: { "Invoices": [ { … } ] }
    if (Array.isArray(only) && only.length === 1 && isObject(only[0])) {
      cur = only[0];
      continue;
    }
    if (!isObject(only)) return cur;
    // a reference ({ value, name }) is a field of the record, not the record
    if (refText(only) !== undefined && Object.keys(only).length <= 3) return cur;
    cur = only;
  }
  return cur;
}

/** A reference `{ value, name }` (QuickBooks) or `{ ContactID, Name }` → "Name (value)". */
function refText(v: Json): string | undefined {
  const id = v.value ?? v.Value ?? v.id ?? v.Id ?? v.ContactID ?? v.contactID;
  const name = v.name ?? v.Name ?? v.DisplayName ?? v.displayName;
  if (typeof id === "string" || typeof id === "number")
    return typeof name === "string" && name ? `${name} (${id})` : String(id);
  return undefined;
}

function scalarText(v: unknown, limit = 80): string {
  const s = typeof v === "string" ? JSON.stringify(v) : String(v);
  return s.length > limit ? `${s.slice(0, limit - 1)}…` : s;
}

/** One value, flattened to a line's worth of text. */
export function valueText(v: unknown, depth = 0): string {
  if (v === null || v === undefined) return String(v);
  if (typeof v !== "object") return scalarText(v);
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x !== "object")) return scalarText(v.map(String).join(", "), 100);
    return `${v.length} item${v.length === 1 ? "" : "s"}`;
  }
  const ref = refText(v as Json);
  if (ref && Object.keys(v).length <= 3) return ref;
  if (depth >= 2) return "{…}";
  const parts = Object.entries(v)
    .filter(([, x]) => x !== undefined && x !== null && x !== "")
    .map(([k, x]) => `${k} ${valueText(x, depth + 1)}`);
  const s = parts.join(" · ");
  return s.length > 140 ? `${s.slice(0, 139)}…` : s;
}

function findLines(obj: Json): { key: string; lines: Json[] } | undefined {
  for (const key of LINE_KEYS) {
    const v = obj[key];
    if (Array.isArray(v) && v.length > 0 && v.every(isObject)) return { key, lines: v as Json[] };
  }
  return undefined;
}

function lineAmount(line: Json): number | undefined {
  for (const k of ["Amount", "amount", "lineAmount", "LineAmount", "total", "Total"]) {
    const n = num(line[k]);
    if (n !== undefined) return n;
  }
  const q = num(line.qty ?? line.Qty ?? line.quantity ?? line.Quantity);
  const p = num(
    line.unit_price ??
      line.UnitPrice ??
      line.unitAmount ??
      line.UnitAmount ??
      line.unit_amount ??
      line.rate,
  );
  if (q !== undefined && p !== undefined) return q * p;
  for (const v of Object.values(line)) {
    if (!isObject(v)) continue;
    const dq = num(v.Qty ?? v.qty ?? v.quantity);
    const dp = num(v.UnitPrice ?? v.unit_price ?? v.unitAmount ?? v.UnitAmount);
    if (dq !== undefined && dp !== undefined) return dq * dp;
  }
  const debit = num(line.debit ?? line.Debit);
  const credit = num(line.credit ?? line.Credit);
  if (debit !== undefined || credit !== undefined) return (debit ?? 0) - (credit ?? 0);
  return undefined;
}

function posting(line: Json, key: string): "debit" | "credit" | undefined {
  const detail = isObject(line.JournalEntryLineDetail) ? line.JournalEntryLineDetail : undefined;
  const t = detail?.PostingType ?? line.PostingType ?? line.posting_type ?? line.postingType;
  if (typeof t === "string") return /^d/i.test(t) ? "debit" : /^c/i.test(t) ? "credit" : undefined;
  if (num(line.debit ?? line.Debit) !== undefined) return "debit";
  if (num(line.credit ?? line.Credit) !== undefined) return "credit";
  if (key === "manualJournalLines" || key === "journalLines" || key === "JournalLines") {
    const n = num(line.lineAmount ?? line.LineAmount);
    if (n !== undefined) return n >= 0 ? "debit" : "credit";
  }
  return undefined;
}

export function moneyOf(args: unknown): Money {
  const obj = unwrap(args);
  if (!isObject(obj)) return {};
  const out: Money = {};
  for (const k of CURRENCY_KEYS) {
    const c = obj[k];
    const text = isObject(c) ? refText(c) : typeof c === "string" ? c : undefined;
    if (text) {
      out.currency = text;
      break;
    }
  }
  const found = findLines(obj);
  if (found) {
    let total = 0;
    let any = false;
    let debits = 0;
    let credits = 0;
    let journal = false;
    for (const line of found.lines) {
      const amount = lineAmount(line);
      const side = posting(line, found.key);
      if (side) journal = true;
      if (amount === undefined) continue;
      any = true;
      if (side === "debit") debits += Math.abs(amount);
      else if (side === "credit") credits += Math.abs(amount);
      else total += amount;
    }
    out.lines = found.lines.length;
    if (journal) {
      out.debits = round(debits);
      out.credits = round(credits);
      out.balanced = Math.abs(debits - credits) < 0.005;
      out.total = round(debits);
    } else if (any) out.total = round(total);
  }
  if (out.total === undefined)
    for (const k of TOTAL_KEYS) {
      const n = num(obj[k]);
      if (n !== undefined) {
        out.total = n;
        break;
      }
    }
  return out;
}

const round = (n: number): number => Math.round(n * 100) / 100;

/** The id of the record an update, delete or void names. */
export function targetOf(args: unknown): string | undefined {
  const obj = isObject(args) && isObject(args.params) ? args.params : args;
  if (typeof obj === "string" || typeof obj === "number") return String(obj);
  if (!isObject(obj)) return undefined;
  for (const k of ID_KEYS) {
    const v = obj[k];
    if (typeof v === "string" || typeof v === "number") return String(v);
    if (isObject(v)) {
      const inner = v.Id ?? v.id;
      if (typeof inner === "string" || typeof inner === "number") return String(inner);
    }
  }
  const inner = unwrap(obj);
  if (isObject(inner) && inner !== obj) {
    const id = inner.Id ?? inner.id;
    if (typeof id === "string" || typeof id === "number") return String(id);
  }
  return undefined;
}

const OP_SIGN: Record<string, string> = {
  create: "+",
  import: "+",
  upload: "+",
  batch: "+",
  approve: "~",
  update: "~",
  delete: "-",
  void: "-",
  revert: "-",
  send: "→",
  unknown: "?",
};

const OP_WORD: Record<string, string> = {
  create: "create",
  update: "change",
  delete: "delete",
  void: "void",
  send: "send",
  import: "import",
  upload: "upload",
  batch: "run a batch of changes on",
  approve: "approve",
  revert: "revert",
  unknown: "write",
};

/** "create invoice", "delete bill 1042", "send invoice 1042" */
export function actionText(w: Pick<LedgerWrite, "op" | "entity">, target?: string): string {
  return `${OP_WORD[w.op] ?? w.op} ${w.entity}${target ? ` ${target}` : ""}`;
}

export function moneyText(m: Money): string | undefined {
  const cur = m.currency ? ` ${m.currency}` : "";
  if (m.debits !== undefined && m.credits !== undefined) {
    const state = m.balanced
      ? "balanced"
      : `OUT OF BALANCE by ${money(Math.abs(m.debits - m.credits))}`;
    return `debits ${money(m.debits)}${cur}, credits ${money(m.credits)}${cur}: ${state}`;
  }
  if (m.total !== undefined)
    return `total ${money(m.total)}${cur}${m.lines ? ` across ${m.lines} line${m.lines === 1 ? "" : "s"}` : ""}`;
  return undefined;
}

const OPAQUE = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{24,})$/i;

function where(w: LedgerWrite): string {
  if (w.via === "rest") return `${w.ledger} API (${w.server})`;
  const server = OPAQUE.test(w.server) ? `connector ${w.server.slice(0, 8)}…` : `"${w.server}"`;
  return `${w.ledger} via ${server}${w.family ? ` (${w.family.label})` : ""}`;
}

/** " 1,250.00" for the title; a journal entry by its debits, flagged when out of balance. */
function amountText(m: Money): string {
  const cur = m.currency ? ` ${m.currency}` : "";
  if (m.debits !== undefined)
    return ` ${money(m.debits)}${cur}${m.balanced ? "" : " OUT OF BALANCE"}`;
  return m.total !== undefined ? ` ${money(m.total)}${cur}` : "";
}

const LINE_SKIP = new Set([
  "Amount",
  "amount",
  "lineAmount",
  "LineAmount",
  "DetailType",
  "PostingType",
  "posting_type",
  "postingType",
  "debit",
  "credit",
  "Debit",
  "Credit",
]);

/** A line's other fields, with QuickBooks' `…LineDetail` objects flattened into it. */
function lineText(line: Json): string {
  const flat: Json = {};
  for (const [k, v] of Object.entries(line)) {
    if (LINE_SKIP.has(k)) continue;
    if (/Detail$/.test(k) && isObject(v)) {
      for (const [dk, dv] of Object.entries(v)) if (!LINE_SKIP.has(dk)) flat[dk] = dv;
    } else flat[k] = v;
  }
  return Object.keys(flat).length ? valueText(flat) : "";
}

export function renderDiff(w: LedgerWrite | GuardConfigWrite): Diff {
  if (w.kind === "guard-config")
    return {
      title: `change a harness's hook settings (${w.target})`,
      lines: [`~ ${w.target}: ${w.why}`],
      money: {},
      target: w.target,
    };
  const target = w.op === "create" ? undefined : targetOf(w.args);
  const sign = OP_SIGN[w.op] ?? "?";
  const lines: string[] = [];
  const obj = unwrap(w.args);
  const m = moneyOf(w.args);
  if (w.op === "delete" || w.op === "void") {
    lines.push(`- ${w.op} ${w.entity}${target ? ` ${target}` : " (id not on the call)"}`);
  } else if (isObject(obj)) {
    const linesFound = findLines(obj);
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null || v === "") continue;
      if (linesFound && k === linesFound.key) continue;
      if (ID_KEYS.includes(k) && w.op !== "create" && String(v) === target) continue;
      lines.push(`${sign} ${k}: ${valueText(v)}`);
    }
    if (linesFound)
      linesFound.lines.forEach((line, i) => {
        const amount = lineAmount(line);
        const side = posting(line, linesFound.key);
        const head = [side, amount !== undefined ? money(Math.abs(amount)) : undefined]
          .filter(Boolean)
          .join(" ");
        const rest = lineText(line);
        lines.push(`${sign} line ${i + 1}: ${[head, rest].filter(Boolean).join(" · ")}`);
      });
  } else if (obj !== undefined) {
    lines.push(`${sign} ${valueText(obj)}`);
  }
  if (w.op === "update" || w.op === "approve")
    lines.push("  (current values not read: booksguard never calls QuickBooks or Xero)");
  const total = moneyText(m);
  if (total) lines.push(`= ${total}`);
  const shown =
    lines.length > MAX_LINES
      ? [...lines.slice(0, MAX_LINES - 1), `… ${lines.length - MAX_LINES + 1} more lines`]
      : lines;
  const company = w.company ? ` · company ${w.company}` : "";
  return {
    title: `${actionText(w, target)}${amountText(m)} · ${where(w)}${company}`,
    lines: shown,
    money: m,
    target,
  };
}
