/**
 * Synthetic fixtures for the demo and the tests. Every company id, customer, amount and message is
 * invented. Tool names and argument shapes follow the public tool schemas named in catalog.ts.
 *
 * Transcript entries follow the shapes Claude Code writes (as okgate's transcript tests do): a
 * person's message is a `user` entry with `origin.kind: "human"`; the model's text is an
 * `assistant` entry.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { HookInput } from "./classify.js";

type Entry = Record<string, unknown>;

export function humanEntry(text: string, at: number): Entry {
  return {
    type: "user",
    uuid: `u-${at}`,
    timestamp: new Date(at).toISOString(),
    isSidechain: false,
    userType: "external",
    origin: { kind: "human" },
    message: { role: "user", content: text },
  };
}

export function assistantEntry(text: string, at: number): Entry {
  return {
    type: "assistant",
    timestamp: new Date(at).toISOString(),
    isSidechain: false,
    message: { role: "assistant", content: [{ type: "text", text }] },
  };
}

export function appendTranscript(file: string, ...entries: Entry[]): void {
  mkdirSync(path.dirname(file), { recursive: true });
  appendFileSync(file, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

/** A Claude Code PreToolUse input. */
export function claudeInput(
  tool: string,
  toolInput: unknown,
  o: { cwd: string; transcript: string; id: string; session?: string },
): HookInput {
  return {
    session_id: o.session ?? "demo-session",
    transcript_path: o.transcript,
    cwd: o.cwd,
    permission_mode: "default",
    hook_event_name: "PreToolUse",
    tool_name: tool,
    tool_input: toolInput,
    tool_use_id: o.id,
  };
}

/** Intuit's open-source server: `create_invoice` (src/tools/create-invoice.tool.ts). */
export const QBO_CREATE_INVOICE = {
  params: {
    customer_ref: "58",
    doc_number: "1042",
    txn_date: "2026-10-09",
    line_items: [
      { item_ref: "12", qty: 10, unit_price: 125, description: "October bookkeeping, 10 hours" },
      { item_ref: "19", qty: 1, unit_price: 0, description: "Receipt capture (included)" },
    ],
    customer_memo: "Thank you for your business.",
  },
};

/** Meridian's `create_journal_entry`, out of balance by 250.00 (invented; the shape is QuickBooks'). */
export const MERIDIAN_JOURNAL_ENTRY = {
  company_id: "9130354821",
  journal_entry: {
    TxnDate: "2026-09-30",
    PrivateNote: "Accrue September rent",
    Line: [
      {
        Amount: 2500,
        DetailType: "JournalEntryLineDetail",
        JournalEntryLineDetail: { PostingType: "Debit", AccountRef: { value: "67", name: "Rent" } },
      },
      {
        Amount: 2250,
        DetailType: "JournalEntryLineDetail",
        JournalEntryLineDetail: {
          PostingType: "Credit",
          AccountRef: { value: "33", name: "Accrued liabilities" },
        },
      },
    ],
  },
};

/** A curl against Xero's Accounting API: a draft bill (ACCPAY), invented tenant and contact. */
export const XERO_CURL =
  "curl -sS -X PUT https://api.xero.com/api.xro/2.0/Invoices " +
  "-H 'Authorization: Bearer $XERO_TOKEN' -H 'xero-tenant-id: 7d1c2a40-1111-4b2b-9c3d-000000000001' " +
  `-H 'Content-Type: application/json' -d '{"Invoices":[{"Type":"ACCPAY","Contact":{"ContactID":"c-204"},"LineItems":[{"Description":"Laptop","Quantity":1,"UnitAmount":1899,"AccountCode":"720"}],"Status":"DRAFT"}]}'`;

/** Intuit's open-source server: `delete_invoice` (src/tools/delete-invoice.tool.ts). */
export const QBO_DELETE_INVOICE = { params: { idOrEntity: "1042" } };

/** An opaque connector id, as a claude.ai connector can arrive in a hook. */
export const OPAQUE_SERVER = "3f0c2a9e-5b7d-4c11-9e2a-0d6f4b8a1c37";
