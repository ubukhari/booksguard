import { describe, expect, it } from "vitest";
import { FAMILIES } from "./catalog.js";
import type { LedgerWrite } from "./classify.js";
import { moneyOf, renderDiff, targetOf, unwrap } from "./diff.js";
import { MERIDIAN_JOURNAL_ENTRY, QBO_CREATE_INVOICE, QBO_DELETE_INVOICE } from "./fixtures.js";

const write = (over: Partial<LedgerWrite>): LedgerWrite => ({
  kind: "ledger-write",
  ledger: "QuickBooks",
  via: "mcp",
  server: "quickbooks",
  tool: "create_invoice",
  family: FAMILIES.find((f) => f.id === "intuit-local"),
  op: "create",
  entity: "invoice",
  args: {},
  why: "test",
  ...over,
});

describe("money", () => {
  it("adds up quantity × unit price", () => {
    expect(moneyOf(QBO_CREATE_INVOICE)).toEqual({ lines: 2, total: 1250 });
  });

  it("checks a QuickBooks journal entry's debits against its credits", () => {
    expect(moneyOf(MERIDIAN_JOURNAL_ENTRY)).toMatchObject({
      debits: 2500,
      credits: 2250,
      balanced: false,
    });
    const balanced = structuredClone(MERIDIAN_JOURNAL_ENTRY);
    balanced.journal_entry.Line[1]!.Amount = 2500;
    expect(moneyOf(balanced)).toMatchObject({ balanced: true, total: 2500 });
  });

  it("reads Xero's signed manual journal lines (debits positive)", () => {
    const mj = {
      narration: "Reclass",
      manualJournalLines: [
        { lineAmount: 300, accountCode: "400" },
        { lineAmount: -300, accountCode: "200" },
      ],
    };
    expect(moneyOf(mj)).toMatchObject({ debits: 300, credits: 300, balanced: true });
  });

  it("falls back to a top-level amount", () => {
    expect(moneyOf({ invoiceId: "i1", accountId: "a1", amount: 99.5 })).toEqual({ total: 99.5 });
    expect(moneyOf({ params: { customer_ref: "1", total_amt: 40 } })).toEqual({ total: 40 });
  });
});

describe("unwrap and target", () => {
  it("peels params and single-record wrappers", () => {
    expect(unwrap({ params: { bill: { VendorRef: { value: "3" } } } })).toEqual({
      VendorRef: { value: "3" },
    });
    expect(unwrap({ Invoices: [{ Type: "ACCPAY" }] })).toEqual({ Type: "ACCPAY" });
    expect(unwrap({ company_id: "9", journal_entry: { TxnDate: "x" } })).toEqual({ TxnDate: "x" });
  });

  it("finds the record an update, delete or void names", () => {
    expect(targetOf(QBO_DELETE_INVOICE)).toBe("1042");
    expect(targetOf({ params: { invoice_id: "77", patch: {} } })).toBe("77");
    expect(targetOf({ params: { idOrEntity: { Id: "5", SyncToken: "1" } } })).toBe("5");
    expect(targetOf({ invoiceId: "inv-1" })).toBe("inv-1");
  });
});

describe("renderDiff", () => {
  it("shows a create field by field with its total", () => {
    const d = renderDiff(write({ args: QBO_CREATE_INVOICE }));
    expect(d.title).toBe(
      `create invoice 1,250.00 · QuickBooks via "quickbooks" (Intuit's QuickBooks Online MCP server)`,
    );
    expect(d.lines).toContain(`+ customer_ref: "58"`);
    expect(d.lines.some((l) => l.startsWith("+ line 1: 1,250.00 · item_ref"))).toBe(true);
    expect(d.lines.at(-1)).toBe("= total 1,250.00 across 2 lines");
  });

  it("flags a journal entry out of balance in the title and the diff", () => {
    const d = renderDiff(
      write({
        tool: "create_journal_entry",
        entity: "journal entry",
        args: MERIDIAN_JOURNAL_ENTRY,
        company: "913",
      }),
    );
    expect(d.title).toContain("create journal entry 2,500.00 OUT OF BALANCE");
    expect(d.title).toContain("company 913");
    expect(d.lines).toContain("+ line 1: debit 2,500.00 · AccountRef Rent (67)");
    expect(d.lines.at(-1)).toBe("= debits 2,500.00, credits 2,250.00: OUT OF BALANCE by 250.00");
  });

  it("shows an update as the fields it sets, and says current values were not read", () => {
    const d = renderDiff(
      write({
        op: "update",
        tool: "update_invoice",
        args: { params: { invoice_id: "77", patch: { DueDate: "2026-11-30" } } },
      }),
    );
    expect(d.title.startsWith("change invoice 77")).toBe(true);
    expect(d.lines).toContain(`~ DueDate: "2026-11-30"`);
    expect(d.lines.some((l) => l.includes("current values not read"))).toBe(true);
  });

  it("shows a delete as the record it removes", () => {
    const d = renderDiff(write({ op: "delete", tool: "delete_invoice", args: QBO_DELETE_INVOICE }));
    expect(d.lines).toEqual(["- delete invoice 1042"]);
    expect(d.title.startsWith("delete invoice 1042 ·")).toBe(true);
  });

  it("names an opaque connector by its first characters", () => {
    const d = renderDiff(
      write({ server: "3f0c2a9e-5b7d-4c11-9e2a-0d6f4b8a1c37", family: undefined }),
    );
    expect(d.title).toContain("QuickBooks via connector 3f0c2a9e…");
  });

  it("caps a long diff", () => {
    const many = {
      params: {
        customer_ref: "1",
        line_items: Array.from({ length: 50 }, (_, i) => ({ qty: 1, unit_price: i })),
      },
    };
    const d = renderDiff(write({ args: many }));
    expect(d.lines.length).toBe(30);
    expect(d.lines.at(-1)).toMatch(/more lines$/);
  });
});
