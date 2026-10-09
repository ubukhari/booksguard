var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/catalog.ts
function singular(word) {
  if (SINGULAR[word]) return SINGULAR[word];
  if (/ss$/.test(word)) return word;
  return word.endsWith("s") && word.length > 3 ? word.slice(0, -1) : word;
}
function verbAndEntity(name) {
  const special = {
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
    qbo_sales_send_invoice_reminder: { verb: "send", entity: "invoice reminder" }
  };
  if (special[name]) return special[name];
  const words = name.replace(/^qbo_(?:sales|contact|catalog|payroll|accounting|lending)_/, "").split(/[-_]/).filter(Boolean);
  const verb = words[0] ?? "";
  const rest = words.slice(1).map(singular);
  return { verb, entity: rest.join(" ") || "record" };
}
function judgeTool(name, onLedger) {
  const hits = byName.get(name);
  const { verb, entity } = verbAndEntity(name);
  if (hits && hits.length > 0) {
    const write = hits.find((h) => h.kind === "write");
    const hit = write ?? hits[0];
    if (!write)
      return {
        kind: "read",
        op: "unknown",
        entity,
        family: hit.family,
        catalogued: true,
        generic: false
      };
    return {
      kind: "write",
      op: WRITE_VERBS[verb] ?? "unknown",
      entity,
      family: hit.family,
      catalogued: true,
      generic: GENERIC_WRITES.has(name)
    };
  }
  if (!onLedger) return void 0;
  if (READ_VERBS.has(verb) || /(?:^|[-_])(report|generator|summary|info)$/.test(name))
    return { kind: "read", op: "unknown", entity, catalogued: false, generic: false };
  return {
    kind: "write",
    op: WRITE_VERBS[verb] ?? "unknown",
    entity,
    catalogued: false,
    generic: false
  };
}
var READ_ON, FAMILIES, GENERIC_WRITES, WRITE_VERBS, READ_VERBS, byName, SINGULAR, CATALOG_SUMMARY;
var init_catalog = __esm({
  "src/catalog.ts"() {
    "use strict";
    READ_ON = "2026-10-09";
    FAMILIES = [
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
          "quickbooks-transaction-import"
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
          "quickbooks-import-status"
        ]
      },
      {
        id: "intuit-local",
        ledger: "QuickBooks",
        label: "Intuit's QuickBooks Online MCP server",
        where: "https://github.com/intuit/quickbooks-online-mcp-server",
        source: "https://github.com/intuit/quickbooks-online-mcp-server/tree/31a1dd5c3e17/src/tools (commit of 15 Sep 2026)",
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
          "update-vendor"
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
          "search_vendors"
        ]
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
          "void_invoice"
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
          "search_vendors"
        ]
      },
      {
        id: "xero-hosted",
        ledger: "Xero",
        label: "Xero connector",
        where: "https://mcp.xero.com/mcp",
        source: "https://www.xero.com/ai-in-accounting/claude/",
        read: READ_ON,
        writes: [],
        reads: []
      },
      {
        id: "xero-local",
        ledger: "Xero",
        label: "Xero's MCP server",
        where: "https://github.com/XeroAPI/xero-mcp-server",
        source: "https://github.com/XeroAPI/xero-mcp-server/tree/f24583c867df/src/tools (commit of 5 Jun 2026)",
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
          "update-tracking-options"
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
          "list-trial-balance"
        ]
      }
    ];
    GENERIC_WRITES = /* @__PURE__ */ new Set([
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
      "update-quote"
    ]);
    WRITE_VERBS = {
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
      write: "update"
    };
    READ_VERBS = /* @__PURE__ */ new Set([
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
      "status"
    ]);
    byName = /* @__PURE__ */ new Map();
    for (const family of FAMILIES) {
      for (const name of family.writes)
        byName.set(name, [...byName.get(name) ?? [], { family, kind: "write" }]);
      for (const name of family.reads)
        byName.set(name, [...byName.get(name) ?? [], { family, kind: "read" }]);
    }
    SINGULAR = {
      entries: "entry",
      activities: "activity",
      agencies: "agency",
      classes: "class",
      options: "option",
      operations: "operation"
    };
    CATALOG_SUMMARY = `${FAMILIES.reduce((n, f) => n + f.writes.length, 0)} write tools across ${FAMILIES.filter((f) => f.writes.length > 0).length} servers, read 9 Oct 2026`;
  }
});

// src/rules.ts
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
function guardHome(home, env) {
  const fromEnv = env.BOOKSGUARD_HOME?.trim();
  return fromEnv ? path.resolve(fromEnv) : path.join(home, ".booksguard");
}
function strings(v) {
  return Array.isArray(v) && v.every((s) => typeof s === "string") ? v : void 0;
}
function positive(v) {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : void 0;
}
function readRules(dir) {
  const file = rulesFile(dir);
  if (!existsSync(file)) return { rules: { ...DEFAULT_RULES }, exists: false };
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    return {
      rules: { ...DEFAULT_RULES },
      exists: true,
      problem: `${file} is not valid JSON (${err.message}); the defaults apply`
    };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return {
      rules: { ...DEFAULT_RULES },
      exists: true,
      problem: `${file} is not a JSON object; the defaults apply`
    };
  const r = raw;
  const rules = {
    version: 1,
    mode: r.mode === "watch" ? "watch" : "hold",
    approval_window_minutes: positive(r.approval_window_minutes) ?? DEFAULT_RULES.approval_window_minutes,
    duplicate_window_hours: positive(r.duplicate_window_hours) ?? DEFAULT_RULES.duplicate_window_hours,
    ledger_servers: strings(r.ledger_servers) ?? [],
    hold_tools: strings(r.hold_tools) ?? [],
    pass_tools: strings(r.pass_tools) ?? []
  };
  return { rules, exists: true };
}
function renderRules(rules) {
  return JSON.stringify(
    {
      ...rules,
      _help: {
        mode: "hold: every QuickBooks or Xero write waits for a person's yes. watch: nothing is held; each would-be hold is logged (booksguard log).",
        approval_window_minutes: "how old the person's approving message may be when the agent retries",
        duplicate_window_hours: "a write identical to one released this recently is flagged DUPLICATE in its diff",
        ledger_servers: "MCP server names that are QuickBooks or Xero servers, beyond names containing quickbooks, qbo, intuit, xero or meridian (exact or * globs)",
        hold_tools: "tool names (or * globs) to hold on any server",
        pass_tools: "tool names (or * globs) never to hold"
      }
    },
    null,
    2
  ) + "\n";
}
function writeRules(dir, rules) {
  mkdirSync(dir, { recursive: true });
  const file = rulesFile(dir);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, renderRules(rules));
  renameSync(tmp, file);
}
function globMatch(name, pattern) {
  const re = new RegExp(
    `^${pattern.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`,
    "i"
  );
  return re.test(name);
}
var DEFAULT_RULES, UsageError, rulesFile, auditFile, holdsDir, anyGlob;
var init_rules = __esm({
  "src/rules.ts"() {
    "use strict";
    DEFAULT_RULES = {
      version: 1,
      mode: "hold",
      approval_window_minutes: 30,
      duplicate_window_hours: 24,
      ledger_servers: [],
      hold_tools: [],
      pass_tools: []
    };
    UsageError = class extends Error {
    };
    rulesFile = (dir) => path.join(dir, "rules.json");
    auditFile = (dir) => path.join(dir, "audit.jsonl");
    holdsDir = (dir) => path.join(dir, "holds");
    anyGlob = (name, patterns) => patterns.find((p) => globMatch(name, p));
  }
});

// src/classify.ts
import path2 from "node:path";
import { parseShell } from "@agentwares/agentguard-core";
function splitMcpName(client, toolName, serverHint) {
  if (client !== "gemini") {
    const m = /^mcp__(.+?)__(.+)$/.exec(toolName);
    return m ? { server: m[1], tool: m[2] } : void 0;
  }
  if (!toolName.startsWith("mcp_")) return void 0;
  const rest = toolName.slice(4);
  if (serverHint && rest.startsWith(`${serverHint}_`))
    return { server: serverHint, tool: rest.slice(serverHint.length + 1) };
  for (const family of FAMILIES)
    for (const name of [...family.writes, ...family.reads])
      if (rest.endsWith(`_${name}`) && rest.length > name.length + 1)
        return { server: rest.slice(0, -name.length - 1), tool: name };
  const i = rest.indexOf("_");
  return i > 0 ? { server: rest.slice(0, i), tool: rest.slice(i + 1) } : void 0;
}
function isLedgerServer(server, rules) {
  return LEDGER_NAME.test(server) || anyGlob(server, rules.ledger_servers) !== void 0;
}
function ledgerOf(server, family) {
  if (family) return family.ledger;
  return /xero/i.test(server) ? "Xero" : "QuickBooks";
}
function pickFamily(server, tool) {
  const candidates = FAMILIES.filter((f) => f.writes.includes(tool) || f.reads.includes(tool));
  if (candidates.length <= 1) return candidates[0];
  const hint = /meridian|pilot/i.test(server) ? "meridian" : /xero/i.test(server) ? "xero-local" : /quickbooks|qbo|intuit/i.test(server) ? "intuit-local" : void 0;
  return candidates.find((f) => f.id === hint);
}
function ledgerFor(server, tool, family) {
  if (family) return family.ledger;
  const ledgers = new Set(
    FAMILIES.filter((f) => f.writes.includes(tool) || f.reads.includes(tool)).map((f) => f.ledger)
  );
  if (ledgers.size === 1) return [...ledgers][0];
  return ledgerOf(server);
}
function companyOf(args, depth = 0) {
  if (!isObject(args) || depth > 2) return void 0;
  for (const key of COMPANY_KEYS) {
    const v = args[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  for (const v of Object.values(args)) {
    const found = companyOf(v, depth + 1);
    if (found) return found;
  }
  return void 0;
}
function refineEntity(entity, args, depth = 0) {
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
function classifyMcp(client, input, ctx) {
  const toolName = input.tool_name ?? "";
  const split = splitMcpName(client, toolName, str(input.mcp_context?.server_name));
  if (!split) return { kind: "pass", why: "not an MCP tool" };
  const { server, tool } = split;
  const args = input.tool_input ?? {};
  if (anyGlob(tool, ctx.rules.pass_tools) || anyGlob(toolName, ctx.rules.pass_tools))
    return { kind: "pass", why: `pass_tools in rules.json` };
  const onLedger = isLedgerServer(server, ctx.rules);
  const ruleHold = anyGlob(tool, ctx.rules.hold_tools) ?? anyGlob(toolName, ctx.rules.hold_tools);
  const verdict = judgeTool(tool, onLedger || ruleHold !== void 0);
  if (ruleHold) {
    const family2 = pickFamily(server, tool);
    return {
      kind: "ledger-write",
      ledger: ledgerFor(server, tool, family2),
      via: "mcp",
      server,
      tool,
      family: family2,
      op: verdict?.kind === "write" ? verdict.op : "unknown",
      entity: verdict?.entity ?? "record",
      company: companyOf(args),
      args,
      why: `hold_tools "${ruleHold}" in rules.json`
    };
  }
  if (!verdict) return { kind: "pass", why: `${server} is not a QuickBooks or Xero server` };
  const family = verdict.catalogued ? pickFamily(server, tool) : void 0;
  const ledger = ledgerFor(server, tool, family);
  if (verdict.kind === "read")
    return {
      kind: "read",
      ledger,
      server,
      tool,
      why: verdict.catalogued ? `a read of ${familiesText(tool, family)}` : "a read"
    };
  const write = (why) => ({
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
    why
  });
  const catalogued = `a write tool of ${familiesText(tool, family)}`;
  if (onLedger)
    return write(
      verdict.catalogued ? catalogued : `a tool on a ${ledger} server that booksguard has not catalogued and that does not read, held until it is`
    );
  if (!verdict.generic) return write(catalogued);
  if (OPAQUE.test(server))
    return write(
      `${catalogued}, on a connector whose name the harness does not show (${server.slice(0, 8)}\u2026)`
    );
  return {
    kind: "pass",
    why: `${tool} on ${server}, which is not a QuickBooks or Xero server`
  };
}
function familiesText(tool, family) {
  if (family) return family.label;
  const labels = FAMILIES.filter((f) => f.writes.includes(tool) || f.reads.includes(tool)).map(
    (f) => f.label
  );
  return labels.length ? labels.join(" or ") : "a QuickBooks or Xero server";
}
function flagValue(argv, i) {
  const a = argv[i];
  const eq = a.indexOf("=");
  if (a.startsWith("--") && eq > 0) return { value: a.slice(eq + 1), skip: 0 };
  return { value: argv[i + 1], skip: 1 };
}
function parseUrl(word) {
  if (!/^https?:\/\//i.test(word)) return void 0;
  try {
    return new URL(word);
  } catch {
    return void 0;
  }
}
function httpCallOf(cmd) {
  const argv = cmd.argv;
  const bin = path2.basename(argv[0] ?? "");
  const headers = {};
  let method;
  let body;
  let url;
  const header = (h) => {
    if (!h) return;
    const c = h.indexOf(":");
    if (c > 0) headers[h.slice(0, c).trim().toLowerCase()] = h.slice(c + 1).trim();
  };
  if (bin === "curl") {
    for (let i = 1; i < argv.length; i += 1) {
      const a = argv[i];
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
      else if (DATA_FLAGS.has(a.split("=")[0])) {
        const { value, skip } = flagValue(argv, i);
        body ??= value;
        i += skip;
      } else if (a === "--url") {
        url ??= parseUrl(argv[i + 1] ?? "");
        i += 1;
      } else url ??= parseUrl(a);
    }
    if (!method) method = body !== void 0 ? "POST" : "GET";
  } else if (bin === "wget") {
    for (let i = 1; i < argv.length; i += 1) {
      const a = argv[i];
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
      method = rest.shift().toUpperCase();
    }
    const target = rest.shift();
    if (target) url = parseUrl(target) ?? parseUrl(`https://${target}`);
    const items = rest.filter((a) => /^[^=:]+(:=|=|@)/.test(a) || /^[\w-]+:/.test(a));
    for (const item of items) if (/^[\w-]+:[^=]/.test(item)) header(item);
    const data = items.filter((a) => /^[^=:]+(:=|=)/.test(a));
    if (data.length > 0) body = JSON.stringify(Object.fromEntries(data.map((d) => d.split(/:?=/))));
    method ??= data.length > 0 ? "POST" : "GET";
  } else return void 0;
  if (!url) return void 0;
  return { method: method ?? "GET", url, body, headers };
}
function parseBody(body) {
  if (body === void 0) return void 0;
  if (body.startsWith("@"))
    return { body_file: body.slice(1), note: "read from a file; not opened" };
  try {
    return JSON.parse(body);
  } catch {
    return { body: body.length > 200 ? `${body.slice(0, 200)}\u2026` : body };
  }
}
function judgeRest(call) {
  const host = call.url.hostname.toLowerCase();
  const method = call.method;
  const read = method === "GET" || method === "HEAD" || method === "OPTIONS";
  if (QBO_HOSTS.includes(host)) {
    const m = /\/v3\/company\/([^/]+)\/([^/?]+)(?:\/([^/?]+))?(?:\/([^/?]+))?/i.exec(
      call.url.pathname
    );
    const realm = m?.[1];
    const entity = (m?.[2] ?? "").toLowerCase();
    const tool = `${method} ${call.url.pathname}${call.url.search}`;
    if (read || entity === "query" || entity === "reports" || entity === "cdc")
      return { kind: "read", ledger: "QuickBooks", server: host, tool, why: `a ${method} read` };
    const operation = call.url.searchParams.get("operation")?.toLowerCase();
    const args = parseBody(call.body);
    const hasId = isObject(args) && ("Id" in args || Object.values(args).some((v) => isObject(v) && "Id" in v));
    let op = operation === "delete" ? "delete" : operation === "void" ? "void" : "create";
    if (operation === "update" || op === "create" && hasId) op = "update";
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
      why: `a ${method} to the QuickBooks Accounting API`
    };
  }
  if (XERO_HOSTS.includes(host)) {
    const tool = `${method} ${call.url.pathname}`;
    if (read) return { kind: "read", ledger: "Xero", server: host, tool, why: `a ${method} read` };
    const m = /\/[a-z]+\.xro\/[\d.]+\/([^/?]+)(?:\/([^/?]+))?/i.exec(call.url.pathname);
    const entity = (m?.[1] ?? "record").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/s$/, "");
    const op = method === "DELETE" ? "delete" : method === "PUT" ? "create" : m?.[2] ? "update" : "create";
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
      why: `a ${method} to Xero's API`
    };
  }
  return void 0;
}
function hookSettingsFiles(cwd, home, env) {
  const out = [];
  for (const root of [cwd, home]) {
    if (!root) continue;
    out.push(
      path2.join(root, ".claude", "settings.json"),
      path2.join(root, ".claude", "settings.local.json"),
      path2.join(root, ".codex", "hooks.json"),
      path2.join(root, ".codex", "config.toml"),
      path2.join(root, ".gemini", "settings.json")
    );
  }
  const claudeDir2 = env.CLAUDE_CONFIG_DIR?.split(",")[0]?.trim();
  if (claudeDir2) out.push(path2.join(path2.resolve(claudeDir2), "settings.json"));
  if (env.CODEX_HOME) out.push(path2.join(path2.resolve(env.CODEX_HOME), "hooks.json"));
  return [...new Set(out.map((p) => path2.resolve(p)))];
}
function editPaths(client, tool, input, cwd) {
  if (client === "codex" && tool === "apply_patch") {
    const patch = str(input.command) ?? str(input.input) ?? str(input.patch) ?? "";
    const out = [];
    for (const line of patch.split("\n")) {
      const m = /^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/.exec(line.trim());
      if (m) out.push(path2.resolve(cwd, m[1].trim()));
    }
    return out;
  }
  const p = str(input.file_path) ?? str(input.notebook_path) ?? str(input.absolute_path) ?? str(input.path);
  return p ? [path2.resolve(cwd, p)] : [];
}
function shellCommandOf(client, input) {
  const raw = input.command ?? input.cmd;
  if (Array.isArray(raw)) return raw.map(String).join(" ");
  return str(raw) ?? "";
}
function selfApproval(cmds) {
  for (const cmd of cmds) {
    const i = cmd.argv.findIndex(
      (a) => /booksguard(?:@[\w.^~-]+)?$/.test(a) || /booksguard\/dist\/cli\.js$/.test(a)
    );
    if (i < 0) continue;
    const verb = cmd.argv.slice(i + 1).find((a) => !a.startsWith("-"));
    if (verb === "approve" || verb === "uninstall") return verb;
  }
  return void 0;
}
function classifyShell(client, input, cwd, ctx) {
  const command = shellCommandOf(client, input);
  if (!command.trim()) return { kind: "pass", why: "empty command" };
  const cmds = parseShell(command, { cwd, home: ctx.home });
  const self = selfApproval(cmds);
  if (self)
    return {
      kind: "refuse",
      tool: `booksguard ${self}`,
      why: `an agent may not run \`booksguard ${self}\`: a person approves held writes and removes the hook`,
      fix: "stop and ask the person to run it in their own terminal (in Claude Code they can type `!` and the command); do not try another way"
    };
  const guardDir = path2.resolve(ctx.guardDir);
  const mentionsGuardDir = command.includes(guardDir) || /(?:^|[\s"'=~/\\])\.booksguard(?:[/\\]|\s|$|["'])/.test(command);
  if (mentionsGuardDir) {
    const readOnly = cmds.every(
      (c) => READ_ONLY_BINS.has(path2.basename(c.argv[0] ?? "")) && c.redirects.every((r) => r.op === "<" || r.op === "2>&1" || r.op === ">&2") && !c.argv.includes("-delete") && !c.argv.includes("-exec")
    );
    if (!readOnly)
      return {
        kind: "refuse",
        tool: "a shell command writing booksguard's home",
        why: "booksguard's home (rules, holds and the audit log) is changed by a person or by booksguard, not by the agent it guards",
        fix: "do not modify it; tell the person what you wanted to change"
      };
  }
  const touchesHost = HOST_RE.test(command);
  if (touchesHost) {
    let firstWrite;
    let sawRead;
    let unread = false;
    for (const cmd of cmds) {
      const text = cmd.argv.join(" ");
      if (!HOST_RE.test(text)) continue;
      const call = httpCallOf(cmd);
      const verdict = call ? judgeRest(call) : void 0;
      if (!verdict) unread = true;
      else if (verdict.kind === "read") sawRead ??= verdict;
      else firstWrite ??= verdict;
    }
    if (firstWrite) return firstWrite;
    if (unread || !sawRead) {
      const host = HOST_RE.exec(command)[0].toLowerCase();
      return {
        kind: "ledger-write",
        ledger: /xero/.test(host) ? "Xero" : "QuickBooks",
        via: "rest",
        server: host,
        tool: command.replace(/\s+/g, " ").trim().slice(0, 120),
        op: "unknown",
        entity: "request",
        args: { command: command.length > 400 ? `${command.slice(0, 400)}\u2026` : command },
        why: `a command naming ${host} that booksguard cannot read as a plain GET`
      };
    }
    return sawRead;
  }
  const settings = hookSettingsFiles(cwd, ctx.home, ctx.env);
  const named = settings.find(
    (f) => command.includes(f) || command.includes(f.replace(ctx.home, "~"))
  );
  if (named) {
    const readOnly = cmds.every(
      (c) => READ_ONLY_BINS.has(path2.basename(c.argv[0] ?? "")) && c.redirects.every((r) => r.op === "<" || r.op === "2>&1" || r.op === ">&2")
    );
    if (!readOnly)
      return {
        kind: "guard-config",
        tool: SHELL_TOOLS[client].values().next().value ?? "shell",
        target: named,
        why: "a shell command that may change a harness's hook settings, where booksguard's hook lives"
      };
  }
  return { kind: "pass", why: "a shell command that touches no ledger" };
}
function classify(client, input, ctx) {
  const tool = input.tool_name ?? "";
  const toolInput = isObject(input.tool_input) ? input.tool_input : {};
  const cwd = path2.resolve(input.cwd || process.cwd());
  if (/^mcp_/.test(tool)) return classifyMcp(client, input, ctx);
  if (SHELL_TOOLS[client].has(tool)) return classifyShell(client, toolInput, cwd, ctx);
  if (EDIT_TOOLS[client].has(tool)) {
    const paths = editPaths(client, tool, toolInput, cwd);
    const guardDir = path2.resolve(ctx.guardDir);
    const intoGuard = paths.find((p) => within(p, guardDir));
    if (intoGuard)
      return {
        kind: "refuse",
        tool,
        why: `booksguard's home (${intoGuard}) is changed by a person or by booksguard, not by the agent it guards`,
        fix: "do not modify it; tell the person what you wanted to change"
      };
    const settings = new Set(hookSettingsFiles(cwd, ctx.home, ctx.env));
    const hit = paths.find((p) => settings.has(p));
    if (hit)
      return {
        kind: "guard-config",
        tool,
        target: hit,
        why: "an edit of a harness's hook settings, where booksguard's hook lives"
      };
    return { kind: "pass", why: "an edit outside booksguard's concern" };
  }
  return { kind: "pass", why: `${tool || "this tool"} is not booksguard's concern` };
}
var LEDGER_NAME, OPAQUE, isObject, str, COMPANY_KEYS, QBO_HOSTS, XERO_HOSTS, LEDGER_HOSTS, HOST_RE, DATA_FLAGS, READ_ONLY_BINS, EDIT_TOOLS, SHELL_TOOLS, within;
var init_classify = __esm({
  "src/classify.ts"() {
    "use strict";
    init_catalog();
    init_rules();
    LEDGER_NAME = /quickbooks|qbo|intuit|xero|meridian/i;
    OPAQUE = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{24,})$/i;
    isObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
    str = (v) => typeof v === "string" ? v : void 0;
    COMPANY_KEYS = [
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
      "organization_id"
    ];
    QBO_HOSTS = ["quickbooks.api.intuit.com", "sandbox-quickbooks.api.intuit.com"];
    XERO_HOSTS = ["api.xero.com"];
    LEDGER_HOSTS = [...QBO_HOSTS, ...XERO_HOSTS];
    HOST_RE = /\b(?:sandbox-quickbooks\.api\.intuit\.com|quickbooks\.api\.intuit\.com|api\.xero\.com)\b/i;
    DATA_FLAGS = /* @__PURE__ */ new Set([
      "-d",
      "--data",
      "--data-raw",
      "--data-binary",
      "--data-ascii",
      "--data-urlencode",
      "--json",
      "-F",
      "--form",
      "--form-string"
    ]);
    READ_ONLY_BINS = /* @__PURE__ */ new Set([
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
      "find"
    ]);
    EDIT_TOOLS = {
      claude: /* @__PURE__ */ new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]),
      codex: /* @__PURE__ */ new Set(["apply_patch"]),
      gemini: /* @__PURE__ */ new Set(["write_file", "replace"])
    };
    SHELL_TOOLS = {
      claude: /* @__PURE__ */ new Set(["Bash", "PowerShell"]),
      codex: /* @__PURE__ */ new Set(["Bash", "exec_command", "shell"]),
      gemini: /* @__PURE__ */ new Set(["run_shell_command"])
    };
    within = (p, dir) => p === dir || p.startsWith(dir + path2.sep);
  }
});

// src/diff.ts
function money(n) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function unwrap(args) {
  let cur = args;
  for (let i = 0; i < 3; i += 1) {
    if (!isObject2(cur)) return cur;
    const here = cur;
    const keys = Object.keys(here);
    if (keys.some((k) => LINE_KEYS.includes(k))) return cur;
    const objects = keys.filter((k) => isObject2(here[k]));
    if (keys.length > 1 && objects.length === 1 && keys.every((k) => k === objects[0] || !isObject2(here[k]) && !Array.isArray(here[k]))) {
      cur = here[objects[0]];
      continue;
    }
    if (keys.length !== 1) return cur;
    const only = here[keys[0]];
    if (ID_KEYS.includes(keys[0])) return cur;
    if (Array.isArray(only) && only.length === 1 && isObject2(only[0])) {
      cur = only[0];
      continue;
    }
    if (!isObject2(only)) return cur;
    if (refText(only) !== void 0 && Object.keys(only).length <= 3) return cur;
    cur = only;
  }
  return cur;
}
function refText(v) {
  const id = v.value ?? v.Value ?? v.id ?? v.Id ?? v.ContactID ?? v.contactID;
  const name = v.name ?? v.Name ?? v.DisplayName ?? v.displayName;
  if (typeof id === "string" || typeof id === "number")
    return typeof name === "string" && name ? `${name} (${id})` : String(id);
  return void 0;
}
function scalarText(v, limit = 80) {
  const s = typeof v === "string" ? JSON.stringify(v) : String(v);
  return s.length > limit ? `${s.slice(0, limit - 1)}\u2026` : s;
}
function valueText(v, depth = 0) {
  if (v === null || v === void 0) return String(v);
  if (typeof v !== "object") return scalarText(v);
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x !== "object")) return scalarText(v.map(String).join(", "), 100);
    return `${v.length} item${v.length === 1 ? "" : "s"}`;
  }
  const ref = refText(v);
  if (ref && Object.keys(v).length <= 3) return ref;
  if (depth >= 2) return "{\u2026}";
  const parts = Object.entries(v).filter(([, x]) => x !== void 0 && x !== null && x !== "").map(([k, x]) => `${k} ${valueText(x, depth + 1)}`);
  const s = parts.join(" \xB7 ");
  return s.length > 140 ? `${s.slice(0, 139)}\u2026` : s;
}
function findLines(obj) {
  for (const key of LINE_KEYS) {
    const v = obj[key];
    if (Array.isArray(v) && v.length > 0 && v.every(isObject2)) return { key, lines: v };
  }
  return void 0;
}
function lineAmount(line) {
  for (const k of ["Amount", "amount", "lineAmount", "LineAmount", "total", "Total"]) {
    const n = num(line[k]);
    if (n !== void 0) return n;
  }
  const q = num(line.qty ?? line.Qty ?? line.quantity ?? line.Quantity);
  const p = num(
    line.unit_price ?? line.UnitPrice ?? line.unitAmount ?? line.UnitAmount ?? line.unit_amount ?? line.rate
  );
  if (q !== void 0 && p !== void 0) return q * p;
  for (const v of Object.values(line)) {
    if (!isObject2(v)) continue;
    const dq = num(v.Qty ?? v.qty ?? v.quantity);
    const dp = num(v.UnitPrice ?? v.unit_price ?? v.unitAmount ?? v.UnitAmount);
    if (dq !== void 0 && dp !== void 0) return dq * dp;
  }
  const debit = num(line.debit ?? line.Debit);
  const credit = num(line.credit ?? line.Credit);
  if (debit !== void 0 || credit !== void 0) return (debit ?? 0) - (credit ?? 0);
  return void 0;
}
function posting(line, key) {
  const detail = isObject2(line.JournalEntryLineDetail) ? line.JournalEntryLineDetail : void 0;
  const t = detail?.PostingType ?? line.PostingType ?? line.posting_type ?? line.postingType;
  if (typeof t === "string") return /^d/i.test(t) ? "debit" : /^c/i.test(t) ? "credit" : void 0;
  if (num(line.debit ?? line.Debit) !== void 0) return "debit";
  if (num(line.credit ?? line.Credit) !== void 0) return "credit";
  if (key === "manualJournalLines" || key === "journalLines" || key === "JournalLines") {
    const n = num(line.lineAmount ?? line.LineAmount);
    if (n !== void 0) return n >= 0 ? "debit" : "credit";
  }
  return void 0;
}
function moneyOf(args) {
  const obj = unwrap(args);
  if (!isObject2(obj)) return {};
  const out = {};
  for (const k of CURRENCY_KEYS) {
    const c = obj[k];
    const text = isObject2(c) ? refText(c) : typeof c === "string" ? c : void 0;
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
      if (amount === void 0) continue;
      any = true;
      if (side === "debit") debits += Math.abs(amount);
      else if (side === "credit") credits += Math.abs(amount);
      else total += amount;
    }
    out.lines = found.lines.length;
    if (journal) {
      out.debits = round(debits);
      out.credits = round(credits);
      out.balanced = Math.abs(debits - credits) < 5e-3;
      out.total = round(debits);
    } else if (any) out.total = round(total);
  }
  if (out.total === void 0)
    for (const k of TOTAL_KEYS) {
      const n = num(obj[k]);
      if (n !== void 0) {
        out.total = n;
        break;
      }
    }
  return out;
}
function targetOf(args) {
  const obj = isObject2(args) && isObject2(args.params) ? args.params : args;
  if (typeof obj === "string" || typeof obj === "number") return String(obj);
  if (!isObject2(obj)) return void 0;
  for (const k of ID_KEYS) {
    const v = obj[k];
    if (typeof v === "string" || typeof v === "number") return String(v);
    if (isObject2(v)) {
      const inner2 = v.Id ?? v.id;
      if (typeof inner2 === "string" || typeof inner2 === "number") return String(inner2);
    }
  }
  const inner = unwrap(obj);
  if (isObject2(inner) && inner !== obj) {
    const id = inner.Id ?? inner.id;
    if (typeof id === "string" || typeof id === "number") return String(id);
  }
  return void 0;
}
function actionText(w, target) {
  return `${OP_WORD[w.op] ?? w.op} ${w.entity}${target ? ` ${target}` : ""}`;
}
function moneyText(m) {
  const cur = m.currency ? ` ${m.currency}` : "";
  if (m.debits !== void 0 && m.credits !== void 0) {
    const state = m.balanced ? "balanced" : `OUT OF BALANCE by ${money(Math.abs(m.debits - m.credits))}`;
    return `debits ${money(m.debits)}${cur}, credits ${money(m.credits)}${cur}: ${state}`;
  }
  if (m.total !== void 0)
    return `total ${money(m.total)}${cur}${m.lines ? ` across ${m.lines} line${m.lines === 1 ? "" : "s"}` : ""}`;
  return void 0;
}
function where(w) {
  if (w.via === "rest") return `${w.ledger} API (${w.server})`;
  const server = OPAQUE2.test(w.server) ? `connector ${w.server.slice(0, 8)}\u2026` : `"${w.server}"`;
  return `${w.ledger} via ${server}${w.family ? ` (${w.family.label})` : ""}`;
}
function amountText(m) {
  const cur = m.currency ? ` ${m.currency}` : "";
  if (m.debits !== void 0)
    return ` ${money(m.debits)}${cur}${m.balanced ? "" : " OUT OF BALANCE"}`;
  return m.total !== void 0 ? ` ${money(m.total)}${cur}` : "";
}
function lineText(line) {
  const flat = {};
  for (const [k, v] of Object.entries(line)) {
    if (LINE_SKIP.has(k)) continue;
    if (/Detail$/.test(k) && isObject2(v)) {
      for (const [dk, dv] of Object.entries(v)) if (!LINE_SKIP.has(dk)) flat[dk] = dv;
    } else flat[k] = v;
  }
  return Object.keys(flat).length ? valueText(flat) : "";
}
function renderDiff(w) {
  if (w.kind === "guard-config")
    return {
      title: `change a harness's hook settings (${w.target})`,
      lines: [`~ ${w.target}: ${w.why}`],
      money: {},
      target: w.target
    };
  const target = w.op === "create" ? void 0 : targetOf(w.args);
  const sign = OP_SIGN[w.op] ?? "?";
  const lines = [];
  const obj = unwrap(w.args);
  const m = moneyOf(w.args);
  if (w.op === "delete" || w.op === "void") {
    lines.push(`- ${w.op} ${w.entity}${target ? ` ${target}` : " (id not on the call)"}`);
  } else if (isObject2(obj)) {
    const linesFound = findLines(obj);
    for (const [k, v] of Object.entries(obj)) {
      if (v === void 0 || v === null || v === "") continue;
      if (linesFound && k === linesFound.key) continue;
      if (ID_KEYS.includes(k) && w.op !== "create" && String(v) === target) continue;
      lines.push(`${sign} ${k}: ${valueText(v)}`);
    }
    if (linesFound)
      linesFound.lines.forEach((line, i) => {
        const amount = lineAmount(line);
        const side = posting(line, linesFound.key);
        const head = [side, amount !== void 0 ? money(Math.abs(amount)) : void 0].filter(Boolean).join(" ");
        const rest = lineText(line);
        lines.push(`${sign} line ${i + 1}: ${[head, rest].filter(Boolean).join(" \xB7 ")}`);
      });
  } else if (obj !== void 0) {
    lines.push(`${sign} ${valueText(obj)}`);
  }
  if (w.op === "update" || w.op === "approve")
    lines.push("  (current values not read: booksguard never calls QuickBooks or Xero)");
  const total = moneyText(m);
  if (total) lines.push(`= ${total}`);
  const shown = lines.length > MAX_LINES ? [...lines.slice(0, MAX_LINES - 1), `\u2026 ${lines.length - MAX_LINES + 1} more lines`] : lines;
  const company = w.company ? ` \xB7 company ${w.company}` : "";
  return {
    title: `${actionText(w, target)}${amountText(m)} \xB7 ${where(w)}${company}`,
    lines: shown,
    money: m,
    target
  };
}
var isObject2, MAX_LINES, LINE_KEYS, ID_KEYS, TOTAL_KEYS, CURRENCY_KEYS, num, round, OP_SIGN, OP_WORD, OPAQUE2, LINE_SKIP;
var init_diff = __esm({
  "src/diff.ts"() {
    "use strict";
    isObject2 = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
    MAX_LINES = 30;
    LINE_KEYS = [
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
      "items"
    ];
    ID_KEYS = [
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
      "timesheetId"
    ];
    TOTAL_KEYS = ["total_amt", "TotalAmt", "total", "Total", "amount", "Amount", "totalAmount"];
    CURRENCY_KEYS = ["currency", "currency_ref", "CurrencyRef", "currencyCode", "CurrencyCode"];
    num = (v) => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
      return void 0;
    };
    round = (n) => Math.round(n * 100) / 100;
    OP_SIGN = {
      create: "+",
      import: "+",
      upload: "+",
      batch: "+",
      approve: "~",
      update: "~",
      delete: "-",
      void: "-",
      revert: "-",
      send: "\u2192",
      unknown: "?"
    };
    OP_WORD = {
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
      unknown: "write"
    };
    OPAQUE2 = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{24,})$/i;
    LINE_SKIP = /* @__PURE__ */ new Set([
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
      "Credit"
    ]);
  }
});

// src/approval.ts
import { closeSync, existsSync as existsSync2, openSync, readSync, statSync } from "node:fs";
import { scanTranscript } from "@agentwares/agentguard-core";
function readTail(file, bytes, size) {
  const length = Math.min(bytes, size);
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(length);
    readSync(fd, buf, 0, length, size - length);
    return buf.toString("utf8");
  } finally {
    closeSync(fd);
  }
}
function latestHumanTurn(file) {
  if (!file) return { missing: "the hook's input carried no transcript_path" };
  if (!existsSync2(file)) return { missing: `no transcript at ${file}` };
  let size;
  try {
    size = statSync(file).size;
  } catch (err) {
    return { missing: `the transcript could not be read (${err.message})` };
  }
  for (const step of STEPS) {
    let turn;
    try {
      turn = scanTranscript(readTail(file, step, size)).turn;
    } catch (err) {
      return { missing: `the transcript could not be read (${err.message})` };
    }
    if (turn) return { turn };
    if (step >= size) break;
  }
  return { missing: "no message typed by a person in the transcript" };
}
function holdWords(hold) {
  return [
    hold.id,
    ...hold.entity.split(/\s+/).filter((w) => w.length > 2),
    hold.ledger,
    "booksguard",
    "post",
    "approve",
    "quickbooks",
    "xero",
    "books",
    "ledger"
  ];
}
function approvalFromTurn(evidence, hold, now, windowMinutes) {
  const turn = evidence.turn;
  if (!turn)
    return {
      ok: false,
      reason: evidence.missing ?? "no message typed by a person in the transcript"
    };
  const at = Date.parse(turn.at);
  if (!(at > Date.parse(hold.created_at)))
    return {
      ok: false,
      reason: `the person's latest message (${hhmm(turn.at)}) came before the hold (${hhmm(hold.created_at)}), so they have not answered it yet`
    };
  const ageMin = (now - at) / 6e4;
  if (ageMin > windowMinutes)
    return {
      ok: false,
      reason: `the person's latest message is ${Math.round(ageMin)} minutes old; an approval counts for ${windowMinutes}`
    };
  const text = turn.text.trim();
  const by = `message at ${hhmm(turn.at)} UTC (${quoteOf(text)})`;
  if (REFUSAL.test(text))
    return {
      ok: false,
      reason: `the person's latest message ${quoteOf(text)} does not approve it as it stands`
    };
  if (STRONG.test(text))
    return { ok: true, reason: `approved by the person's ${by}`, by, at: turn.at };
  if (WEAK.test(text) && text.length <= 80) {
    const asked = (turn.assistantBefore ?? "").toLowerCase();
    const tie = holdWords(hold).find((w) => w && asked.includes(w.toLowerCase()));
    if (asked.includes("?") && tie)
      return {
        ok: true,
        reason: `approved by the person's ${by}, answering a question about it`,
        by,
        at: turn.at
      };
    return {
      ok: false,
      reason: `the person's latest message ${quoteOf(text)} does not answer a question about this ${hold.entity}`
    };
  }
  return {
    ok: false,
    reason: `the person's latest message ${quoteOf(text)} does not approve it`
  };
}
var STEPS, REFUSAL, STRONG, WEAK, hhmm, quoteOf;
var init_approval = __esm({
  "src/approval.ts"() {
    "use strict";
    STEPS = [1 << 20, 8 << 20, 64 << 20];
    REFUSAL = /\b(no|nope|nah|don'?t|do not|never|stop|cancel|wait|hold (?:on|off)|reject(?:ed)?|decline[d]?|deny|denied|instead|wrong|not yet|but|except|rather|undo)\b|\bchange\b.*\bto\b/i;
    STRONG = /\b(approve[ds]?|approved|confirm(?:ed)?|(?:post|send|delete|void|update|change|record|create|import) (?:it|them|this|these|that|those|all|both)|go ahead and (?:post|create|send|save|record|delete|void|update)|ship it)\b/i;
    WEAK = /^\s*(y|yes|yep|yeah|yup|ok|okay|k|sure|go|go ahead|go for it|do it|please do|proceed|lgtm|sounds good|correct|right|yes please|please)\b/i;
    hhmm = (iso) => iso.slice(11, 16) || iso;
    quoteOf = (text) => {
      const t = text.trim().replace(/\s+/g, " ");
      return `\u201C${t.length > 60 ? `${t.slice(0, 59)}\u2026` : t}\u201D`;
    };
  }
});

// src/audit.ts
import {
  sha256Hex,
  stableStringify
} from "@agentwares/agentguard-core";
import { FileAuditSink, readAuditFile, verifyAuditFile } from "@agentwares/agentguard-core/node";
function recordOf(hold) {
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
    approved_by: hold.approved_by
  };
}
async function appendAudit(guardDir, e) {
  try {
    const sink = new FileAuditSink(auditFile(guardDir));
    const entry = {
      ts: new Date(e.now).toISOString(),
      run_id: `booksguard_${e.client}_${e.session ?? "unknown"}`,
      agent: "booksguard",
      ...e.session ? { session_id: e.session } : {},
      tool: e.toolName,
      class: "write",
      verb: VERB[e.record.op] ?? "unknown",
      mode: e.event === "would-hold" ? "dry-run" : "enforce",
      outcome: OUTCOME[e.event],
      ...e.error ? { error: e.error } : {},
      args_hash: await sha256Hex(stableStringify(e.args ?? null)),
      args: { booksguard: e.event, ledger: e.record },
      reason: e.reason,
      hook: {
        client: e.client,
        summary: e.record.title,
        decision: e.event === "released" || e.event === "would-hold" ? "allow" : "deny",
        ...e.record.hold ? { approval_id: e.record.hold } : {},
        ...e.humanTurn ? { human_turn: e.humanTurn } : {}
      }
    };
    return await sink.append(entry);
  } catch {
    return void 0;
  }
}
function readLog(guardDir) {
  const rows = [];
  for (const e of readAuditFile(auditFile(guardDir))) {
    if (e.agent !== "booksguard") continue;
    const a = e.args;
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
      hash: e.hash
    });
  }
  return rows;
}
function summarize(rows, month, company) {
  const inMonth = rows.filter((r) => r.ts.startsWith(month));
  const byClient = /* @__PURE__ */ new Map();
  for (const r of inMonth) {
    const c = clientOf(r);
    if (company && !c.toLowerCase().includes(company.toLowerCase())) continue;
    byClient.set(c, [...byClient.get(c) ?? [], r]);
  }
  const releasedHolds = new Set(rows.filter((r) => r.event === "released").map((r) => r.hold));
  return {
    month,
    clients: [...byClient.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([client, list]) => {
      const held = list.filter((r) => r.event === "held");
      const released = list.filter((r) => r.event === "released");
      return {
        client,
        held: held.length,
        released: released.length,
        refused: list.filter((r) => r.event === "refused" || r.event === "killed").length,
        waiting: held.filter((r) => !releasedHolds.has(r.hold)).length,
        released_total: Math.round(released.reduce((n, r) => n + (r.total ?? 0), 0) * 100) / 100,
        rows: list
      };
    })
  };
}
function toCsv(rows) {
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
        r.total !== void 0 ? r.total.toFixed(2) : "",
        r.approved_by ?? "",
        r.hold ?? "",
        r.client,
        r.hash
      ].map(csvCell).join(",")
    );
  return lines.join("\n") + "\n";
}
function renderSummary(s) {
  if (s.clients.length === 0) return `${s.month}: no AI writes to QuickBooks or Xero were held.
`;
  const out = [`AI writes to the books, ${s.month}, per client`];
  for (const c of s.clients) {
    out.push("");
    out.push(
      `${c.client}: ${c.held} held, ${c.released} released${c.released_total ? ` (${money(c.released_total)})` : ""}, ${c.waiting} still waiting, ${c.refused} refused`
    );
    for (const r of c.rows) {
      if (r.event === "still-held") continue;
      const when = `${r.ts.slice(5, 10)} ${r.ts.slice(11, 16)}`;
      const who = r.event === "released" && r.approved_by ? ` \u2014 ${r.approved_by}` : "";
      out.push(`  ${when}  ${r.event.padEnd(10)} ${r.title}${who}`);
    }
  }
  return out.join("\n") + "\n";
}
var OUTCOME, VERB, verifyLog, clientOf, csvCell, CSV_HEADER;
var init_audit = __esm({
  "src/audit.ts"() {
    "use strict";
    init_diff();
    init_rules();
    OUTCOME = {
      held: "pending",
      "still-held": "pending",
      released: "ok",
      refused: "blocked",
      killed: "halted",
      "would-hold": "ok"
    };
    VERB = {
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
      send: "send"
    };
    verifyLog = (guardDir) => verifyAuditFile(auditFile(guardDir));
    clientOf = (r) => r.company ? `${r.ledger} ${r.company}` : `folder ${r.folder}`;
    csvCell = (v) => {
      const s = v === void 0 || v === null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    CSV_HEADER = [
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
      "entry_hash"
    ];
  }
});

// src/holds.ts
import { createHash } from "node:crypto";
import {
  existsSync as existsSync3,
  mkdirSync as mkdirSync2,
  readdirSync,
  readFileSync as readFileSync2,
  renameSync as renameSync2,
  writeFileSync as writeFileSync2
} from "node:fs";
import path3 from "node:path";
import { stableStringify as stableStringify2 } from "@agentwares/agentguard-core";
import { withFileLock } from "@agentwares/agentguard-core/node";
function identityOf(server, tool, args) {
  return createHash("sha256").update(stableStringify2({ server, tool, args: args ?? null })).digest("hex");
}
function newHoldId(identity, createdAt) {
  return `bg_${createHash("sha256").update(`${identity}:${createdAt}`).digest("hex").slice(0, 8)}`;
}
var HOLD_TTL_MS, HoldStore;
var init_holds = __esm({
  "src/holds.ts"() {
    "use strict";
    init_rules();
    HOLD_TTL_MS = 24 * 60 * 60 * 1e3;
    HoldStore = class {
      dir;
      constructor(guardDir) {
        this.dir = holdsDir(guardDir);
      }
      file(id) {
        if (!/^bg_[0-9a-f]{8}$/.test(id))
          throw new Error(`"${id}" is not a hold id (bg_ and 8 hex digits)`);
        return path3.join(this.dir, `${id}.json`);
      }
      /** Run `fn` with the holds directory locked. */
      locked(fn) {
        mkdirSync2(this.dir, { recursive: true });
        return withFileLock(path3.join(this.dir, ".lock"), fn);
      }
      get(id) {
        const f = this.file(id);
        if (!existsSync3(f)) return void 0;
        try {
          return JSON.parse(readFileSync2(f, "utf8"));
        } catch {
          return void 0;
        }
      }
      put(hold) {
        mkdirSync2(this.dir, { recursive: true });
        const f = this.file(hold.id);
        const tmp = `${f}.${process.pid}.tmp`;
        writeFileSync2(tmp, JSON.stringify(hold, null, 2) + "\n");
        renameSync2(tmp, f);
      }
      all() {
        if (!existsSync3(this.dir)) return [];
        const out = [];
        for (const name of readdirSync(this.dir)) {
          if (!/^bg_[0-9a-f]{8}\.json$/.test(name)) continue;
          try {
            out.push(JSON.parse(readFileSync2(path3.join(this.dir, name), "utf8")));
          } catch {
          }
        }
        return out.sort((a, b) => a.created_at.localeCompare(b.created_at));
      }
      /** The open hold (waiting or approved, not expired) for this exact call. */
      open(identity, now) {
        return this.all().filter(
          (h) => h.identity === identity && (h.status === "held" || h.status === "approved") && now - Date.parse(h.created_at) < HOLD_TTL_MS
        ).pop();
      }
      /** Holds still waiting for a person, newest last. */
      pending(now) {
        return this.all().filter(
          (h) => (h.status === "held" || h.status === "approved") && now - Date.parse(h.created_at) < HOLD_TTL_MS
        );
      }
      /** The latest release of this exact call inside the window. */
      lastRelease(identity, now, windowMs) {
        return this.all().filter(
          (h) => h.identity === identity && h.status === "released" && h.released_at !== void 0 && now - Date.parse(h.released_at) < windowMs
        ).pop();
      }
      /** The release that answered this very tool call (a second hook on the same call). */
      releasedFor(identity, toolUseId) {
        if (!toolUseId) return void 0;
        return this.all().find((h) => h.identity === identity && h.released_tool_use_id === toolUseId);
      }
    };
  }
});

// src/install.ts
var ON_NPM, NAME, REPO, INSTALL, RUN, SITE, PAGE, FIRM_LOG;
var init_install = __esm({
  "src/install.ts"() {
    "use strict";
    ON_NPM = false;
    NAME = "booksguard";
    REPO = `https://github.com/agentwares/${NAME}`;
    INSTALL = ON_NPM ? `npx ${NAME}` : `npx --allow-git=root github:agentwares/${NAME}`;
    RUN = ON_NPM ? `npx -y ${NAME}@latest` : `npx -y --allow-git=root github:agentwares/${NAME}`;
    SITE = "https://agentwares-agentguard.vercel.app";
    PAGE = `${SITE}/books`;
    FIRM_LOG = `${SITE}/books/firm-log?ref=booksguard`;
  }
});

// src/hook.ts
import path4 from "node:path";
import {
  CompositeKillSwitch,
  EnvKillSwitch,
  KILL_ENV,
  LEGACY_KILL_ENV
} from "@agentwares/agentguard-core";
import { FileKillSwitch } from "@agentwares/agentguard-core/node";
function parseInput(text) {
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}
function denyOutput(client, body, userLine) {
  const reason = JSON.stringify(body);
  if (client === "gemini")
    return JSON.stringify({ decision: "deny", reason, systemMessage: userLine });
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason
    },
    systemMessage: userLine
  });
}
function killSwitch(ctx) {
  return new CompositeKillSwitch([
    new EnvKillSwitch(KILL_ENV, ctx.env),
    new EnvKillSwitch(LEGACY_KILL_ENV, ctx.env),
    new FileKillSwitch(path4.join(ctx.home, ".okgate", "KILL"), [
      path4.join(ctx.home, ".agentguard", "KILL"),
      path4.join(ctx.guardDir, "KILL")
    ])
  ]);
}
function heldBody(client, hold, notYet) {
  const viaChat = client === "claude";
  const fix = viaChat ? `Show the person the change in details.diff and ask, in your reply, whether to post it. Wait for their answer in their own message. If they say yes, call the same tool again with exactly the same arguments. If they want something different, call it with the changed arguments (that is held again with a new diff). They can also approve it in a terminal: \`${approveCmd(hold.id)}\`. Do not try another route to the books.` : `Show the person the change in details.diff and ask them to approve it in their own terminal: \`${approveCmd(hold.id)}\`. When they say they have, call the same tool again with exactly the same arguments. Do not try another route to the books.`;
  const dup = hold.duplicate_of ? ` DUPLICATE: an identical write was released at ${hold.duplicate_of.released_at.slice(0, 16).replace("T", " ")} UTC (hold ${hold.duplicate_of.id}); make sure the person wants a second one.` : "";
  return {
    code: "APPROVAL_REQUIRED",
    cause: `booksguard is holding this ${hold.ledger === "booksguard" ? "change" : `${hold.ledger} write`} until a person approves it: ${hold.title} (hold ${hold.id}).${dup}${notYet ? ` Not yet approved: ${notYet}.` : ""}`,
    fix,
    retryable: true,
    details: {
      hold: hold.id,
      diff: hold.diff,
      ...hold.duplicate_of ? { duplicate_of: hold.duplicate_of } : {},
      approve_in_terminal: approveCmd(hold.id),
      approve_in_chat: viaChat
    }
  };
}
function replyFor(hold) {
  const verb = {
    create: "post",
    import: "post",
    upload: "post",
    batch: "post",
    delete: "delete",
    void: "void",
    send: "send",
    update: "update"
  };
  return verb[hold.op] ? `yes, ${verb[hold.op]} it` : "approve";
}
function heldLine(client, hold) {
  const dup = hold.duplicate_of ? " DUPLICATE of a write released earlier." : "";
  const how = client === "claude" ? `Reply "${replyFor(hold)}" to approve, or run: ${approveCmd(hold.id)}` : `Approve it in a terminal: ${approveCmd(hold.id)}`;
  return `booksguard held ${hold.title} (hold ${hold.id}).${dup} ${how}`;
}
async function runHook(client, stdin, ctx) {
  const input = parseInput(stdin);
  const toolName = typeof input.tool_name === "string" ? input.tool_name : "";
  if (!toolName) return ALLOW_SILENT;
  const loaded = readRules(ctx.guardDir);
  const rules = loaded.rules;
  const cls = classify(client, input, {
    rules,
    home: ctx.home,
    guardDir: ctx.guardDir,
    env: ctx.env
  });
  if (cls.kind === "pass" || cls.kind === "read") return ALLOW_SILENT;
  const session = typeof input.session_id === "string" ? input.session_id : void 0;
  const cwd = path4.resolve(input.cwd || ctx.cwd);
  const folder = path4.basename(cwd) || cwd;
  const now = ctx.now();
  if (cls.kind === "refuse") {
    const body = {
      code: "TOOL_DENIED",
      cause: cls.why,
      fix: cls.fix,
      retryable: false
    };
    const record = {
      ledger: "booksguard",
      server: "booksguard",
      tool: cls.tool,
      op: "guard-config",
      entity: "booksguard",
      folder,
      title: cls.tool
    };
    await appendAudit(ctx.guardDir, {
      event: "refused",
      client,
      session,
      toolName,
      args: input.tool_input,
      record,
      reason: cls.why,
      error: body,
      now
    });
    return {
      stdout: denyOutput(client, body, `booksguard refused ${cls.tool}: ${cls.why}`),
      code: 0,
      decision: "deny",
      body
    };
  }
  const write = cls;
  try {
    const diff = renderDiff(write);
    const server = write.kind === "guard-config" ? "booksguard" : write.server;
    const tool = write.kind === "guard-config" ? write.tool : write.tool;
    const args = write.kind === "guard-config" ? { target: write.target, input: input.tool_input } : write.args;
    const identity = identityOf(server, tool, args);
    const base = {
      client,
      session,
      tool_use_id: typeof input.tool_use_id === "string" ? input.tool_use_id : void 0,
      tool_name: toolName,
      tool,
      server,
      ledger: write.kind === "guard-config" ? "booksguard" : write.ledger,
      op: write.kind === "guard-config" ? "guard-config" : write.op,
      entity: write.kind === "guard-config" ? "hook settings" : write.entity,
      company: write.kind === "guard-config" ? void 0 : write.company,
      folder,
      title: diff.title,
      diff: diff.lines,
      money: diff.money
    };
    const why = write.why;
    let kill;
    try {
      kill = await killSwitch(ctx).check();
    } catch {
      kill = { killed: false };
    }
    if (kill.killed) {
      const body2 = {
        code: "KILLED",
        cause: `the kill switch is on (${kill.reason ?? "killed"}${kill.source ? `, ${kill.source}` : ""}); every QuickBooks and Xero write is refused`,
        fix: "stop and tell the person. A person turns the kill switch off: `okgate resume`, or unset OKGATE_KILL / AGENTGUARD_KILL, or delete the KILL file.",
        retryable: false
      };
      await appendAudit(ctx.guardDir, {
        event: "killed",
        client,
        session,
        toolName,
        args,
        record: { ...base, ledger: base.ledger, op: base.op },
        reason: body2.cause,
        error: body2,
        now
      });
      return {
        stdout: denyOutput(client, body2, `booksguard refused ${diff.title}: the kill switch is on`),
        code: 0,
        decision: "deny",
        body: body2
      };
    }
    if (rules.mode === "watch") {
      await appendAudit(ctx.guardDir, {
        event: "would-hold",
        client,
        session,
        toolName,
        args,
        record: { ...base },
        reason: `would hold: ${why} (rules.mode is watch)`,
        now
      });
      return {
        stdout: noteOutput(
          `booksguard (watch mode) would have held ${diff.title}; it ran. Set "mode": "hold" in ${path4.join(ctx.guardDir, "rules.json")} to hold writes.`
        ),
        code: 0,
        decision: "allow"
      };
    }
    const store = new HoldStore(ctx.guardDir);
    const step = store.locked(() => {
      const already = store.releasedFor(identity, base.tool_use_id);
      if (already) return { kind: "same-call-released", hold: already };
      const open = store.open(identity, now);
      if (open) {
        if (base.tool_use_id && open.tool_use_id === base.tool_use_id)
          return { kind: "same-call-held", hold: open };
        if (open.status === "approved") {
          const released = {
            ...open,
            status: "released",
            released_at: new Date(now).toISOString(),
            released_tool_use_id: base.tool_use_id
          };
          store.put(released);
          return { kind: "released", hold: released };
        }
        const evidence = client === "claude" ? latestHumanTurn(input.transcript_path) : {
          missing: `${client === "codex" ? "Codex" : "Gemini CLI"} transcripts are not a format booksguard reads, so a person approves in a terminal`
        };
        const verdict = approvalFromTurn(evidence, open, now, rules.approval_window_minutes);
        const humanTurn = { ok: verdict.ok, reason: verdict.reason, at: verdict.at };
        if (verdict.ok) {
          const released = {
            ...open,
            status: "released",
            approved_at: verdict.at,
            approved_by: verdict.by,
            released_at: new Date(now).toISOString(),
            released_tool_use_id: base.tool_use_id
          };
          store.put(released);
          return { kind: "released", hold: released, humanTurn };
        }
        const refreshed = { ...open, tool_use_id: base.tool_use_id ?? open.tool_use_id };
        store.put(refreshed);
        return { kind: "still-held", hold: refreshed, reason: verdict.reason, humanTurn };
      }
      const createdAt = new Date(now).toISOString();
      const dup = store.lastRelease(identity, now, rules.duplicate_window_hours * 36e5);
      const hold = {
        id: newHoldId(identity, createdAt),
        created_at: createdAt,
        identity,
        status: "held",
        ...base,
        ...dup ? { duplicate_of: { id: dup.id, released_at: dup.released_at } } : {}
      };
      store.put(hold);
      return { kind: "new", hold };
    });
    if (step.kind === "same-call-released") return ALLOW_SILENT;
    if (step.kind === "same-call-held") {
      const body2 = heldBody(client, step.hold);
      return {
        stdout: denyOutput(client, body2, heldLine(client, step.hold)),
        code: 0,
        decision: "deny",
        body: body2,
        hold: step.hold
      };
    }
    if (step.kind === "released") {
      const by = step.hold.approved_by ?? "the terminal";
      await appendAudit(ctx.guardDir, {
        event: "released",
        client,
        session,
        toolName,
        args,
        record: recordOf(step.hold),
        reason: `released: approved by ${by}`,
        humanTurn: step.humanTurn,
        now
      });
      return {
        stdout: noteOutput(
          `booksguard released ${step.hold.title} (hold ${step.hold.id}), approved by ${step.hold.approved_by ? `your ${step.hold.approved_by}` : "a terminal approve"}.`
        ),
        code: 0,
        decision: "allow",
        hold: step.hold
      };
    }
    const notYet = step.kind === "still-held" ? step.reason : void 0;
    const body = heldBody(client, step.hold, notYet);
    await appendAudit(ctx.guardDir, {
      event: step.kind === "new" ? "held" : "still-held",
      client,
      session,
      toolName,
      args,
      record: recordOf(step.hold),
      reason: step.kind === "new" ? `held: ${why}` : `still held: ${notYet}`,
      error: body,
      humanTurn: step.kind === "still-held" ? step.humanTurn : void 0,
      now
    });
    return {
      stdout: denyOutput(client, body, heldLine(client, step.hold)),
      code: 0,
      decision: "deny",
      body,
      hold: step.hold
    };
  } catch (err) {
    const body = {
      code: "INTERNAL",
      cause: `booksguard could not check this ${write.kind === "guard-config" ? "change" : `${write.ledger} write`} (${err.message}); it is refused rather than let through unchecked`,
      fix: "tell the person booksguard failed; they can run `booksguard status` in a terminal, or remove the hook with `booksguard uninstall`",
      retryable: true
    };
    return {
      stdout: denyOutput(
        client,
        body,
        `booksguard error, write refused: ${err.message}`
      ),
      code: 0,
      decision: "deny",
      body
    };
  }
}
function decideHold(ctx, id, decision) {
  const store = new HoldStore(ctx.guardDir);
  return store.locked(() => {
    const hold = store.get(id);
    if (!hold) return { ok: false, message: `no hold ${id} in ${store.dir}` };
    if (hold.status === "released")
      return { ok: false, message: `${id} was already released at ${hold.released_at}`, hold };
    if (hold.status === "denied") return { ok: false, message: `${id} was already denied`, hold };
    const at = new Date(ctx.now()).toISOString();
    const next = decision === "approve" ? {
      ...hold,
      status: "approved",
      approved_at: at,
      approved_by: `terminal at ${at.slice(11, 16)} UTC`
    } : { ...hold, status: "denied" };
    store.put(next);
    return {
      ok: true,
      message: decision === "approve" ? `approved ${id}: ${hold.title}. The agent's identical retry runs once; tell it to go ahead.` : `denied ${id}: ${hold.title}. The agent's retry is held again as a new write.`,
      hold: next
    };
  });
}
var noteOutput, ALLOW_SILENT, approveCmd;
var init_hook = __esm({
  "src/hook.ts"() {
    "use strict";
    init_audit();
    init_approval();
    init_classify();
    init_diff();
    init_holds();
    init_install();
    init_rules();
    noteOutput = (line) => JSON.stringify({ systemMessage: line });
    ALLOW_SILENT = { stdout: "", code: 0, decision: "allow" };
    approveCmd = (id) => `${INSTALL} approve ${id}`;
  }
});

// src/harnesses.ts
import {
  cpSync,
  existsSync as existsSync4,
  mkdirSync as mkdirSync3,
  readFileSync as readFileSync3,
  renameSync as renameSync3,
  rmSync,
  writeFileSync as writeFileSync3
} from "node:fs";
import path5 from "node:path";
function hookFile(client, p) {
  if (client === "claude") return path5.join(claudeDir(p), "settings.json");
  if (client === "codex") return path5.join(codexDir(p), "hooks.json");
  return path5.join(geminiDir(p), "settings.json");
}
function harnessDir(client, p) {
  const user = { ...p, project: void 0 };
  return client === "claude" ? claudeDir(user) : client === "codex" ? codexDir(user) : geminiDir(user);
}
function tilde(file, home) {
  return file === home || file.startsWith(home + path5.sep) ? `~${file.slice(home.length)}` : file;
}
function shellQuote(s) {
  return /^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}
function stableCli(cliPath, guardDir) {
  const parts = cliPath.split(path5.sep);
  const npx = parts.lastIndexOf("_npx");
  const nm = parts.indexOf("node_modules", npx);
  if (npx < 0 || nm < 0) return cliPath;
  const from = parts.slice(0, nm + 1).join(path5.sep);
  const rest = parts.slice(nm + 1);
  const to = path5.join(guardDir, "runtime", "node_modules");
  const tmp = `${to}.${process.pid}.tmp`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync3(path5.dirname(tmp), { recursive: true });
  cpSync(from, tmp, { recursive: true, dereference: true });
  rmSync(to, { recursive: true, force: true });
  renameSync3(tmp, to);
  return path5.join(to, ...rest);
}
function hookCommand(client, o) {
  const base = o.command?.trim() || `${shellQuote(o.execPath)} ${shellQuote(o.cliPath)}`;
  return `${base} hook pre-tool-use --client ${client}`;
}
function scriptOf(command) {
  const m = /^\s*(?:'[^']*'|"[^"]*"|\S+)\s+('([^']*)'|"([^"]*)"|(\S+\.m?js))\s+hook\b/.exec(
    command
  );
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? null;
}
function readJson(file) {
  if (!existsSync4(file)) return { ok: true, value: {} };
  let text;
  try {
    text = readFileSync3(file, "utf8");
  } catch (err) {
    return {
      ok: false,
      reason: `cannot read it (${err.code ?? "error"})`
    };
  }
  if (text.trim() === "") return { ok: true, value: {} };
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== "object" || Array.isArray(v))
      return { ok: false, reason: "it is not a JSON object" };
    return { ok: true, value: v };
  } catch {
    return { ok: false, reason: "it is not plain JSON" };
  }
}
function writeJson(file, value) {
  mkdirSync3(path5.dirname(file), { recursive: true });
  const backup = `${file}.booksguard-backup`;
  if (existsSync4(file) && !existsSync4(backup)) cpSync(file, backup);
  const tmp = `${file}.${process.pid}.booksguard.tmp`;
  writeFileSync3(tmp, JSON.stringify(value, null, 2) + "\n");
  renameSync3(tmp, file);
}
function entriesOf(settings, event) {
  const hooks = settings.hooks;
  if (!hooks || typeof hooks !== "object" || Array.isArray(hooks)) return [];
  const list = hooks[event];
  return Array.isArray(list) ? list : [];
}
function withoutOurs(entries) {
  return entries.map((e) => {
    if (!Array.isArray(e.hooks)) return e;
    const kept = e.hooks.filter((h) => !isOurs(h?.command));
    return kept.length === e.hooks.length ? e : { ...e, hooks: kept };
  }).filter((e) => !Array.isArray(e.hooks) || e.hooks.length > 0);
}
function entryFor(client, command) {
  if (client === "gemini")
    return {
      matcher: MATCHERS.gemini,
      hooks: [
        {
          name: "booksguard",
          type: "command",
          command,
          timeout: 3e4,
          description: "booksguard: QuickBooks and Xero writes wait for a person's yes"
        }
      ]
    };
  if (client === "claude")
    return {
      matcher: MATCHERS.claude,
      hooks: [{ type: "command", command, timeout: 30, statusMessage: "booksguard" }]
    };
  return { matcher: MATCHERS.codex, hooks: [{ type: "command", command, timeout: 30 }] };
}
function installHook(client, command, p) {
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
  const hooks = settings.hooks && typeof settings.hooks === "object" && !Array.isArray(settings.hooks) ? settings.hooks : {};
  writeJson(file, { ...settings, hooks: { ...hooks, [event]: [...withoutOurs(before), want] } });
  return { client, file, action: had ? "updated" : "added" };
}
function uninstallHook(client, p) {
  const file = hookFile(client, p);
  const read = readJson(file);
  if (!read.ok || !existsSync4(file)) return { client, file, removed: false };
  const settings = read.value;
  const event = eventOf(client);
  const before = entriesOf(settings, event);
  const after = withoutOurs(before);
  if (JSON.stringify(after) === JSON.stringify(before)) return { client, file, removed: false };
  const hooks = { ...settings.hooks };
  if (after.length > 0) hooks[event] = after;
  else delete hooks[event];
  const next = { ...settings };
  if (Object.keys(hooks).length > 0) next.hooks = hooks;
  else delete next.hooks;
  writeJson(file, next);
  return { client, file, removed: true };
}
function hookState(client, p) {
  const file = hookFile(client, p);
  const read = readJson(file);
  if (!read.ok) return { state: "broken", file, reason: `cannot read the file: ${read.reason}` };
  const command = entriesOf(read.value, eventOf(client)).flatMap((e) => e.hooks ?? []).map((h) => h?.command).find(isOurs);
  if (!command) return { state: "missing", file };
  const script = scriptOf(command);
  if (script !== null && !existsSync4(script))
    return { state: "broken", file, reason: "the hook runs a file that no longer exists" };
  return { state: "installed", file, command };
}
function mcpConfigFiles(p, cwd) {
  const claude = claudeDir({ ...p, project: void 0 });
  return [
    { file: path5.join(p.home, ".claude.json"), kind: "json" },
    { file: path5.join(claude, "settings.json"), kind: "json" },
    { file: path5.join(cwd, ".mcp.json"), kind: "json" },
    {
      file: path5.join(geminiDir({ ...p, project: void 0 }), "settings.json"),
      kind: "json"
    },
    { file: path5.join(cwd, ".gemini", "settings.json"), kind: "json" },
    {
      file: path5.join(codexDir({ ...p, project: void 0 }), "config.toml"),
      kind: "toml"
    }
  ];
}
function serversInJson(value, out, depth = 0) {
  if (!value || typeof value !== "object" || depth > 4) return;
  for (const [k, v] of Object.entries(value)) {
    if ((k === "mcpServers" || k === "mcp_servers") && v && typeof v === "object" && !Array.isArray(v)) {
      for (const [name, def] of Object.entries(v)) out.set(name, def);
    } else if (v && typeof v === "object") serversInJson(v, out, depth + 1);
  }
}
function findLedgerServers(p, cwd) {
  const found = [];
  for (const { file, kind } of mcpConfigFiles(p, cwd)) {
    if (!existsSync4(file)) continue;
    let text;
    try {
      text = readFileSync3(file, "utf8");
    } catch {
      continue;
    }
    const servers = /* @__PURE__ */ new Map();
    if (kind === "json") {
      try {
        serversInJson(JSON.parse(text), servers);
      } catch {
        continue;
      }
    } else {
      let current;
      let body = "";
      const flush = () => {
        if (current) servers.set(current, body);
      };
      for (const line of text.split("\n")) {
        const m = /^\s*\[mcp_servers\.("?)([^\].".]+)\1\]\s*$/.exec(line);
        if (m) {
          flush();
          current = m[2];
          body = "";
        } else if (/^\s*\[/.test(line)) {
          flush();
          current = void 0;
        } else if (current) body += `${line}
`;
      }
      flush();
    }
    for (const [name, def] of servers) {
      const def_ = def;
      const text_ = typeof def_ === "string" ? def_ : [
        def_?.command,
        def_?.url,
        def_?.httpUrl,
        ...Array.isArray(def_?.args) ? def_.args : []
      ].filter((x) => typeof x === "string").join(" ");
      if (LEDGER_HINT.test(name) || LEDGER_HINT.test(text_))
        found.push({ name, where: tilde(file, p.home) });
    }
  }
  const seen = /* @__PURE__ */ new Set();
  return found.filter((f) => seen.has(f.name) ? false : (seen.add(f.name), true));
}
var CLIENTS, CLIENT_LABEL, MATCHERS, HOW_APPROVED, claudeDir, codexDir, geminiDir, isOurs, eventOf, LEDGER_HINT;
var init_harnesses = __esm({
  "src/harnesses.ts"() {
    "use strict";
    CLIENTS = ["claude", "codex", "gemini"];
    CLIENT_LABEL = {
      claude: "Claude Code",
      codex: "Codex",
      gemini: "Gemini CLI"
    };
    MATCHERS = {
      claude: "^mcp__|^(Bash|PowerShell|Write|Edit|MultiEdit|NotebookEdit)$",
      codex: "^mcp__|^(Bash|apply_patch|exec_command|shell)$",
      gemini: "^mcp_|^(run_shell_command|write_file|replace)$"
    };
    HOW_APPROVED = {
      claude: "the person's own message after the hold (read from the transcript), or a terminal approve",
      codex: "a terminal approve only (Codex transcripts are not a format booksguard reads); trust the hook once in Codex's /hooks",
      gemini: "a terminal approve only (Gemini CLI transcripts are not a format booksguard reads); written to Gemini CLI's hook docs, not yet run on a live Gemini CLI"
    };
    claudeDir = ({ home, env, project }) => {
      if (project) return path5.join(project, ".claude");
      const first = env.CLAUDE_CONFIG_DIR?.split(",").map((d) => d.trim()).find(Boolean);
      return first ? path5.resolve(first) : path5.join(home, ".claude");
    };
    codexDir = ({ home, env, project }) => project ? path5.join(project, ".codex") : env.CODEX_HOME ? path5.resolve(env.CODEX_HOME) : path5.join(home, ".codex");
    geminiDir = ({ home, project }) => path5.join(project ?? home, ".gemini");
    isOurs = (command) => typeof command === "string" && /booksguard/.test(command) && /\bhook pre-tool-use\b/.test(command);
    eventOf = (client) => client === "gemini" ? "BeforeTool" : "PreToolUse";
    LEDGER_HINT = /quickbooks|qbo|intuit|xero|meridian/i;
  }
});

// src/version.ts
import { readFileSync as readFileSync4 } from "node:fs";
function version() {
  if (cached !== void 0) return cached;
  try {
    cached = JSON.parse(readFileSync4(new URL("../package.json", import.meta.url), "utf8")).version;
  } catch {
    cached = "0.0.0";
  }
  return cached;
}
var cached;
var init_version = __esm({
  "src/version.ts"() {
    "use strict";
  }
});

// src/fixtures.ts
import { appendFileSync, mkdirSync as mkdirSync4 } from "node:fs";
import path6 from "node:path";
function humanEntry(text, at) {
  return {
    type: "user",
    uuid: `u-${at}`,
    timestamp: new Date(at).toISOString(),
    isSidechain: false,
    userType: "external",
    origin: { kind: "human" },
    message: { role: "user", content: text }
  };
}
function assistantEntry(text, at) {
  return {
    type: "assistant",
    timestamp: new Date(at).toISOString(),
    isSidechain: false,
    message: { role: "assistant", content: [{ type: "text", text }] }
  };
}
function appendTranscript(file, ...entries) {
  mkdirSync4(path6.dirname(file), { recursive: true });
  appendFileSync(file, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
}
function claudeInput(tool, toolInput, o) {
  return {
    session_id: o.session ?? "demo-session",
    transcript_path: o.transcript,
    cwd: o.cwd,
    permission_mode: "default",
    hook_event_name: "PreToolUse",
    tool_name: tool,
    tool_input: toolInput,
    tool_use_id: o.id
  };
}
var QBO_CREATE_INVOICE, MERIDIAN_JOURNAL_ENTRY, XERO_CURL, QBO_DELETE_INVOICE, OPAQUE_SERVER;
var init_fixtures = __esm({
  "src/fixtures.ts"() {
    "use strict";
    QBO_CREATE_INVOICE = {
      params: {
        customer_ref: "58",
        doc_number: "1042",
        txn_date: "2026-10-09",
        line_items: [
          { item_ref: "12", qty: 10, unit_price: 125, description: "October bookkeeping, 10 hours" },
          { item_ref: "19", qty: 1, unit_price: 0, description: "Receipt capture (included)" }
        ],
        customer_memo: "Thank you for your business."
      }
    };
    MERIDIAN_JOURNAL_ENTRY = {
      company_id: "9130354821",
      journal_entry: {
        TxnDate: "2026-09-30",
        PrivateNote: "Accrue September rent",
        Line: [
          {
            Amount: 2500,
            DetailType: "JournalEntryLineDetail",
            JournalEntryLineDetail: { PostingType: "Debit", AccountRef: { value: "67", name: "Rent" } }
          },
          {
            Amount: 2250,
            DetailType: "JournalEntryLineDetail",
            JournalEntryLineDetail: {
              PostingType: "Credit",
              AccountRef: { value: "33", name: "Accrued liabilities" }
            }
          }
        ]
      }
    };
    XERO_CURL = `curl -sS -X PUT https://api.xero.com/api.xro/2.0/Invoices -H 'Authorization: Bearer $XERO_TOKEN' -H 'xero-tenant-id: 7d1c2a40-1111-4b2b-9c3d-000000000001' -H 'Content-Type: application/json' -d '{"Invoices":[{"Type":"ACCPAY","Contact":{"ContactID":"c-204"},"LineItems":[{"Description":"Laptop","Quantity":1,"UnitAmount":1899,"AccountCode":"720"}],"Status":"DRAFT"}]}'`;
    QBO_DELETE_INVOICE = { params: { idOrEntity: "1042" } };
    OPAQUE_SERVER = "3f0c2a9e-5b7d-4c11-9e2a-0d6f4b8a1c37";
  }
});

// src/demo.ts
var demo_exports = {};
__export(demo_exports, {
  DEMO_START: () => DEMO_START,
  runDemo: () => runDemo
});
import { mkdirSync as mkdirSync5, mkdtempSync, rmSync as rmSync2 } from "node:fs";
import { tmpdir } from "node:os";
import path7 from "node:path";
function said(answer) {
  if (!answer.stdout) return { decision: "passes (no output: the harness decides as usual)" };
  const parsed = JSON.parse(answer.stdout);
  const decision = parsed.hookSpecificOutput?.permissionDecision ?? parsed.decision ?? "allow (a note only)";
  const diff = answer.body?.details?.diff;
  return { decision, line: parsed.systemMessage, diff };
}
async function runDemo(out, opts = {}) {
  const root = mkdtempSync(path7.join(tmpdir(), "booksguard-demo-"));
  const home = path7.join(root, "home");
  const project = path7.join(home, "clients", "acme-landscaping");
  mkdirSync5(path7.join(home, ".claude"), { recursive: true });
  mkdirSync5(project, { recursive: true });
  const transcript = path7.join(home, ".claude", "projects", "demo", "session.jsonl");
  let clock = DEMO_START;
  const env = { HOME: home };
  const ctx = {
    env,
    home,
    guardDir: guardHome(home, env),
    cwd: project,
    now: () => clock
  };
  const t = (ms) => new Date(ms).toISOString().slice(11, 16);
  const w = (s = "") => out.write(`${s}
`);
  let n = 0;
  const call = async (client, tool, input, note) => {
    clock += 6e4;
    n += 1;
    w(`${t(clock)}  agent   ${tool}${note ? `  (${note})` : ""}`);
    const answer = await runHook(
      client,
      JSON.stringify(claudeInput(tool, input, { cwd: project, transcript, id: `toolu_demo_${n}` })),
      ctx
    );
    const s = said(answer);
    w(`        hook    ${s.decision}`);
    if (s.diff) for (const line of s.diff) w(`                  ${line}`);
    if (s.line) w(`        person  sees: ${s.line}`);
    w();
    return answer;
  };
  const person = (text, assistantAsked) => {
    if (assistantAsked) {
      clock += 2e4;
      appendTranscript(transcript, assistantEntry(assistantAsked, clock));
      w(`${t(clock)}  agent   says: ${assistantAsked}`);
    }
    clock += 4e4;
    appendTranscript(transcript, humanEntry(text, clock));
    w(`${t(clock)}  person  types: ${text}`);
    w();
  };
  try {
    w("booksguard demo: synthetic calls through the real hook, in a temporary home.");
    w("Nothing of yours is read or written. Tool names and argument shapes are the public ones.");
    w();
    const res = installHook(
      "claude",
      `node /path/to/booksguard/dist/cli.js hook pre-tool-use --client claude`,
      {
        home,
        env
      }
    );
    w(`$ ${INSTALL} install --client claude`);
    w(`${res.action.padEnd(7)} Claude Code PreToolUse hook in ${tilde(res.file, home)}`);
    w(`        matcher ${entryFor("claude", "").matcher}`);
    w();
    clock += 6e4;
    appendTranscript(
      transcript,
      humanEntry(
        "Bill Acme Landscaping for October: 10 hours of bookkeeping, invoice 1042.",
        clock
      )
    );
    w(
      `${t(clock)}  person  types: Bill Acme Landscaping for October: 10 hours of bookkeeping, invoice 1042.`
    );
    w();
    await call(
      "claude",
      "mcp__quickbooks__search_customers",
      { params: { name: "Acme" } },
      "a read"
    );
    const held = await call(
      "claude",
      "mcp__quickbooks__create_invoice",
      QBO_CREATE_INVOICE,
      "Intuit's server"
    );
    const id = held.hold?.id ?? "bg_?";
    await call(
      "claude",
      "mcp__quickbooks__create_invoice",
      QBO_CREATE_INVOICE,
      "the agent retries before anyone answered"
    );
    person(
      "yes, post it",
      `booksguard is holding invoice 1042 for Acme Landscaping, 1,250.00. Shall I post it?`
    );
    await call("claude", "mcp__quickbooks__create_invoice", QBO_CREATE_INVOICE, "same arguments");
    await call(
      "claude",
      "mcp__quickbooks__create_invoice",
      QBO_CREATE_INVOICE,
      "a retry after a timeout: the official server has no idempotency, #100"
    );
    await call(
      "claude",
      `mcp__${OPAQUE_SERVER}__create_journal_entry`,
      MERIDIAN_JOURNAL_ENTRY,
      "Meridian, under a connector id the harness does not name"
    );
    await call("claude", "Bash", { command: XERO_CURL }, "Xero's REST API");
    await call("claude", "mcp__quickbooks__delete_invoice", QBO_DELETE_INVOICE, "");
    person("no, don't delete anything", "Should I also delete the old draft of invoice 1042?");
    await call(
      "claude",
      "mcp__quickbooks__delete_invoice",
      QBO_DELETE_INVOICE,
      "the agent tries anyway"
    );
    await call(
      "claude",
      "Bash",
      { command: `${INSTALL} approve ${id}` },
      "the agent tries to approve its own hold"
    );
    await call(
      "claude",
      "mcp__stripe__create_invoice",
      { customer: "cus_123" },
      "Stripe, not a ledger"
    );
    w(`$ ${INSTALL} log`);
    const month = new Date(clock).toISOString().slice(0, 7);
    w(renderSummary(summarize(readLog(ctx.guardDir), month)).trimEnd());
    w();
    const v = await verifyLog(ctx.guardDir);
    w(`$ ${INSTALL} verify`);
    w(
      v.ok ? `ok: ${v.entries} entries, hash chain intact (head ${v.head?.slice(0, 12)})` : `BROKEN at ${v.brokenAt}: ${v.reason}`
    );
    return 0;
  } finally {
    if (!opts.keep) rmSync2(root, { recursive: true, force: true });
  }
}
var DEMO_START;
var init_demo = __esm({
  "src/demo.ts"() {
    "use strict";
    init_audit();
    init_fixtures();
    init_harnesses();
    init_hook();
    init_install();
    init_rules();
    DEMO_START = Date.parse("2026-10-09T14:00:00Z");
  }
});

// src/mcp.ts
var mcp_exports = {};
__export(mcp_exports, {
  PROTOCOL_VERSIONS: () => PROTOCOL_VERSIONS,
  TOOLS: () => TOOLS,
  callTool: () => callTool,
  handleMessage: () => handleMessage,
  serveStdio: () => serveStdio
});
import path8 from "node:path";
import { createInterface } from "node:readline";
function strictArgs(name, args) {
  const tool = TOOLS.find((t) => t.name === name);
  if (args === void 0 || args === null) args = {};
  if (!isObject3(args)) throw new InvalidInput("arguments must be an object", "Pass a JSON object.");
  for (const k of Object.keys(args))
    if (!tool.inputSchema.properties[k])
      throw new InvalidInput(
        `unknown argument \`${k}\``,
        `Use only: ${Object.keys(tool.inputSchema.properties).join(", ") || "no arguments"}.`
      );
  for (const k of tool.inputSchema.required ?? [])
    if (args[k] === void 0) throw new InvalidInput(`\`${k}\` is required`, `Pass ${k}.`);
  return args;
}
function callTool(name, rawArgs, ctx) {
  try {
    const args = strictArgs(name, rawArgs);
    if (name === "booksguard_check_write") {
      if (typeof args.tool_name !== "string" || !args.tool_name.trim())
        throw new InvalidInput(
          "`tool_name` must be a non-empty string",
          "Pass the tool's full name."
        );
      if (args.arguments !== void 0 && !isObject3(args.arguments))
        throw new InvalidInput(
          "`arguments` must be an object",
          "Pass the tool's arguments as an object."
        );
      const harness = args.harness ?? "claude";
      if (!["claude", "codex", "gemini"].includes(harness))
        throw new InvalidInput(
          "`harness` must be claude, codex or gemini",
          "Omit it for Claude Code."
        );
      const { rules } = readRules(ctx.guardDir);
      const cls = classify(
        harness,
        { tool_name: args.tool_name, tool_input: args.arguments ?? {}, cwd: ctx.cwd },
        { rules, home: ctx.home, guardDir: ctx.guardDir, env: ctx.env }
      );
      if (cls.kind === "pass" || cls.kind === "read")
        return {
          structured: { held: false, kind: cls.kind, why: cls.why, mode: rules.mode },
          isError: false
        };
      if (cls.kind === "refuse")
        return {
          structured: { held: false, refused: true, why: cls.why, fix: cls.fix },
          isError: false
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
          company: cls.kind === "guard-config" ? void 0 : cls.company ?? null,
          approve: harness === "claude" ? "the person's own message after the hold, or `booksguard approve <id>` in their terminal" : "`booksguard approve <id>` in the person's terminal"
        },
        isError: false
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
            approve_in_terminal: `${INSTALL} approve ${h.id}`
          })),
          count: holds.length
        },
        isError: false
      };
    }
    if (name === "booksguard_month_log") {
      const month = typeof args.month === "string" ? args.month : new Date(ctx.now()).toISOString().slice(0, 7);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        throw new InvalidInput("`month` must be YYYY-MM", "For October 2026 pass 2026-10.");
      const s = summarize(
        readLog(ctx.guardDir),
        month,
        typeof args.company === "string" ? args.company : void 0
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
            writes: c.rows.filter((r) => r.event !== "still-held").map((r) => ({
              at: r.ts,
              event: r.event,
              what: r.title,
              hold: r.hold ?? null,
              approved_by: r.approved_by ?? null
            }))
          })),
          log: path8.join(ctx.guardDir, "audit.jsonl")
        },
        isError: false
      };
    }
    throw new Error(`unknown tool ${name}`);
  } catch (err) {
    const body = err instanceof InvalidInput ? { code: "INVALID_INPUT", cause: err.cause_, fix: err.fix, retryable: false } : {
      code: "INTERNAL",
      cause: err instanceof Error ? err.message : String(err),
      fix: "Run `booksguard status` in a terminal to see booksguard's state, and report the error at https://github.com/agentwares/booksguard/issues.",
      retryable: false
    };
    return { structured: { ...body }, isError: true };
  }
}
function handleMessage(msg, ctx) {
  if (Array.isArray(msg)) {
    const out = msg.map((m) => handleMessage(m, ctx)).filter((r) => r !== void 0);
    return out.length ? out : void 0;
  }
  const req = msg && typeof msg === "object" ? msg : {};
  const hasId = "id" in req && (typeof req.id === "string" || typeof req.id === "number");
  const id = hasId ? req.id : null;
  const error = (code, message) => ({
    jsonrpc: "2.0",
    id,
    error: { code, message }
  });
  if (!("method" in req) && ("result" in req || "error" in req)) return void 0;
  if (req.jsonrpc !== "2.0" || typeof req.method !== "string")
    return hasId || !("method" in req) ? error(-32600, "Invalid Request") : void 0;
  if (!hasId) return void 0;
  const params = isObject3(req.params) ? req.params : {};
  switch (req.method) {
    case "initialize": {
      const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      const protocolVersion = PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0];
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "booksguard", title: "booksguard", version: version() },
          instructions: INSTRUCTIONS
        }
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
          `Unknown tool: ${String(name)}. Tools: ${TOOLS.map((t) => t.name).join(", ")}`
        );
      const { structured, isError } = callTool(name, params.arguments, ctx);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(structured) }],
          structuredContent: structured,
          isError
        }
      };
    }
    default:
      return error(-32601, `Method not found: ${req.method}`);
  }
}
async function serveStdio(ctx) {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" }
        }) + "\n"
      );
      continue;
    }
    try {
      const res = handleMessage(msg, ctx);
      if (res !== void 0) process.stdout.write(JSON.stringify(res) + "\n");
    } catch (err) {
      process.stderr.write(`booksguard mcp: ${err instanceof Error ? err.message : String(err)}
`);
    }
  }
}
var PROTOCOL_VERSIONS, annotations, TOOLS, InvalidInput, isObject3, INSTRUCTIONS;
var init_mcp = __esm({
  "src/mcp.ts"() {
    "use strict";
    init_audit();
    init_classify();
    init_diff();
    init_holds();
    init_install();
    init_rules();
    init_version();
    PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
    annotations = (title) => ({
      title,
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    });
    TOOLS = [
      {
        name: "booksguard_check_write",
        title: "Would booksguard hold this call",
        description: "Before you call a QuickBooks or Xero tool (or run a curl against their APIs), ask whether booksguard would hold it for the person's approval, and see the dry-run diff it would show: the fields the write sets, line totals, journal debits against credits with any imbalance, and the company it names. Reads the call you describe and booksguard's rules on this machine; calls nothing, writes nothing. A held write is released only by the person: their own message after the hold, or `booksguard approve <id>` in their terminal.",
        inputSchema: {
          type: "object",
          properties: {
            tool_name: {
              type: "string",
              minLength: 1,
              description: "The tool exactly as your harness names it, e.g. mcp__quickbooks__create_invoice (Claude Code, Codex), mcp_xero_create-invoice (Gemini CLI), or Bash for a shell command."
            },
            arguments: {
              type: "object",
              description: 'The arguments you would pass to that tool; for Bash, { "command": "curl \u2026" }.'
            },
            harness: {
              type: "string",
              enum: ["claude", "codex", "gemini"],
              description: "Which harness names the tool this way. Omitted: claude."
            }
          },
          required: ["tool_name"],
          additionalProperties: false
        },
        annotations: annotations("Would booksguard hold this call")
      },
      {
        name: "booksguard_list_holds",
        title: "Writes waiting for the person",
        description: "Lists the QuickBooks and Xero writes booksguard is holding on this machine, newest last: the hold id, when it was made, what it would do, its dry-run diff, and how the person approves it (their own message after the hold, or `booksguard approve <id>` in their terminal). Use it to remind the person what is waiting. Reads booksguard's local state only.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: annotations("Writes waiting for the person")
      },
      {
        name: "booksguard_month_log",
        title: "What AI wrote to the books this month",
        description: "The month's AI writes to QuickBooks and Xero per client, from booksguard's hash-chained local log: how many were held, released (with their total and who approved each: the person's message and its time, or a terminal approve), still waiting, or refused. A client is the company the call named, else the folder the agent ran in. Reads the local log only.",
        inputSchema: {
          type: "object",
          properties: {
            month: {
              type: "string",
              pattern: "^\\d{4}-(0[1-9]|1[0-2])$",
              description: "YYYY-MM. Omitted: the current month (UTC)."
            },
            company: {
              type: "string",
              minLength: 1,
              description: "Only clients whose name or company id contains this text."
            }
          },
          additionalProperties: false
        },
        annotations: annotations("What AI wrote to the books this month")
      }
    ];
    InvalidInput = class extends Error {
      constructor(cause_, fix) {
        super(cause_);
        this.cause_ = cause_;
        this.fix = fix;
      }
      cause_;
      fix;
    };
    isObject3 = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
    INSTRUCTIONS = "booksguard holds every AI write to QuickBooks and Xero until the person approves it, and keeps a per-client log of what was written and who said yes. These tools only read: ask what would be held (booksguard_check_write), what is waiting (booksguard_list_holds) and what was written this month (booksguard_month_log). Nothing here approves a write; only the person does, in their own message or their terminal.";
  }
});

// src/index.ts
init_catalog();
init_classify();
init_diff();
init_approval();
init_hook();
init_holds();
init_audit();
init_rules();
init_install();

// src/main.ts
init_audit();
init_catalog();
init_classify();
init_diff();
init_harnesses();
init_holds();
init_hook();
init_install();
init_rules();
init_version();
import { existsSync as existsSync5, writeFileSync as writeFileSync4 } from "node:fs";
import { homedir } from "node:os";
import path9 from "node:path";
import { parseArgs } from "node:util";
var HELP = () => `booksguard ${version()} \u2014 nothing an AI agent writes to QuickBooks or Xero posts until a person says yes

Usage
  ${INSTALL} install [--client claude,codex,gemini|all] [--project] [--command <cmd>] [--no-hooks]
      write the pre-tool-use hook (user level unless --project) and ~/.booksguard/rules.json;
      --no-hooks when the booksguard plugin (Claude Code, Cowork) already carries the hook
  ${INSTALL} status            each harness, the rulebook, the ledger servers found, what is waiting
  ${INSTALL} holds             the writes waiting for a person, with their diffs
  ${INSTALL} approve <id>      release one held write (a person runs it; an agent is refused)
  ${INSTALL} deny <id>         turn one down
  ${INSTALL} log [--month YYYY-MM] [--company <text>] [--csv | --json]
                               the month's AI writes per client: held, released (who said yes), refused
  ${INSTALL} verify            check the log's hash chain
  ${INSTALL} check <tool> [--args '<json>'] [--client claude|codex|gemini]
                               would this call be held, and its dry-run diff
  ${INSTALL} demo              the whole thing on synthetic calls in a temporary home
  ${INSTALL} mcp               a read-only MCP server: check, holds, month log
  ${INSTALL} uninstall [--project]   remove every hook booksguard wrote

What is held
  Every create, update, delete, void, send or import through Intuit's QuickBooks connector and
  open-source server, Meridian's QuickBooks connector and Xero's open-source server
  (${CATALOG_SUMMARY}), any other tool on a server named for QuickBooks or Xero
  that is not a read, and curl/wget/HTTPie calls to the QuickBooks and Xero APIs that are not a GET.
  Reads pass. The agent may not approve its own holds or write booksguard's home.

How a person approves
  Claude Code and Cowork: their own message after the hold ("yes, post it"), read from the
  transcript; or ${INSTALL} approve <id> in a terminal.
  Codex and Gemini CLI: ${INSTALL} approve <id> in a terminal.

Not seen: a script the agent writes and then runs, when the command line does not name a ledger
API host. A local hook is a seatbelt, not a vault.
Pages: ${PAGE}   Source: ${REPO}`;
async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}
function contextFrom(env, over = {}) {
  const fixed = env.BOOKSGUARD_NOW ? Date.parse(env.BOOKSGUARD_NOW) : NaN;
  const home = over.home ?? homedir();
  return {
    env,
    home,
    guardDir: guardHome(home, env),
    cwd: process.cwd(),
    now: () => Number.isFinite(fixed) ? fixed : Date.now(),
    ...over
  };
}
function clientsFrom(value) {
  if (!value || value === "all") return [...CLIENTS];
  return value.split(",").map((v) => {
    const c = v.trim().toLowerCase().replace(/-cli$|-code$/, "");
    if (c === "claude" || c === "codex" || c === "gemini") return c;
    throw new UsageError(`unknown --client "${v}": claude, codex, gemini or all`);
  });
}
async function main(argv, io, opts = {}) {
  const ctx = contextFrom(process.env, opts.ctx);
  const env = ctx.env;
  const w = (s = "") => io.out.write(`${s}
`);
  const [cmd, ...rest] = argv;
  try {
    if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
      w(HELP());
      return 0;
    }
    if (cmd === "-v" || cmd === "--version") {
      w(version());
      return 0;
    }
    if (cmd === "hook") {
      const { values, positionals } = parseArgs({
        args: rest,
        options: { client: { type: "string" } },
        allowPositionals: true
      });
      if (positionals[0] !== "pre-tool-use")
        throw new UsageError("usage: booksguard hook pre-tool-use --client claude|codex|gemini");
      const client = clientsFrom(values.client ?? "claude")[0];
      const stdin = await (io.stdin ?? readStdin)();
      const answer = await runHook(client, stdin, ctx);
      if (answer.stdout) io.out.write(`${answer.stdout}
`);
      return answer.code;
    }
    if (cmd === "install") {
      const { values } = parseArgs({
        args: rest,
        options: {
          client: { type: "string" },
          project: { type: "boolean" },
          command: { type: "string" },
          "no-hooks": { type: "boolean" }
        }
      });
      const explicit = values.client !== void 0;
      const clients = clientsFrom(values.client);
      const paths = { home: ctx.home, env, project: values.project ? ctx.cwd : void 0 };
      const cliPath = opts.cliPath ?? process.argv[1] ?? "";
      const stable = values.command ? cliPath : stableCli(cliPath, ctx.guardDir);
      const loaded = readRules(ctx.guardDir);
      const found = findLedgerServers({ home: ctx.home, env }, ctx.cwd);
      const named = found.map((f) => f.name).filter((n) => !/quickbooks|qbo|intuit|xero|meridian/i.test(n));
      const rules = {
        ...loaded.rules,
        ledger_servers: [.../* @__PURE__ */ new Set([...loaded.rules.ledger_servers, ...named])]
      };
      writeRules(ctx.guardDir, rules);
      w(
        `${loaded.exists ? "kept   " : "wrote  "} ${tilde(rulesFile(ctx.guardDir), ctx.home)} (mode: ${rules.mode})`
      );
      for (const f of found) w(`found   ledger server "${f.name}" in ${f.where}`);
      if (!values.command) {
        writeFileSync4(path9.join(ctx.guardDir, "cli-path"), `${stable}
`);
        w(
          `wrote   ${tilde(path9.join(ctx.guardDir, "cli-path"), ctx.home)} (the plugin's hook runs this copy)`
        );
      }
      for (const client of values["no-hooks"] ? [] : clients) {
        if (!explicit && !values.project && !harnessFound(client, paths)) {
          w(
            `skip    ${CLIENT_LABEL[client]}: not on this machine (${tilde(harnessDir(client, paths), ctx.home)} missing; --client ${client} to write it anyway)`
          );
          continue;
        }
        const command = hookCommand(client, {
          command: values.command,
          execPath: opts.execPath ?? process.execPath,
          cliPath: stable
        });
        const res = installHook(client, command, paths);
        if (res.action === "skipped")
          w(
            `skip    ${CLIENT_LABEL[client]}: ${tilde(res.file, ctx.home)} ${res.reason}; fix it and run install again`
          );
        else
          w(
            `${res.action.padEnd(7)} ${CLIENT_LABEL[client]} hook in ${tilde(res.file, ctx.home)}: ${HOW_APPROVED[client]}`
          );
      }
      w("");
      w("Next:");
      w("  1. start a new session of your agent (hooks are read at start)");
      w(
        "  2. work as usual: every QuickBooks or Xero write is held with its diff until you say yes"
      );
      w(`  3. ${INSTALL} log     # what AI wrote this month, per client, and who approved it`);
      w(`  undo: ${INSTALL} uninstall${values.project ? " --project" : ""}`);
      return 0;
    }
    if (cmd === "uninstall") {
      const { values } = parseArgs({ args: rest, options: { project: { type: "boolean" } } });
      const paths = { home: ctx.home, env, project: values.project ? ctx.cwd : void 0 };
      let removed = 0;
      for (const client of CLIENTS) {
        const r = uninstallHook(client, paths);
        if (r.removed) {
          removed += 1;
          w(`removed ${CLIENT_LABEL[client]} hook from ${tilde(r.file, ctx.home)}`);
        }
      }
      if (removed === 0) w("no booksguard hooks found");
      w(
        `kept    ${tilde(ctx.guardDir, ctx.home)} (the rulebook, holds and the log); delete it yourself if you want it gone`
      );
      return 0;
    }
    if (cmd === "status") {
      const loaded = readRules(ctx.guardDir);
      for (const scope of ["user", "project"]) {
        const paths = {
          home: ctx.home,
          env,
          project: scope === "project" ? ctx.cwd : void 0
        };
        for (const client of CLIENTS) {
          const s = hookState(client, paths);
          if (scope === "project" && s.state === "missing") continue;
          w(
            `${scope.padEnd(7)} ${CLIENT_LABEL[client].padEnd(11)} ${s.state === "installed" ? "holds writes" : s.state === "broken" ? `BROKEN: ${s.reason}` : "no hook"}  (${tilde(s.file, ctx.home)})`
          );
        }
      }
      w(
        `rules   ${tilde(rulesFile(ctx.guardDir), ctx.home)}: ${loaded.exists ? `mode ${loaded.rules.mode}` : "absent, defaults apply (mode hold)"}${loaded.problem ? `; ${loaded.problem}` : ""}`
      );
      for (const f of findLedgerServers({ home: ctx.home, env }, ctx.cwd))
        w(`server  "${f.name}" in ${f.where}`);
      const pending = new HoldStore(ctx.guardDir).pending(ctx.now());
      w(`holds   ${pending.length} waiting${pending.length ? `: ${INSTALL} holds` : ""}`);
      return 0;
    }
    if (cmd === "holds") {
      const { values } = parseArgs({ args: rest, options: { json: { type: "boolean" } } });
      const pending = new HoldStore(ctx.guardDir).pending(ctx.now());
      if (values.json) {
        w(JSON.stringify(pending, null, 2));
        return 0;
      }
      if (pending.length === 0) w("nothing is waiting");
      for (const h of pending) {
        w(
          `${h.id}  ${h.created_at.slice(0, 16).replace("T", " ")} UTC  ${h.status === "approved" ? "APPROVED, waiting for the agent's retry" : "held"}  ${h.folder}`
        );
        w(`  ${h.title}`);
        if (h.duplicate_of)
          w(
            `  DUPLICATE of ${h.duplicate_of.id}, released ${h.duplicate_of.released_at.slice(0, 16).replace("T", " ")} UTC`
          );
        for (const line of h.diff) w(`    ${line}`);
        if (h.status === "held") w(`  approve: ${INSTALL} approve ${h.id}`);
        w("");
      }
      return 0;
    }
    if (cmd === "approve" || cmd === "deny") {
      const id = rest[0];
      if (!id) throw new UsageError(`usage: booksguard ${cmd} <hold id>  (see: booksguard holds)`);
      const r = decideHold(ctx, id, cmd);
      if (r.ok && r.hold && cmd === "deny")
        await appendAudit(ctx.guardDir, {
          event: "refused",
          client: "terminal",
          session: r.hold.session,
          toolName: r.hold.tool_name,
          args: r.hold.identity,
          record: {
            hold: r.hold.id,
            ledger: r.hold.ledger,
            server: r.hold.server,
            tool: r.hold.tool,
            op: r.hold.op,
            entity: r.hold.entity,
            company: r.hold.company,
            folder: r.hold.folder,
            title: r.hold.title
          },
          reason: "denied by a person in a terminal",
          now: ctx.now()
        });
      (r.ok ? io.out : io.err).write(`${r.message}
`);
      return r.ok ? 0 : 1;
    }
    if (cmd === "log") {
      const { values } = parseArgs({
        args: rest,
        options: {
          month: { type: "string" },
          company: { type: "string" },
          csv: { type: "boolean" },
          json: { type: "boolean" }
        }
      });
      const month = values.month ?? new Date(ctx.now()).toISOString().slice(0, 7);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new UsageError("--month is YYYY-MM");
      const rows = readLog(ctx.guardDir);
      const s = summarize(rows, month, values.company);
      if (values.csv) io.out.write(toCsv(s.clients.flatMap((c) => c.rows)));
      else if (values.json) w(JSON.stringify(s, null, 2));
      else {
        io.out.write(renderSummary(s));
        w("");
        w(
          `One firm-wide record of every client's AI changes, with a monthly sign-off, is not built yet: ${FIRM_LOG}`
        );
      }
      return 0;
    }
    if (cmd === "verify") {
      const v = await verifyLog(ctx.guardDir);
      if (v.ok)
        w(
          `ok: ${v.entries} entries, hash chain intact${v.head ? ` (head ${v.head.slice(0, 12)})` : ""}`
        );
      else io.err.write(`BROKEN at entry ${v.brokenAt}: ${v.reason}
`);
      return v.ok ? 0 : 1;
    }
    if (cmd === "check") {
      const { values, positionals } = parseArgs({
        args: rest,
        options: {
          args: { type: "string" },
          client: { type: "string" },
          json: { type: "boolean" }
        },
        allowPositionals: true
      });
      const tool = positionals[0];
      if (!tool) throw new UsageError("usage: booksguard check <tool name> [--args '<json>']");
      let toolInput = {};
      if (values.args) {
        try {
          toolInput = JSON.parse(values.args);
        } catch {
          throw new UsageError("--args is not valid JSON");
        }
      }
      const client = clientsFrom(values.client ?? "claude")[0];
      const { rules } = readRules(ctx.guardDir);
      const cls = classify(
        client,
        { tool_name: tool, tool_input: toolInput, cwd: ctx.cwd },
        {
          rules,
          home: ctx.home,
          guardDir: ctx.guardDir,
          env
        }
      );
      if (cls.kind === "pass" || cls.kind === "read") w(`passes: ${cls.why}`);
      else if (cls.kind === "refuse") w(`refused: ${cls.why}`);
      else {
        const d = renderDiff(cls);
        w(`${rules.mode === "hold" ? "held" : "would be held (watch mode)"}: ${d.title}`);
        w(`  why: ${cls.why}`);
        for (const line of d.lines) w(`    ${line}`);
      }
      return 0;
    }
    if (cmd === "demo") {
      const { runDemo: runDemo2 } = await Promise.resolve().then(() => (init_demo(), demo_exports));
      return await runDemo2(io.out);
    }
    if (cmd === "mcp") {
      const { serveStdio: serveStdio2 } = await Promise.resolve().then(() => (init_mcp(), mcp_exports));
      await serveStdio2({ home: ctx.home, guardDir: ctx.guardDir, env, cwd: ctx.cwd, now: ctx.now });
      return 0;
    }
    throw new UsageError(`unknown command "${cmd}"; see booksguard --help`);
  } catch (err) {
    if (err instanceof UsageError || err.code?.startsWith?.("ERR_PARSE_ARGS")) {
      io.err.write(`booksguard: ${err.message}
`);
      return 2;
    }
    throw err;
  }
}
function harnessFound(client, p) {
  return existsSync5(path9.resolve(harnessDir(client, p)));
}
export {
  CATALOG_SUMMARY,
  DEFAULT_RULES,
  FAMILIES,
  GENERIC_WRITES,
  HoldStore,
  INSTALL,
  NAME,
  REPO,
  RUN,
  approvalFromTurn,
  classify,
  companyOf,
  decideHold,
  httpCallOf,
  judgeRest,
  judgeTool,
  latestHumanTurn,
  main,
  moneyOf,
  readLog,
  readRules,
  renderDiff,
  runHook,
  splitMcpName,
  summarize,
  toCsv,
  verbAndEntity,
  verifyLog
};
//# sourceMappingURL=index.js.map