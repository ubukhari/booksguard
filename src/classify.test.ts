import path from "node:path";
import { describe, expect, it } from "vitest";
import { classify, splitMcpName, type ClassifyContext, type HookInput } from "./classify.js";
import { DEFAULT_RULES } from "./rules.js";
import { OPAQUE_SERVER, XERO_CURL } from "./fixtures.js";

const home = "/tmp/bg-home";
const ctx = (over: Partial<typeof DEFAULT_RULES> = {}): ClassifyContext => ({
  rules: { ...DEFAULT_RULES, ...over },
  home,
  guardDir: path.join(home, ".booksguard"),
  env: { HOME: home },
});
const input = (tool_name: string, tool_input: unknown = {}): HookInput => ({
  tool_name,
  tool_input,
  cwd: "/tmp/bg-home/clients/acme",
});
const kind = (client: "claude" | "codex" | "gemini", tool: string, args: unknown = {}, c = ctx()) =>
  classify(client, input(tool, args), c).kind;

describe("MCP tool names", () => {
  it("splits each harness's naming", () => {
    expect(splitMcpName("claude", "mcp__quickbooks__create_invoice")).toEqual({
      server: "quickbooks",
      tool: "create_invoice",
    });
    expect(
      splitMcpName("claude", "mcp__claude_ai_Intuit_QuickBooks__qbo_sales_create_invoice"),
    ).toEqual({
      server: "claude_ai_Intuit_QuickBooks",
      tool: "qbo_sales_create_invoice",
    });
    expect(splitMcpName("gemini", "mcp_xero_create-invoice", "xero")).toEqual({
      server: "xero",
      tool: "create-invoice",
    });
    expect(splitMcpName("gemini", "mcp_my_books_create_journal_entry")).toEqual({
      server: "my_books",
      tool: "create_journal_entry",
    });
  });

  it("holds catalogued writes and passes reads", () => {
    expect(kind("claude", "mcp__quickbooks__create_invoice")).toBe("ledger-write");
    expect(kind("claude", "mcp__quickbooks__search_invoices")).toBe("read");
    expect(kind("codex", "mcp__xero__create-manual-journal")).toBe("ledger-write");
    expect(kind("gemini", "mcp_xero_list-invoices")).toBe("read");
    expect(kind("claude", "mcp__claude_ai_QuickBooks__qbo_sales_send_invoice")).toBe(
      "ledger-write",
    );
    expect(kind("claude", "mcp__meridian__delete_transaction")).toBe("ledger-write");
  });

  it("recognises a ledger by its distinctive tool names under any server name", () => {
    expect(kind("claude", `mcp__${OPAQUE_SERVER}__qbo_sales_create_invoice`)).toBe("ledger-write");
    expect(kind("claude", "mcp__books__batch_entity_operations")).toBe("ledger-write");
    expect(kind("claude", "mcp__whatever__create-manual-journal")).toBe("ledger-write");
  });

  it("holds a generic write name on an opaque connector, and passes it on a named non-ledger server", () => {
    expect(kind("claude", `mcp__${OPAQUE_SERVER}__create_invoice`)).toBe("ledger-write");
    expect(kind("claude", "mcp__stripe__create_invoice")).toBe("pass");
    expect(kind("claude", "mcp__stripe__create_customer")).toBe("pass");
  });

  it("holds an uncatalogued tool on a ledger server unless it reads", () => {
    const c = classify("claude", input("mcp__xero__create-bill-from-scan"), ctx());
    expect(c).toMatchObject({ kind: "ledger-write", ledger: "Xero", op: "create" });
    expect(kind("claude", "mcp__xero__get-organisation")).toBe("read");
  });

  it("follows the rulebook: ledger_servers, hold_tools, pass_tools", () => {
    expect(kind("claude", "mcp__books__create_invoice")).toBe("pass");
    expect(
      kind("claude", "mcp__books__create_invoice", {}, ctx({ ledger_servers: ["books"] })),
    ).toBe("ledger-write");
    expect(kind("claude", "mcp__crm__sync_to_ledger", {}, ctx({ hold_tools: ["sync_to_*"] }))).toBe(
      "ledger-write",
    );
    expect(
      kind(
        "claude",
        "mcp__quickbooks_sandbox__create_invoice",
        {},
        ctx({ pass_tools: ["mcp__quickbooks_sandbox__*"] }),
      ),
    ).toBe("pass");
  });

  it("names the company the call carries and calls a Xero ACCPAY invoice a bill", () => {
    const c = classify(
      "claude",
      input("mcp__xero__create-invoice", {
        tenantId: "t-9",
        type: "ACCPAY",
        contactId: "c1",
        lineItems: [],
      }),
      ctx(),
    );
    expect(c).toMatchObject({ kind: "ledger-write", company: "t-9", entity: "bill" });
  });
});

describe("REST calls in shell commands", () => {
  const sh = (command: string, client: "claude" | "codex" | "gemini" = "claude") =>
    classify(client, input(client === "gemini" ? "run_shell_command" : "Bash", { command }), ctx());

  it("passes reads", () => {
    expect(sh("curl -s https://quickbooks.api.intuit.com/v3/company/123/invoice/9").kind).toBe(
      "read",
    );
    expect(
      sh(
        `curl -X POST https://quickbooks.api.intuit.com/v3/company/123/query -d "select * from Invoice"`,
      ).kind,
    ).toBe("read");
    expect(sh("curl https://api.xero.com/api.xro/2.0/Invoices -H 'xero-tenant-id: t1'").kind).toBe(
      "read",
    );
    expect(sh("http GET https://api.xero.com/api.xro/2.0/Contacts").kind).toBe("read");
  });

  it("holds writes, with the method, record and company", () => {
    expect(
      sh(
        `curl -X POST 'https://quickbooks.api.intuit.com/v3/company/4620816365/invoice' -d '{"Line":[],"CustomerRef":{"value":"1"}}'`,
      ),
    ).toMatchObject({
      kind: "ledger-write",
      op: "create",
      entity: "invoice",
      company: "4620816365",
    });
    expect(
      sh(
        `curl -X POST 'https://quickbooks.api.intuit.com/v3/company/4620816365/invoice?operation=delete' -d '{"Id":"9","SyncToken":"0"}'`,
      ),
    ).toMatchObject({ kind: "ledger-write", op: "delete" });
    expect(
      sh(
        `curl -XPOST https://sandbox-quickbooks.api.intuit.com/v3/company/1/bill -d '{"Id":"5","sparse":true}'`,
      ),
    ).toMatchObject({ kind: "ledger-write", op: "update", entity: "bill" });
    expect(sh(XERO_CURL)).toMatchObject({
      kind: "ledger-write",
      ledger: "Xero",
      op: "create",
      entity: "bill",
      company: "7d1c2a40-1111-4b2b-9c3d-000000000001",
    });
    expect(sh("http DELETE https://api.xero.com/api.xro/2.0/Payments/abc")).toMatchObject({
      kind: "ledger-write",
      op: "delete",
    });
    expect(sh("wget --method=PUT https://api.xero.com/api.xro/2.0/Contacts", "gemini").kind).toBe(
      "ledger-write",
    );
    expect(
      sh("bash -c \"curl -X POST https://api.xero.com/api.xro/2.0/Invoices -d '{}'\"").kind,
    ).toBe("ledger-write");
  });

  it("holds any other command that names a ledger API host", () => {
    expect(
      sh(
        `python3 -c "import requests; requests.post('https://quickbooks.api.intuit.com/v3/company/1/invoice', json={})"`,
      ),
    ).toMatchObject({ kind: "ledger-write", op: "unknown" });
    expect(
      sh('URL=https://api.xero.com/api.xro/2.0/Invoices; curl -X PUT "$URL" -d @bill.json').kind,
    ).toBe("ledger-write");
  });

  it("passes commands that touch no ledger", () => {
    expect(sh("npm test").kind).toBe("pass");
    expect(sh("curl -X POST https://api.stripe.com/v1/invoices").kind).toBe("pass");
  });
});

describe("booksguard itself", () => {
  const sh = (command: string) => classify("claude", input("Bash", { command }), ctx());

  it("refuses the agent approving its own hold or removing the hook, under any spelling", () => {
    for (const command of [
      "booksguard approve bg_12345678",
      "npx --allow-git=root github:agentwares/booksguard approve bg_12345678",
      "npx -y booksguard@latest approve bg_12345678",
      "node ~/.booksguard/runtime/node_modules/booksguard/dist/cli.js approve bg_12345678",
      "echo ok && booksguard uninstall",
    ])
      expect(sh(command).kind, command).toBe("refuse");
    expect(sh("booksguard holds").kind).toBe("pass");
    expect(sh("booksguard log --csv").kind).toBe("pass");
  });

  it("refuses writes into booksguard's home and lets it be read", () => {
    expect(sh("rm -rf ~/.booksguard/holds").kind).toBe("refuse");
    expect(sh(`echo '{"mode":"watch"}' > ~/.booksguard/rules.json`).kind).toBe("refuse");
    expect(sh("cat ~/.booksguard/rules.json").kind).toBe("pass");
    expect(
      classify(
        "claude",
        input("Write", { file_path: "/tmp/bg-home/.booksguard/rules.json", content: "{}" }),
        ctx(),
      ).kind,
    ).toBe("refuse");
    expect(
      classify(
        "codex",
        input("apply_patch", {
          command: "*** Begin Patch\n*** Update File: /tmp/bg-home/.booksguard/rules.json\n",
        }),
        ctx(),
      ).kind,
    ).toBe("refuse");
  });

  it("holds a change to a harness's hook settings like a ledger write", () => {
    expect(
      classify(
        "claude",
        input("Edit", {
          file_path: "/tmp/bg-home/.claude/settings.json",
          old_string: "a",
          new_string: "b",
        }),
        ctx(),
      ),
    ).toMatchObject({ kind: "guard-config", target: "/tmp/bg-home/.claude/settings.json" });
    expect(
      classify(
        "gemini",
        input("write_file", { file_path: "/tmp/bg-home/.gemini/settings.json" }),
        ctx(),
      ).kind,
    ).toBe("guard-config");
    expect(
      sh("jq 'del(.hooks)' ~/.claude/settings.json > /tmp/x && mv /tmp/x ~/.claude/settings.json")
        .kind,
    ).toBe("guard-config");
    expect(sh("cat ~/.claude/settings.json").kind).toBe("pass");
  });
});
