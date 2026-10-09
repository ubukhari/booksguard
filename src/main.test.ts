/** The CLI's commands end to end, every one in a temporary home. */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { claudeInput, QBO_CREATE_INVOICE } from "./fixtures.js";
import { INSTALL } from "./install.js";
import { main } from "./main.js";
import { tempHome, type TempHome } from "./testing.js";

let t: TempHome;
afterEach(() => t?.cleanup());

async function run(argv: string[], stdin = "") {
  let out = "";
  let err = "";
  const code = await main(
    argv,
    {
      out: { write: (s: string) => (out += s) },
      err: { write: (s: string) => (err += s) },
      stdin: async () => stdin,
    },
    {
      cliPath: "/opt/booksguard/dist/cli.js",
      execPath: "/usr/local/bin/node",
      ctx: { home: t.home, guardDir: t.guardDir, cwd: t.project, now: t.ctx.now, env: t.env },
    },
  );
  return { code, out, err };
}

describe("booksguard", () => {
  it("install → hook → holds → approve → log → verify → uninstall", async () => {
    t = tempHome();
    mkdirSync(path.join(t.home, ".claude"), { recursive: true });
    const install = await run(["install"]);
    expect(install.code).toBe(0);
    expect(install.out).toMatch(/wrote {3}~\/\.booksguard\/rules\.json \(mode: hold\)/);
    expect(install.out).toMatch(/added {3}Claude Code hook in ~\/\.claude\/settings\.json/);
    expect(install.out).toMatch(/skip {4}Codex: not on this machine/);
    expect(existsSync(path.join(t.home, ".codex"))).toBe(false);
    const settings = JSON.parse(
      readFileSync(path.join(t.home, ".claude", "settings.json"), "utf8"),
    );
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe(
      "/usr/local/bin/node /opt/booksguard/dist/cli.js hook pre-tool-use --client claude",
    );

    const input = JSON.stringify(
      claudeInput("mcp__quickbooks__create_invoice", QBO_CREATE_INVOICE, {
        cwd: t.project,
        transcript: t.transcript,
        id: "toolu_1",
      }),
    );
    const hook = await run(["hook", "pre-tool-use", "--client", "claude"], input);
    expect(hook.code).toBe(0);
    const answer = JSON.parse(hook.out);
    expect(answer.hookSpecificOutput.permissionDecision).toBe("deny");
    const id = JSON.parse(answer.hookSpecificOutput.permissionDecisionReason).details
      .hold as string;

    const holds = await run(["holds"]);
    expect(holds.out).toContain(id);
    expect(holds.out).toContain("= total 1,250.00 across 2 lines");
    expect(holds.out).toContain(`approve: ${INSTALL} approve ${id}`);

    expect((await run(["approve", id])).out).toMatch(/^approved bg_/);
    t.clock.now += 60_000;
    const retry = await run(
      ["hook", "pre-tool-use", "--client", "claude"],
      JSON.stringify(
        claudeInput("mcp__quickbooks__create_invoice", QBO_CREATE_INVOICE, {
          cwd: t.project,
          transcript: t.transcript,
          id: "toolu_2",
        }),
      ),
    );
    expect(JSON.parse(retry.out).systemMessage).toMatch(
      /released .* approved by a terminal approve|approved by your terminal/,
    );

    const log = await run(["log", "--month", "2026-10"]);
    expect(log.out).toMatch(
      /folder acme: 1 held, 1 released \(1,250.00\), 0 still waiting, 0 refused/,
    );
    expect(log.out).toMatch(
      /firm-wide record .* is not built yet: https:\/\/agentwares-agentguard\.vercel\.app\/books\/firm-log\?ref=booksguard/,
    );
    const csv = await run(["log", "--month", "2026-10", "--csv"]);
    expect(csv.out.split("\n")[0]).toBe(
      "time,event,client,ledger,company,folder,what,total,approved_by,hold,harness,entry_hash",
    );
    expect(csv.out).toContain(",released,folder acme,QuickBooks,,acme,");
    expect((await run(["verify"])).out).toMatch(/^ok: 2 entries, hash chain intact/);

    const status = await run(["status"]);
    expect(status.out).toMatch(
      /user {4}Claude Code BROKEN: the hook runs a file that no longer exists/,
    );
    expect(status.out).toMatch(/holds {3}0 waiting/);

    const uninstall = await run(["uninstall"]);
    expect(uninstall.out).toMatch(/removed Claude Code hook from ~\/\.claude\/settings\.json/);
    expect(JSON.parse(readFileSync(path.join(t.home, ".claude", "settings.json"), "utf8"))).toEqual(
      {},
    );
  });

  it("install --client all writes every harness even when it is not there yet", async () => {
    t = tempHome();
    const r = await run(["install", "--client", "all"]);
    expect(r.out).toMatch(
      /added {3}Codex hook in ~\/\.codex\/hooks\.json: a terminal approve only/,
    );
    expect(r.out).toMatch(/added {3}Gemini CLI hook in ~\/\.gemini\/settings\.json/);
  });

  it("install --no-hooks only records where booksguard is, for the plugin's hook", async () => {
    t = tempHome();
    mkdirSync(path.join(t.home, ".claude"), { recursive: true });
    const r = await run(["install", "--no-hooks"]);
    expect(r.out).toMatch(/wrote {3}~\/\.booksguard\/cli-path/);
    expect(readFileSync(path.join(t.guardDir, "cli-path"), "utf8")).toBe(
      "/opt/booksguard/dist/cli.js\n",
    );
    expect(existsSync(path.join(t.home, ".claude", "settings.json"))).toBe(false);
  });

  it("deny turns a hold down and logs it", async () => {
    t = tempHome();
    await run(
      ["hook", "pre-tool-use"],
      JSON.stringify(
        claudeInput("mcp__quickbooks__create_invoice", QBO_CREATE_INVOICE, {
          cwd: t.project,
          transcript: t.transcript,
          id: "toolu_1",
        }),
      ),
    );
    const id = (await run(["holds", "--json"])).out.match(/"id": "(bg_[0-9a-f]{8})"/)![1]!;
    expect((await run(["deny", id])).out).toMatch(/^denied bg_/);
    expect((await run(["log", "--month", "2026-10", "--json"])).out).toContain('"refused": 1');
    expect((await run(["approve", id])).code).toBe(1);
  });

  it("check shows what would be held without a harness", async () => {
    t = tempHome();
    const r = await run([
      "check",
      "mcp__xero__create-payment",
      "--args",
      '{"invoiceId":"i1","accountId":"a1","amount":250}',
    ]);
    expect(r.out).toMatch(/^held: create payment 250.00 · Xero via "xero" \(Xero's MCP server\)/);
    expect((await run(["check", "mcp__xero__list-invoices"])).out).toMatch(
      /^passes: a read of Xero's MCP server/,
    );
  });

  it("help names the one install command; a bad command is a usage error", async () => {
    t = tempHome();
    const help = await run(["--help"]);
    expect(help.out).toContain(`${INSTALL} install`);
    expect(help.out).toContain("154 write tools across 4 servers, read 9 Oct 2026");
    expect((await run(["frobnicate"])).code).toBe(2);
    expect((await run(["log", "--month", "October"])).code).toBe(2);
  });
});
