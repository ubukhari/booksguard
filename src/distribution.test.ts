/**
 * The files that put booksguard where people already are: the package, the README and its
 * recorded run, the CHANGELOG, the repo-root files the sync copies from `distribution/root` (the
 * Claude Code and Cowork plugin marketplace, the plugin's hook and skill), and the mirror the /books
 * pages on okgate's site import. The public repo has the root files at its root and no site, so
 * those checks run in the monorepo only.
 *
 * After changing the CLI's output or the plugin's hook, rewrite the recorded run, hooks.json and
 * the site's mirror:
 *
 *   pnpm --filter booksguard record
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { FAMILIES } from "./catalog.js";
import { runDemo } from "./demo.js";
import { pluginHooks } from "./harnesses.js";
import { INSTALL, ON_NPM, PUBLISHED, REPO, RUN } from "./install.js";

const here = (rel: string): URL => new URL(`../${rel}`, import.meta.url);
const read = (rel: string): string => readFileSync(here(rel), "utf8");
const json = <T>(rel: string): T => JSON.parse(read(rel)) as T;
const WRITE = Boolean(process.env["BOOKSGUARD_WRITE"]);
const pkg = json<{
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  files: string[];
  bin: Record<string, string>;
  homepage: string;
}>("package.json");

async function recordedRun(): Promise<string> {
  let out = "";
  const code = await runDemo({ write: (s: string) => (out += s) });
  return [`$ ${INSTALL} demo`, out.trimEnd(), `(exit ${code})`, ""].join("\n");
}

let recording: string;
beforeAll(async () => {
  recording = await recordedRun();
});

describe("package", () => {
  it("has one runtime dependency, okgate's engine, served by npm", () => {
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(["@agentwares/agentguard-core"]);
  });

  it("ships the CLI and the files the README points at", () => {
    expect(pkg.name).toBe("booksguard");
    expect(pkg.bin).toEqual({ booksguard: "./dist/cli.js" });
    expect(pkg.files).toEqual(expect.arrayContaining(["dist", "README.md", "CHANGELOG.md"]));
    expect(pkg.homepage).toBe("https://agentwares-agentguard.vercel.app/books");
  });

  it("CHANGELOG has a section for this version", () => {
    expect(read("CHANGELOG.md")).toMatch(
      new RegExp(`^## ${pkg.version.replace(/\./g, "\\.")} `, "m"),
    );
  });
});

const BLOCK = /<!-- recorded-run -->\n+```text\n[\s\S]*?```\n+<!-- \/recorded-run -->/;

describe("README", () => {
  it("leads with the one-line install", () => {
    expect(read("README.md")).toContain("```sh\n" + INSTALL + " install\n```");
  });

  it("carries the recorded run on synthetic calls, which is the CLI's real output", () => {
    const block =
      "<!-- recorded-run -->\n\n```text\n" + recording + "```\n\n<!-- /recorded-run -->";
    if (WRITE) {
      writeFileSync(here("docs/recorded-run.txt"), recording);
      writeFileSync(here("README.md"), read("README.md").replace(BLOCK, block));
    }
    expect(read("docs/recorded-run.txt")).toBe(recording);
    expect(read("README.md")).toContain(block);
    for (const event of ["passes", "deny", "DUPLICATE", "OUT OF BALANCE", "released", "refused"])
      expect(recording).toContain(event);
    expect(recording).toMatch(/hash chain intact/);
    // nothing of the machine it was recorded on
    expect(recording).not.toMatch(/\/Users\/|\/home\/|booksguard-demo-/);
  });

  it("names its sources with the date they were read, and what it does not do", () => {
    const readme = read("README.md");
    for (const url of [
      "https://github.com/intuit/quickbooks-online-mcp-server",
      "https://github.com/XeroAPI/xero-mcp-server",
      "https://claude.com/connectors/intuit-quickbooks",
      "https://claude.com/connectors/meridian-connector-for-quickbooks",
      "https://www.xero.com/ai-in-accounting/claude/",
      "https://code.claude.com/docs/en/hooks",
      "https://learn.chatgpt.com/docs/hooks",
    ])
      expect(readme).toContain(url);
    expect(readme).toContain("9 October 2026");
    expect(readme).toContain("seatbelt, not a vault");
    expect(readme).toContain("no network request");
    expect(readme).toMatch(/not built yet/);
  });

  it("states the catalogue's counts as catalog.ts holds them", () => {
    const readme = read("README.md");
    const count = (id: string) => {
      const f = FAMILIES.find((x) => x.id === id)!;
      return `${f.writes.length} of ${f.writes.length + f.reads.length}`;
    };
    for (const id of ["intuit-local", "meridian", "xero-local"])
      expect(readme).toContain(count(id));
    // Intuit's hosted connector lists 74 tools; the catalogue holds all 74 names
    expect(count("intuit-hosted")).toBe("27 of 74");
    expect(readme).toContain("27 of 74");
  });
});

const root = "distribution/root";
const plugin = `${root}/plugins/booksguard`;
const frontmatter = (text: string): Record<string, string> =>
  Object.fromEntries(
    (text.split("---")[1] ?? "")
      .split("\n")
      .map((l) => /^([a-z-]+):\s*(.*)$/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1]!, m[2]!.replace(/^"|"$/g, "")]),
  );
const walk = (rel: string): string[] =>
  !existsSync(here(rel))
    ? []
    : statSync(here(rel)).isFile()
      ? [rel]
      : readdirSync(here(rel), { withFileTypes: true })
          .filter((e) => !["node_modules", "dist", ".next"].includes(e.name))
          .flatMap((e) => walk(`${rel}/${e.name}`));

describe.skipIf(!existsSync(here(root)))("repo-root files (distribution/root)", () => {
  it("the marketplace's plugin resolves, and its version matches this package", () => {
    const marketplace = json<{
      name: string;
      owner: { name: string };
      plugins: { name: string; source: string }[];
    }>(`${root}/.claude-plugin/marketplace.json`);
    expect(marketplace.name).toBe("booksguard");
    expect(marketplace.owner.name).toBe("agentwares");
    expect(marketplace.plugins.map((p) => [p.name, p.source])).toEqual([
      ["booksguard", "./plugins/booksguard"],
    ]);
    const manifest = json<Record<string, string>>(`${plugin}/.claude-plugin/plugin.json`);
    expect(manifest.name).toBe("booksguard");
    expect(manifest.version).toBe(pkg.version);
    expect(manifest.homepage).toBe(pkg.homepage);
    expect(manifest.repository).toBe(REPO);
    expect(manifest.documentationUrl).toBe(`${REPO}#readme`);
    expect(manifest.license).toBe("MIT");
  });

  it("the plugin's hook is the one src/harnesses.ts defines, running the copy install recorded or RUN", () => {
    const want = JSON.stringify(pluginHooks(RUN), null, 2) + "\n";
    if (WRITE) writeFileSync(here(`${plugin}/hooks/hooks.json`), want);
    expect(read(`${plugin}/hooks/hooks.json`)).toBe(want);
    const command = (
      pluginHooks(RUN) as { hooks: { PreToolUse: { hooks: { command: string }[] }[] } }
    ).hooks.PreToolUse[0]!.hooks[0]!.command;
    expect(command).toContain('cat "$d/cli-path"');
    expect(command).toContain(`exec ${RUN} hook pre-tool-use --client claude`);
  });

  it("has no top-level bin/, which would make Cowork refuse the plugin", () => {
    expect(existsSync(here(`${plugin}/bin`))).toBe(false);
  });

  it("the one skill explains a held write and runs the CLI; nothing pre-approves a tool", () => {
    expect(readdirSync(here(`${plugin}/skills`))).toEqual(["booksguard"]);
    const text = read(`${plugin}/skills/booksguard/SKILL.md`);
    const front = frontmatter(text);
    expect(front.name).toBe("booksguard");
    expect(front.description!.length).toBeGreaterThan(80);
    expect(front.description!.length).toBeLessThanOrEqual(1024);
    expect(text).toContain(`${RUN} $ARGUMENTS`);
    expect(text).toContain("APPROVAL_REQUIRED");
    expect(text).toMatch(/Never run `booksguard approve` yourself/);
    for (const f of walk(plugin).filter((x) => x.endsWith(".md") || x.endsWith(".json"))) {
      const t = read(f);
      const head = t.startsWith("---") ? (t.split("---")[1] ?? "") : t;
      expect(head, f).not.toMatch(/allowed-?tools/i);
    }
  });

  it("the listing icon is a 1024 px square PNG drawn from distribution/icon.svg (`pnpm icon`)", () => {
    const manifest = json<{ icon?: string }>(`${plugin}/.claude-plugin/plugin.json`);
    expect(manifest.icon).toBe("./.claude-plugin/icon.png");
    const png = readFileSync(here(`${plugin}/${manifest.icon!.slice(2)}`));
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.readUInt32BE(16)).toBe(1024);
    expect(png.readUInt32BE(20)).toBe(1024);
    const key = "booksguard-icon-source-sha256\0";
    const at = png.indexOf(key, 0, "latin1");
    expect(at, "icon.png carries no source hash: run `pnpm icon`").toBeGreaterThan(0);
    const drawnFrom = png.subarray(at + key.length, at + key.length + 64).toString("latin1");
    const svg = createHash("sha256").update(read("distribution/icon.svg")).digest("hex");
    expect(drawnFrom, "distribution/icon.svg changed: run `pnpm icon`").toBe(svg);
  });

  it("the plugin's README names what it runs and what it does not cover", () => {
    const readme = read(`${plugin}/README.md`);
    expect(readme).toContain(RUN);
    expect(readme).toContain(`${INSTALL} install --no-hooks`);
    expect(readme).toContain("pre-approves nothing");
    expect(readme).toMatch(/Claude chat on the web, desktop or mobile/);
  });
});

const COMMAND =
  /npx (?:-{1,2}[\w-]+(?:=[\w-]+)? )*(?:github:agentwares\/)?booksguard(?:@latest)?(?![\w./-])/g;
const forms = (text: string): string[] => [...text.matchAll(COMMAND)].map((m) => m[0]);

describe("the install command", () => {
  it(`is ${INSTALL} while ON_NPM is ${String(ON_NPM)}`, () => {
    expect(INSTALL).toBe(`npx ${ON_NPM ? "" : "--allow-git=root github:agentwares/"}${pkg.name}`);
    expect(RUN).toBe(
      ON_NPM
        ? `npx -y ${pkg.name}@latest`
        : `npx -y --allow-git=root github:agentwares/${pkg.name}`,
    );
    expect(REPO).toBe(`https://github.com/agentwares/${pkg.name}`);
  });

  const UNFLAGGED = /npx (?:(?:-y|--yes) )?github:agentwares\/booksguard(?![\w./-])/;
  it("never shows the GitHub form without --allow-git, which npm 12 refuses", () => {
    const files = [
      "README.md",
      "CHANGELOG.md",
      "docs/recorded-run.txt",
      ...walk("distribution"),
      ...walk("src"),
      ...walk("../agentguard-app/src/app/books"),
      ...walk("../../docs/handoff/briefs/DOOR-14.md"),
      ...walk("../../docs/reports/DOOR-14.md"),
      ...walk("../../scripts/sync-oss-repos.sh"),
    ].filter((f) => /\.(md|json|txt|ts|tsx|mjs|sh)$/.test(f));
    expect(files.length).toBeGreaterThan(15);
    for (const file of files) expect(read(file), file).not.toMatch(UNFLAGGED);
  });

  const docs = [
    "README.md",
    "CHANGELOG.md",
    "docs/recorded-run.txt",
    ...walk("distribution"),
  ].filter((f) => /\.(md|json|txt)$/.test(f));
  it.each(docs)("%s names only INSTALL or RUN", (file) => {
    for (const form of forms(read(file))) expect([INSTALL, RUN], file).toContain(form);
  });

  it("code imports it rather than spell it", () => {
    const files = walk("src").filter(
      (f) => f !== "src/install.ts" && !f.endsWith(".test.ts") && f.endsWith(".ts"),
    );
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) expect(forms(read(file)), file).toEqual([]);
  });
});

/** The /books pages import a mirror of src/install.ts, written here. */
const SITE = "../agentguard-app/src/app/books/_lib";
describe.skipIf(!existsSync(here(SITE)))("okgate's /books pages", () => {
  it("import the same install command", () => {
    const mirror = `/**
 * How to run booksguard, mirrored from apps/booksguard-cli/src/install.ts, the one constant.
 * Written by apps/booksguard-cli/src/distribution.test.ts, which fails when the two differ.
 * While PUBLISHED is false the pages show neither INSTALL nor REPO, only each client's own settings.
 */
export const ON_NPM: boolean = ${String(ON_NPM)};
export const PUBLISHED: boolean = ${String(PUBLISHED)};
export const INSTALL = ${JSON.stringify(INSTALL)};
export const REPO = ${JSON.stringify(REPO)};
`;
    if (WRITE) writeFileSync(here(`${SITE}/install.ts`), mirror);
    expect(read(`${SITE}/install.ts`)).toBe(mirror);
  });

  it("state the catalogue's counts and the CLI's hand-off sentence", () => {
    const pages = read(`${SITE}/pages.ts`);
    for (const f of FAMILIES.filter((x) => x.writes.length > 0))
      expect(pages, f.id).toContain(`"${f.writes.length} of ${f.writes.length + f.reads.length}"`);
    expect(pages).toContain(
      "One firm-wide record of every client's AI changes, with a monthly sign-off, is not built yet.",
    );
    expect(read("src/main.ts")).toContain(
      "One firm-wide record of every client's AI changes, with a monthly sign-off, is not built yet",
    );
  });
});
