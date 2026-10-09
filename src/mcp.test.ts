import { afterEach, describe, expect, it } from "vitest";
import { claudeInput, QBO_CREATE_INVOICE } from "./fixtures.js";
import { runHook } from "./hook.js";
import type { TOOLS } from "./mcp.js";
import { callTool, handleMessage, type McpContext } from "./mcp.js";
import { tempHome, type TempHome } from "./testing.js";

let t: TempHome;
afterEach(() => t?.cleanup());

const mctx = (): McpContext => ({
  home: t.home,
  guardDir: t.guardDir,
  env: t.env,
  cwd: t.project,
  now: t.ctx.now,
});

describe("booksguard mcp", () => {
  it("lists three read-only tools, namespaced, strict, with all four annotations", () => {
    t = tempHome();
    const res = handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" }, mctx()) as {
      result: { tools: typeof TOOLS };
    };
    expect(res.result.tools.map((x) => x.name)).toEqual([
      "booksguard_check_write",
      "booksguard_list_holds",
      "booksguard_month_log",
    ]);
    for (const tool of res.result.tools) {
      expect(tool.inputSchema.additionalProperties).toBe(false);
      expect(tool.description.length).toBeGreaterThan(80);
      expect(tool.annotations).toEqual({
        title: tool.title,
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }
    expect(res.result.tools.some((x) => /approve|deny/.test(x.name))).toBe(false);
  });

  it("answers initialize with its instructions", () => {
    t = tempHome();
    const res = handleMessage(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
      mctx(),
    ) as { result: { protocolVersion: string; instructions: string } };
    expect(res.result.protocolVersion).toBe("2025-06-18");
    expect(res.result.instructions).toMatch(/Nothing here approves a write/);
  });

  it("booksguard_check_write shows what would be held and its diff", () => {
    t = tempHome();
    const r = callTool(
      "booksguard_check_write",
      { tool_name: "mcp__quickbooks__create_invoice", arguments: QBO_CREATE_INVOICE },
      mctx(),
    );
    expect(r.isError).toBe(false);
    expect(r.structured).toMatchObject({ held: true, mode: "hold", ledger: "QuickBooks" });
    expect(r.structured.diff).toContain("= total 1,250.00 across 2 lines");
    expect(
      callTool("booksguard_check_write", { tool_name: "mcp__quickbooks__search_invoices" }, mctx())
        .structured,
    ).toMatchObject({
      held: false,
      kind: "read",
    });
  });

  it("booksguard_list_holds and booksguard_month_log read the local state", async () => {
    t = tempHome();
    await runHook(
      "claude",
      JSON.stringify(
        claudeInput("mcp__quickbooks__create_invoice", QBO_CREATE_INVOICE, {
          cwd: t.project,
          transcript: t.transcript,
          id: "toolu_1",
        }),
      ),
      t.ctx,
    );
    const holds = callTool("booksguard_list_holds", {}, mctx()).structured as {
      count: number;
      holds: { what: string }[];
    };
    expect(holds.count).toBe(1);
    expect(holds.holds[0]!.what).toMatch(/^create invoice 1,250.00/);
    const log = callTool("booksguard_month_log", { month: "2026-10" }, mctx()).structured as {
      clients: { client: string; held: number; still_waiting: number }[];
    };
    expect(log.clients).toEqual([
      expect.objectContaining({ client: "folder acme", held: 1, still_waiting: 1 }),
    ]);
  });

  it("refuses unknown arguments with code, cause, fix and retryable", () => {
    t = tempHome();
    const r = callTool("booksguard_list_holds", { approve: true }, mctx());
    expect(r.isError).toBe(true);
    expect(r.structured).toMatchObject({ code: "INVALID_INPUT", retryable: false });
    expect(callTool("booksguard_month_log", { month: "Oct" }, mctx()).isError).toBe(true);
  });
});
