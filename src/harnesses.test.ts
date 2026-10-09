/** The installer, against settings files in a temporary home only. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  findLedgerServers,
  hookCommand,
  hookFile,
  hookState,
  installHook,
  isOurs,
  MATCHERS,
  stableCli,
  uninstallHook,
} from "./harnesses.js";
import { tempHome, type TempHome } from "./testing.js";

let t: TempHome;
afterEach(() => t?.cleanup());

const read = (f: string) => JSON.parse(readFileSync(f, "utf8"));
const cmd = (client: "claude" | "codex" | "gemini") =>
  hookCommand(client, { execPath: "/usr/local/bin/node", cliPath: "/opt/booksguard/dist/cli.js" });

describe("installHook", () => {
  it("adds booksguard beside the hooks already there, backs the file up once, and is idempotent", () => {
    t = tempHome();
    const file = hookFile("claude", { home: t.home, env: t.env });
    expect(file).toBe(path.join(t.home, ".claude", "settings.json"));
    mkdirSync(path.dirname(file), { recursive: true });
    const theirs = {
      model: "opus",
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "my-linter" }] }],
        Stop: [{ hooks: [{ type: "command", command: "say done" }] }],
      },
    };
    writeFileSync(file, JSON.stringify(theirs));
    expect(installHook("claude", cmd("claude"), { home: t.home, env: t.env }).action).toBe("added");
    const after = read(file);
    expect(after.model).toBe("opus");
    expect(after.hooks.Stop).toEqual(theirs.hooks.Stop);
    expect(after.hooks.PreToolUse[0]).toEqual(theirs.hooks.PreToolUse[0]);
    expect(after.hooks.PreToolUse[1]).toEqual({
      matcher: MATCHERS.claude,
      hooks: [
        {
          type: "command",
          command:
            "/usr/local/bin/node /opt/booksguard/dist/cli.js hook pre-tool-use --client claude",
          timeout: 30,
          statusMessage: "booksguard",
        },
      ],
    });
    expect(read(`${file}.booksguard-backup`)).toEqual(theirs);
    expect(installHook("claude", cmd("claude"), { home: t.home, env: t.env }).action).toBe(
      "unchanged",
    );
    expect(installHook("claude", `${cmd("claude")} `, { home: t.home, env: t.env }).action).toBe(
      "updated",
    );
    expect(
      read(file).hooks.PreToolUse.filter((e: { hooks: { command: string }[] }) =>
        isOurs(e.hooks[0]!.command),
      ),
    ).toHaveLength(1);
    expect(hookState("claude", { home: t.home, env: t.env }).state).toBe("broken"); // /opt/... does not exist
  });

  it("writes each harness's own shape", () => {
    t = tempHome();
    const p = { home: t.home, env: t.env };
    installHook("codex", cmd("codex"), p);
    installHook("gemini", cmd("gemini"), p);
    expect(read(path.join(t.home, ".codex", "hooks.json")).hooks.PreToolUse[0]).toMatchObject({
      matcher: MATCHERS.codex,
      hooks: [{ type: "command", timeout: 30 }],
    });
    expect(read(path.join(t.home, ".gemini", "settings.json")).hooks.BeforeTool[0]).toMatchObject({
      matcher: MATCHERS.gemini,
      hooks: [{ name: "booksguard", type: "command", timeout: 30_000 }],
    });
  });

  it("respects CLAUDE_CONFIG_DIR and CODEX_HOME, and --project", () => {
    t = tempHome();
    const env = {
      ...t.env,
      CLAUDE_CONFIG_DIR: path.join(t.root, "cc"),
      CODEX_HOME: path.join(t.root, "cx"),
    };
    expect(hookFile("claude", { home: t.home, env })).toBe(
      path.join(t.root, "cc", "settings.json"),
    );
    expect(hookFile("codex", { home: t.home, env })).toBe(path.join(t.root, "cx", "hooks.json"));
    expect(hookFile("claude", { home: t.home, env, project: t.project })).toBe(
      path.join(t.project, ".claude", "settings.json"),
    );
  });

  it("refuses to rewrite a file it cannot read as JSON", () => {
    t = tempHome();
    const file = path.join(t.home, ".claude", "settings.json");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, "{ not json");
    expect(installHook("claude", cmd("claude"), { home: t.home, env: t.env })).toMatchObject({
      action: "skipped",
    });
    expect(readFileSync(file, "utf8")).toBe("{ not json");
  });

  it("uninstall removes only booksguard's entries", () => {
    t = tempHome();
    const p = { home: t.home, env: t.env };
    const file = hookFile("claude", p);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(
      file,
      JSON.stringify({
        hooks: {
          PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "my-linter" }] }],
        },
      }),
    );
    installHook("claude", cmd("claude"), p);
    expect(uninstallHook("claude", p).removed).toBe(true);
    expect(read(file)).toEqual({
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "my-linter" }] }],
      },
    });
    expect(uninstallHook("claude", p).removed).toBe(false);
    expect(uninstallHook("gemini", p).removed).toBe(false);
  });
});

describe("stableCli", () => {
  it("leaves a CLI outside npx's cache where it is", () => {
    expect(stableCli("/opt/booksguard/dist/cli.js", "/nonexistent/g")).toBe(
      "/opt/booksguard/dist/cli.js",
    );
  });

  it("copies a CLI out of npx's cache into booksguard's home", () => {
    t = tempHome();
    const npx = path.join(t.root, "npm", "_npx", "abc", "node_modules");
    mkdirSync(path.join(npx, "booksguard", "dist"), { recursive: true });
    mkdirSync(path.join(npx, "@agentwares", "agentguard-core"), { recursive: true });
    writeFileSync(path.join(npx, "booksguard", "dist", "cli.js"), "// cli");
    const stable = stableCli(path.join(npx, "booksguard", "dist", "cli.js"), t.guardDir);
    expect(stable).toBe(
      path.join(t.guardDir, "runtime", "node_modules", "booksguard", "dist", "cli.js"),
    );
    expect(existsSync(stable)).toBe(true);
    expect(
      existsSync(
        path.join(t.guardDir, "runtime", "node_modules", "@agentwares", "agentguard-core"),
      ),
    ).toBe(true);
  });
});

describe("findLedgerServers", () => {
  it("finds QuickBooks and Xero servers by name, command or URL, and returns names only", () => {
    t = tempHome();
    writeFileSync(
      path.join(t.home, ".claude.json"),
      JSON.stringify({
        mcpServers: {
          books: {
            command: "node",
            args: ["/srv/quickbooks-online-mcp-server/dist/index.js"],
            env: { QUICKBOOKS_CLIENT_SECRET: "s3cr3t-value" },
          },
          github: { command: "gh-mcp" },
        },
        projects: {
          "/x": {
            mcpServers: {
              meridian: { type: "http", url: "https://qbo-connector.meridian.pilot.com/mcp" },
            },
          },
        },
      }),
    );
    mkdirSync(path.join(t.home, ".codex"), { recursive: true });
    writeFileSync(
      path.join(t.home, ".codex", "config.toml"),
      `model = "gpt-5"\n[mcp_servers.ledger]\ncommand = "npx"\nargs = ["-y", "@xeroapi/xero-mcp-server@latest"]\n[mcp_servers.ledger.env]\nXERO_CLIENT_SECRET = "another-secret"\n[mcp_servers.docs]\ncommand = "docs-mcp"\n`,
    );
    const found = findLedgerServers({ home: t.home, env: t.env }, t.project);
    expect(found).toEqual([
      { name: "books", where: "~/.claude.json" },
      { name: "meridian", where: "~/.claude.json" },
      { name: "ledger", where: "~/.codex/config.toml" },
    ]);
    expect(JSON.stringify(found)).not.toMatch(/secret/i);
  });
});
