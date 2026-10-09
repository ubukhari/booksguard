/** Test helpers: a temporary home per test, and a hook context bound to it. */
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Ctx } from "./hook.js";

export interface TempHome {
  root: string;
  home: string;
  guardDir: string;
  project: string;
  transcript: string;
  ctx: Ctx;
  env: NodeJS.ProcessEnv;
  clock: { now: number };
  cleanup(): void;
}

export function tempHome(start = Date.parse("2026-10-09T14:00:00Z")): TempHome {
  const root = mkdtempSync(path.join(tmpdir(), "booksguard-test-"));
  const home = path.join(root, "home");
  const project = path.join(home, "clients", "acme");
  mkdirSync(project, { recursive: true });
  const guardDir = path.join(home, ".booksguard");
  const clock = { now: start };
  // a clean environment: no CLAUDE_CONFIG_DIR or CODEX_HOME pointing anywhere else
  const env: NodeJS.ProcessEnv = { HOME: home };
  return {
    root,
    home,
    guardDir,
    project,
    transcript: path.join(home, ".claude", "projects", "acme", "s1.jsonl"),
    env,
    clock,
    ctx: { env, home, guardDir, cwd: project, now: () => clock.now },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
