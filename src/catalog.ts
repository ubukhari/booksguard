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

export type Ledger = "QuickBooks" | "Xero";

export type FamilyId = "intuit-hosted" | "intuit-local" | "meridian" | "xero-hosted" | "xero-local";

export interface ServerFamily {
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

export const READ_ON = "2026-10-09";

export const FAMILIES: readonly ServerFamily[] = [
  {
    id: "intuit-hosted",
    ledger: "QuickBooks",
    label: "Intuit QuickBooks connector",
    where: "https://ai-inc.quickbooks.intuit.com/v1/mcp",
    source: "https://claude.com/connectors/intuit-quickbooks",
    read: READ_ON,
    writes: [
      "qbo_catalog_create_product",
      "qbo_contact_create_customer",
      "qbo_payroll_assign_employee_work_location",
      "qbo_payroll_create_employee",
      "qbo_payroll_save_employee_contract_details",
      "qbo_payroll_update_employee",
      "qbo_sales_create_estimate",
      "qbo_sales_create_invoice",
      "qbo_sales_create_payment_link",
      "qbo_sales_create_recurring_invoice",
      "qbo_sales_delete_estimate",
      "qbo_sales_delete_invoice",
      "qbo_sales_delete_recurring_invoice",
      "qbo_sales_duplicate_estimate",
      "qbo_sales_duplicate_invoice",
      "qbo_sales_operate_recurring_invoice",
      "qbo_sales_send_estimate",
      "qbo_sales_send_invoice",
      "qbo_sales_send_invoice_reminder",
      "qbo_sales_send_payment_link",
      "qbo_sales_update_estimate",
      "qbo_sales_update_invoice",
      "qbo_sales_update_payment_link",
      "qbo_sales_update_recurring_invoice",
      "qbo_sales_update_settings",
      "quickbooks-profile-info-update",
      "quickbooks-transaction-import",
    ],
    reads: [
      "benchmarking-against-industry",
      "benchmarking-quickbooks-account",
      "cash-flow-generator",
      "cash-flow-quickbooks-account",
      "company-info",
      "industry-recommendation",
      "profit-loss-generator",
      "profit-loss-quickbooks-account",
      "qbo_accounting_get_ar_aging_detail",
      "qbo_accounting_get_ar_aging_summary",
      "qbo_accounting_get_balance_sheet",
      "qbo_accounting_get_product_service_list",
      "qbo_accounting_get_sales_by_customer_summary",
      "qbo_accounting_get_sales_by_product_summary",
      "qbo_catalog_search_products",
      "qbo_contact_search_customer",
      "qbo_lending_estimate_loan_payments",
      "qbo_lending_get_loans",
      "qbo_lending_get_peer_offers",
      "qbo_lending_help",
      "qbo_lending_shop_loans",
      "qbo_payroll_get_company_deductions_contributions",
      "qbo_payroll_get_company_info",
      "qbo_payroll_get_company_last_payroll_run",
      "qbo_payroll_get_company_pay_types",
      "qbo_payroll_get_company_payroll_readiness",
      "qbo_payroll_get_company_timeoff_details",
      "qbo_payroll_get_employee_compensations",
      "qbo_payroll_get_employee_contract_details",
      "qbo_payroll_get_employee_deductions",
      "qbo_payroll_get_employee_details",
      "qbo_payroll_get_employee_manager_details",
      "qbo_payroll_get_employee_payroll_readiness",
      "qbo_payroll_get_employee_timeoff_assignments",
      "qbo_payroll_get_employees",
      "qbo_payroll_get_employees_by_work_location",
      "qbo_payroll_get_pay_schedules",
      "qbo_payroll_get_payslip_details",
      "qbo_payroll_get_payslips",
      "qbo_payroll_search_employee",
      "qbo_sales_get_estimates",
      "qbo_sales_get_invoices",
      "qbo_sales_get_payment_links",
      "qbo_sales_get_recurring_invoices",
      "qbo_sales_get_settings",
      "qbo_sales_get_transaction_document",
      "quickbooks-import-status",
    ],
  },
  {
    id: "intuit-local",
    ledger: "QuickBooks",
    label: "Intuit's QuickBooks Online MCP server",
    where: "https://github.com/intuit/quickbooks-online-mcp-server",
    source:
      "https://github.com/intuit/quickbooks-online-mcp-server/tree/31a1dd5c3e17/src/tools (commit of 15 Sep 2026)",
    read: READ_ON,
    writes: [
      "create_account",
      "create_attachable",
      "create_bill_payment",
      "create-bill",
      "create_class",
      "create_credit_memo",
      "create_customer",
      "create_department",
      "create_deposit",
      "create_employee",
      "create_estimate",
      "create_invoice",
      "create_item",
      "create_journal_entry",
      "create_payment_method",
      "create_payment",
      "create_purchase_order",
      "create_purchase",
      "create_refund_receipt",
      "create_sales_receipt",
      "create_term",
      "create_time_activity",
      "create_transfer",
      "create_vendor_credit",
      "create-vendor",
      "delete_attachable",
      "delete_bill_payment",
      "delete-bill",
      "delete_credit_memo",
      "delete_customer",
      "delete_deposit",
      "delete_employee",
      "delete_estimate",
      "delete_invoice",
      "delete_item",
      "delete_journal_entry",
      "delete_payment",
      "delete_purchase_order",
      "delete_purchase",
      "delete_refund_receipt",
      "delete_sales_receipt",
      "delete_time_activity",
      "delete_transfer",
      "delete_vendor_credit",
      "delete-vendor",
      "update_account",
      "update_attachable",
      "update_bill_payment",
      "update-bill",
      "update_class",
      "update_company_info",
      "update_credit_memo",
      "update_customer",
      "update_department",
      "update_deposit",
      "update_employee",
      "update_estimate",
      "update_invoice",
      "update_item",
      "update_journal_entry",
      "update_payment_method",
      "update_payment",
      "update_purchase_order",
      "update_purchase",
      "update_refund_receipt",
      "update_sales_receipt",
      "update_term",
      "update_time_activity",
      "update_transfer",
      "update_vendor_credit",
      "update-vendor",
    ],
    reads: [
      "get_account",
      "get_aged_payables",
      "get_aged_receivables",
      "get_attachable",
      "get_balance_sheet",
      "get_bill_payment",
      "get-bill",
      "get_cash_flow",
      "get_class",
      "get_company_info",
      "get_credit_memo",
      "get_customer_balance",
      "get_customer_sales",
      "get_customer",
      "get_department",
      "get_deposit",
      "get_employee",
      "get_estimate",
      "get_general_ledger",
      "get_invoice_pdf",
      "get_journal_entry",
      "get_payment_method",
      "get_payment",
      "get_preferences",
      "get_profit_and_loss",
      "get_purchase_order",
      "get_purchase",
      "get_refund_receipt",
      "get_sales_receipt",
      "get_tax_agency",
      "get_tax_code",
      "get_tax_rate",
      "get_term",
      "get_time_activity",
      "get_transfer",
      "get_trial_balance",
      "get_vendor_balance",
      "get_vendor_credit",
      "get_vendor_expenses",
      "get-vendor",
      "read_invoice",
      "read_item",
      "search_accounts",
      "search_attachables",
      "search_bill_payments",
      "search_bills",
      "search_budgets",
      "search_classes",
      "search_credit_memos",
      "search_customers",
      "search_departments",
      "search_deposits",
      "search_employees",
      "search_estimates",
      "search_invoices",
      "search_items",
      "search_journal_entries",
      "search_payment_methods",
      "search_payments",
      "search_purchase_orders",
      "search_purchases",
      "search_refund_receipts",
      "search_sales_receipts",
      "search_tax_agencies",
      "search_tax_codes",
      "search_tax_rates",
      "search_terms",
      "search_time_activities",
      "search_transfers",
      "search_vendor_credits",
      "search_vendors",
    ],
  },
  {
    id: "meridian",
    ledger: "QuickBooks",
    label: "Meridian Connector for QuickBooks",
    where: "https://qbo-connector.meridian.pilot.com/mcp",
    source: "https://claude.com/connectors/meridian-connector-for-quickbooks",
    read: READ_ON,
    writes: [
      "batch_entity_operations",
      "create_attachment_upload",
      "create_bill",
      "create_bill_payment",
      "create_customer",
      "create_deposit",
      "create_entity",
      "create_expense",
      "create_invoice",
      "create_journal_entry",
      "create_payload_upload",
      "create_sales_receipt",
      "create_tax_code_with_rates",
      "create_vendor_credit",
      "deactivate_customer",
      "delete_attachment",
      "delete_entity",
      "delete_transaction",
      "link_attachment",
      "set_entity_active",
      "update_bill",
      "update_customer",
      "update_deposit",
      "update_entity",
      "update_expense",
      "update_invoice",
      "update_journal_entry",
      "update_sales_receipt",
      "update_vendor_credit",
      "upload_attachment",
      "void_entity",
      "void_invoice",
    ],
    reads: [
      "describe_entity",
      "fetch_quickbooks_report",
      "get_aged_payables",
      "get_aged_receivables",
      "get_attachment",
      "get_balance_sheet",
      "get_cash_flow",
      "get_changed_entities",
      "get_company_info",
      "get_customer_balance",
      "get_customer_sales",
      "get_entity",
      "get_general_ledger",
      "get_invoice_pdf",
      "get_profit_and_loss",
      "get_transaction",
      "get_trial_balance",
      "get_vendor_balance",
      "get_vendor_expenses",
      "list_companies",
      "list_tax_classifications",
      "query",
      "run_report",
      "search_accounts",
      "search_attachments",
      "search_customers",
      "search_dimensions",
      "search_entities",
      "search_items",
      "search_transactions",
      "search_vendors",
    ],
  },
  {
    id: "xero-hosted",
    ledger: "Xero",
    label: "Xero connector",
    where: "https://mcp.xero.com/mcp",
    source: "https://www.xero.com/ai-in-accounting/claude/",
    read: READ_ON,
    writes: [],
    reads: [],
  },
  {
    id: "xero-local",
    ledger: "Xero",
    label: "Xero's MCP server",
    where: "https://github.com/XeroAPI/xero-mcp-server",
    source:
      "https://github.com/XeroAPI/xero-mcp-server/tree/f24583c867df/src/tools (commit of 5 Jun 2026)",
    read: READ_ON,
    writes: [
      "add-timesheet-line",
      "approve-timesheet",
      "create-bank-transaction",
      "create-contact",
      "create-credit-note",
      "create-invoice",
      "create-item",
      "create-manual-journal",
      "create-payment",
      "create-quote",
      "create-timesheet",
      "create-tracking-category",
      "create-tracking-options",
      "delete-timesheet",
      "revert-timesheet",
      "update-bank-transaction",
      "update-contact",
      "update-credit-note",
      "update-invoice",
      "update-item",
      "update-quote",
      "update-timesheet-line",
      "update-tracking-category",
      "update-tracking-options",
    ],
    reads: [
      "get-timesheet",
      "list-accounts",
      "list-aged-payables-by-contact",
      "list-aged-receivables-by-contact",
      "list-bank-transactions",
      "list-contact-groups",
      "list-contacts",
      "list-credit-notes",
      "list-invoices",
      "list-items",
      "list-manual-journals",
      "list-organisation-details",
      "list-payments",
      "list-payroll-employee-leave",
      "list-payroll-employee-leave-balances",
      "list-payroll-employee-leave-types",
      "list-payroll-employees",
      "list-payroll-leave-periods",
      "list-payroll-leave-types",
      "list-profit-and-loss",
      "list-quotes",
      "list-report-balance-sheet",
      "list-tax-rates",
      "list-timesheets",
      "list-tracking-categories",
      "list-trial-balance",
    ],
  },
];

/**
 * Names other kinds of server use too (Stripe has `create_invoice` and `create_customer`). On a
 * server whose name says nothing about a ledger they pass; on a ledger server, or on a connector
 * whose server id is opaque, they are held. Every other catalogued write is distinctive enough to
 * hold on any server.
 */
export const GENERIC_WRITES: ReadonlySet<string> = new Set([
  "create_account",
  "update_account",
  "create_attachable",
  "update_attachable",
  "delete_attachable",
  "create_bill",
  "update_bill",
  "create_class",
  "update_class",
  "create_customer",
  "update_customer",
  "delete_customer",
  "create_department",
  "update_department",
  "create_deposit",
  "update_deposit",
  "create_employee",
  "update_employee",
  "delete_employee",
  "create_estimate",
  "update_estimate",
  "delete_estimate",
  "create_expense",
  "update_expense",
  "create_invoice",
  "update_invoice",
  "delete_invoice",
  "create_item",
  "update_item",
  "delete_item",
  "create_payment",
  "update_payment",
  "delete_payment",
  "create_payment_method",
  "update_payment_method",
  "create_term",
  "update_term",
  "upload_attachment",
  "delete_attachment",
  "create-contact",
  "update-contact",
  "create-invoice",
  "update-invoice",
  "create-item",
  "update-item",
  "create-payment",
  "create-quote",
  "update-quote",
]);

export type Op =
  | "create"
  | "update"
  | "delete"
  | "void"
  | "send"
  | "import"
  | "upload"
  | "batch"
  | "approve"
  | "revert"
  | "unknown";

const WRITE_VERBS: Record<string, Op> = {
  create: "create",
  add: "update",
  update: "update",
  save: "update",
  assign: "update",
  operate: "update",
  set: "update",
  deactivate: "update",
  activate: "update",
  edit: "update",
  modify: "update",
  patch: "update",
  put: "update",
  post: "create",
  record: "create",
  duplicate: "create",
  copy: "create",
  delete: "delete",
  remove: "delete",
  archive: "delete",
  void: "void",
  send: "send",
  email: "send",
  import: "import",
  upload: "upload",
  batch: "batch",
  bulk: "batch",
  approve: "approve",
  authorise: "approve",
  authorize: "approve",
  reconcile: "update",
  categorize: "update",
  categorise: "update",
  merge: "update",
  revert: "revert",
  link: "update",
  unlink: "update",
  reverse: "revert",
  apply: "update",
  pay: "create",
  refund: "create",
  write: "update",
};

const READ_VERBS = new Set([
  "get",
  "list",
  "search",
  "read",
  "fetch",
  "describe",
  "run",
  "query",
  "find",
  "show",
  "view",
  "lookup",
  "count",
  "help",
  "estimate",
  "benchmarking",
  "status",
]);

export interface ToolVerdict {
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

const byName = new Map<string, { family: ServerFamily; kind: "read" | "write" }[]>();
for (const family of FAMILIES) {
  for (const name of family.writes)
    byName.set(name, [...(byName.get(name) ?? []), { family, kind: "write" }]);
  for (const name of family.reads)
    byName.set(name, [...(byName.get(name) ?? []), { family, kind: "read" }]);
}

const SINGULAR: Record<string, string> = {
  entries: "entry",
  activities: "activity",
  agencies: "agency",
  classes: "class",
  options: "option",
  operations: "operation",
};

function singular(word: string): string {
  if (SINGULAR[word]) return SINGULAR[word]!;
  if (/ss$/.test(word)) return word;
  return word.endsWith("s") && word.length > 3 ? word.slice(0, -1) : word;
}

/** `qbo_sales_create_invoice` → ["create", "invoice"]; `create-manual-journal` → ["create", "manual journal"]. */
export function verbAndEntity(name: string): { verb: string; entity: string } {
  const special: Record<string, { verb: string; entity: string }> = {
    batch_entity_operations: { verb: "batch", entity: "records (batch)" },
    "quickbooks-transaction-import": { verb: "import", entity: "transactions" },
    "quickbooks-profile-info-update": { verb: "update", entity: "company profile" },
    "quickbooks-import-status": { verb: "get", entity: "import status" },
    set_entity_active: { verb: "set", entity: "record (active flag)" },
    create_attachment_upload: { verb: "upload", entity: "attachment" },
    create_payload_upload: { verb: "upload", entity: "payload" },
    create_tax_code_with_rates: { verb: "create", entity: "tax code" },
    "add-timesheet-line": { verb: "add", entity: "timesheet line" },
    qbo_sales_operate_recurring_invoice: { verb: "operate", entity: "recurring invoice" },
    qbo_sales_send_invoice_reminder: { verb: "send", entity: "invoice reminder" },
  };
  if (special[name]) return special[name]!;
  const words = name
    .replace(/^qbo_(?:sales|contact|catalog|payroll|accounting|lending)_/, "")
    .split(/[-_]/)
    .filter(Boolean);
  const verb = words[0] ?? "";
  const rest = words.slice(1).map(singular);
  return { verb, entity: rest.join(" ") || "record" };
}

/**
 * What a tool name does to the books. `onLedger` says whether the server is known to be a
 * QuickBooks or Xero server; off a ledger server, a name booksguard has not catalogued is not its
 * business (undefined).
 */
export function judgeTool(name: string, onLedger: boolean): ToolVerdict | undefined {
  const hits = byName.get(name);
  const { verb, entity } = verbAndEntity(name);
  if (hits && hits.length > 0) {
    const write = hits.find((h) => h.kind === "write");
    const hit = write ?? hits[0]!;
    if (!write)
      return {
        kind: "read",
        op: "unknown",
        entity,
        family: hit.family,
        catalogued: true,
        generic: false,
      };
    return {
      kind: "write",
      op: WRITE_VERBS[verb] ?? "unknown",
      entity,
      family: hit.family,
      catalogued: true,
      generic: GENERIC_WRITES.has(name),
    };
  }
  if (!onLedger) return undefined;
  if (READ_VERBS.has(verb) || /(?:^|[-_])(report|generator|summary|info)$/.test(name))
    return { kind: "read", op: "unknown", entity, catalogued: false, generic: false };
  // a tool on a ledger server booksguard has not seen: a write by its verb, or held as unknown
  return {
    kind: "write",
    op: WRITE_VERBS[verb] ?? "unknown",
    entity,
    catalogued: false,
    generic: false,
  };
}

/** Every catalogued tool, for the README table and the tests. */
export function catalogueCounts(): { id: FamilyId; writes: number; reads: number }[] {
  return FAMILIES.map((f) => ({ id: f.id, writes: f.writes.length, reads: f.reads.length }));
}

/** "154 write tools across 4 servers, read 9 Oct 2026", for --help and the README. */
export const CATALOG_SUMMARY = `${FAMILIES.reduce((n, f) => n + f.writes.length, 0)} write tools across ${FAMILIES.filter((f) => f.writes.length > 0).length} servers, read 9 Oct 2026`;
