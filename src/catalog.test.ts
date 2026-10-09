import { describe, expect, it } from "vitest";
import { CATALOG_SUMMARY, FAMILIES, GENERIC_WRITES, judgeTool, verbAndEntity } from "./catalog.js";

const family = (id: string) => FAMILIES.find((f) => f.id === id)!;

describe("the catalogue, as read on 9 Oct 2026", () => {
  it("holds every tool each public source lists", () => {
    // Intuit's open-source server: 142 tool files, half of them create_/update_/delete_
    expect(family("intuit-local").writes).toHaveLength(71);
    expect(family("intuit-local").reads).toHaveLength(71);
    // Intuit's hosted connector: 74 tools on its directory page
    expect(family("intuit-hosted").writes.length + family("intuit-hosted").reads.length).toBe(74);
    expect(family("intuit-hosted").writes).toHaveLength(27);
    // Meridian: 63 tools in its directory page data, 32 of them writes
    expect(family("meridian").writes.length + family("meridian").reads.length).toBe(63);
    expect(family("meridian").writes).toHaveLength(32);
    // Xero's open-source server: 50 tools, 24 of them change something
    expect(family("xero-local").writes.length + family("xero-local").reads.length).toBe(50);
    expect(family("xero-local").writes).toHaveLength(24);
    // Xero's hosted connector is read-only at launch
    expect(family("xero-hosted").writes).toHaveLength(0);
    expect(CATALOG_SUMMARY).toBe("154 write tools across 4 servers, read 9 Oct 2026");
  });

  it("never lists one name as both a read and a write of the same server", () => {
    for (const f of FAMILIES) {
      const reads = new Set(f.reads);
      for (const w of f.writes) expect(reads.has(w), `${f.id} ${w}`).toBe(false);
      expect(new Set(f.writes).size).toBe(f.writes.length);
      expect(new Set(f.reads).size).toBe(f.reads.length);
    }
  });

  it("marks only catalogued writes as generic", () => {
    const all = new Set(FAMILIES.flatMap((f) => f.writes));
    for (const g of GENERIC_WRITES) expect(all.has(g), g).toBe(true);
  });

  it("names the verb and the record", () => {
    expect(verbAndEntity("qbo_sales_create_invoice")).toEqual({
      verb: "create",
      entity: "invoice",
    });
    expect(verbAndEntity("create-manual-journal")).toEqual({
      verb: "create",
      entity: "manual journal",
    });
    expect(verbAndEntity("delete_journal_entry")).toEqual({
      verb: "delete",
      entity: "journal entry",
    });
    expect(verbAndEntity("create-bill")).toEqual({ verb: "create", entity: "bill" });
    expect(verbAndEntity("batch_entity_operations").verb).toBe("batch");
    expect(verbAndEntity("quickbooks-transaction-import")).toEqual({
      verb: "import",
      entity: "transactions",
    });
  });
});

describe("judgeTool", () => {
  it("knows catalogued writes and reads on any server", () => {
    expect(judgeTool("qbo_sales_send_invoice", false)).toMatchObject({
      kind: "write",
      op: "send",
      generic: false,
    });
    expect(judgeTool("void_invoice", false)).toMatchObject({ kind: "write", op: "void" });
    expect(judgeTool("create_invoice", false)).toMatchObject({ kind: "write", generic: true });
    expect(judgeTool("search_invoices", false)).toMatchObject({ kind: "read" });
    expect(judgeTool("list-invoices", false)).toMatchObject({ kind: "read" });
  });

  it("off a ledger server, an uncatalogued name is not booksguard's business", () => {
    expect(judgeTool("finalize_invoice", false)).toBeUndefined();
    expect(judgeTool("send_message", false)).toBeUndefined();
  });

  it("on a ledger server, judges an uncatalogued name by its verb and holds what it cannot read", () => {
    expect(judgeTool("get_new_report", true)).toMatchObject({ kind: "read", catalogued: false });
    expect(judgeTool("reconcile_account", true)).toMatchObject({ kind: "write", op: "update" });
    expect(judgeTool("frobnicate_ledger", true)).toMatchObject({ kind: "write", op: "unknown" });
  });
});
