/**
 * booksguard's home and rulebook.
 *
 * `~/.booksguard/` (or `$BOOKSGUARD_HOME`) holds:
 * - `rules.json`, the rulebook a person edits;
 * - `holds/<id>.json`, one file per held write;
 * - `audit.jsonl`, okgate's hash-chained log of every hold, release and refusal;
 * - `runtime/`, a stable copy of the CLI when it was installed from npx's cache.
 *
 * A missing rulebook means the defaults: hold every ledger write. A rulebook that cannot be read
 * also means the defaults, said once in the hook's message, so a broken file never lets a write
 * through.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface Rules {
  version: 1;
  /** hold: every ledger write waits for a yes. watch: nothing is held; each would-be hold is logged. */
  mode: "hold" | "watch";
  /** how old the person's approving message may be */
  approval_window_minutes: number;
  /** a write identical to one released this recently is flagged in its diff */
  duplicate_window_hours: number;
  /**
   * MCP server names that are QuickBooks or Xero servers, beyond the names that say so
   * (quickbooks, qbo, intuit, xero, meridian). Exact names or `*` globs; `install` adds the ones it
   * finds in the harnesses' MCP configs.
   */
  ledger_servers: string[];
  /** tool names (or `*` globs) to hold on any server */
  hold_tools: string[];
  /** tool names (or `*` globs) never to hold, e.g. a sandbox company's own server */
  pass_tools: string[];
}

export const DEFAULT_RULES: Rules = {
  version: 1,
  mode: "hold",
  approval_window_minutes: 30,
  duplicate_window_hours: 24,
  ledger_servers: [],
  hold_tools: [],
  pass_tools: [],
};

export class UsageError extends Error {}

/** `$BOOKSGUARD_HOME`, else `<home>/.booksguard`. */
export function guardHome(home: string, env: NodeJS.ProcessEnv): string {
  const fromEnv = env.BOOKSGUARD_HOME?.trim();
  return fromEnv ? path.resolve(fromEnv) : path.join(home, ".booksguard");
}

export const rulesFile = (dir: string): string => path.join(dir, "rules.json");
export const auditFile = (dir: string): string => path.join(dir, "audit.jsonl");
export const holdsDir = (dir: string): string => path.join(dir, "holds");

export interface LoadedRules {
  rules: Rules;
  /** why the file was not used, when it exists and could not be */
  problem?: string;
  exists: boolean;
}

function strings(v: unknown): string[] | undefined {
  return Array.isArray(v) && v.every((s) => typeof s === "string") ? (v as string[]) : undefined;
}

function positive(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
}

export function readRules(dir: string): LoadedRules {
  const file = rulesFile(dir);
  if (!existsSync(file)) return { rules: { ...DEFAULT_RULES }, exists: false };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    return {
      rules: { ...DEFAULT_RULES },
      exists: true,
      problem: `${file} is not valid JSON (${(err as Error).message}); the defaults apply`,
    };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return {
      rules: { ...DEFAULT_RULES },
      exists: true,
      problem: `${file} is not a JSON object; the defaults apply`,
    };
  const r = raw as Record<string, unknown>;
  const rules: Rules = {
    version: 1,
    mode: r.mode === "watch" ? "watch" : "hold",
    approval_window_minutes:
      positive(r.approval_window_minutes) ?? DEFAULT_RULES.approval_window_minutes,
    duplicate_window_hours:
      positive(r.duplicate_window_hours) ?? DEFAULT_RULES.duplicate_window_hours,
    ledger_servers: strings(r.ledger_servers) ?? [],
    hold_tools: strings(r.hold_tools) ?? [],
    pass_tools: strings(r.pass_tools) ?? [],
  };
  return { rules, exists: true };
}

/** The rulebook as written to disk: the settings, then what each one means. */
export function renderRules(rules: Rules): string {
  return (
    JSON.stringify(
      {
        ...rules,
        _help: {
          mode: "hold: every QuickBooks or Xero write waits for a person's yes. watch: nothing is held; each would-be hold is logged (booksguard log).",
          approval_window_minutes:
            "how old the person's approving message may be when the agent retries",
          duplicate_window_hours:
            "a write identical to one released this recently is flagged DUPLICATE in its diff",
          ledger_servers:
            "MCP server names that are QuickBooks or Xero servers, beyond names containing quickbooks, qbo, intuit, xero or meridian (exact or * globs)",
          hold_tools: "tool names (or * globs) to hold on any server",
          pass_tools: "tool names (or * globs) never to hold",
        },
      },
      null,
      2,
    ) + "\n"
  );
}

export function writeRules(dir: string, rules: Rules): void {
  mkdirSync(dir, { recursive: true });
  const file = rulesFile(dir);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, renderRules(rules));
  renameSync(tmp, file);
}

/** `*` glob over a whole name, case-insensitive. */
export function globMatch(name: string, pattern: string): boolean {
  const re = new RegExp(
    `^${pattern
      .split("*")
      .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*")}$`,
    "i",
  );
  return re.test(name);
}

export const anyGlob = (name: string, patterns: readonly string[]): string | undefined =>
  patterns.find((p) => globMatch(name, p));
