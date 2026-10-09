/**
 * Held writes, one JSON file each in `~/.booksguard/holds/`.
 *
 * A hold is found again by its identity: the server, the tool and the exact arguments. So the
 * agent's identical retry finds it, and any change to the arguments is a new hold with a new diff.
 * A hold is released once; after that the same identity starts a new hold, flagged as a duplicate
 * of the released one while it is recent (the official QuickBooks server has no idempotency, #100).
 *
 * Every read-modify-write of the directory runs under okgate's file lock, because Claude Code runs
 * matching hooks in parallel and a person may install both the plugin and the user-level hook.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { stableStringify } from "@agentwares/agentguard-core";
import { withFileLock } from "@agentwares/agentguard-core/node";
import type { Ledger, Op } from "./catalog.js";
import type { Client } from "./classify.js";
import type { Money } from "./diff.js";
import { holdsDir } from "./rules.js";

export type HoldStatus = "held" | "approved" | "released" | "denied";

export interface Hold {
  id: string;
  created_at: string;
  identity: string;
  status: HoldStatus;
  client: Client;
  session?: string;
  tool_use_id?: string;
  /** the tool name as the harness sent it */
  tool_name: string;
  tool: string;
  server: string;
  ledger: Ledger | "booksguard";
  op: Op | "guard-config";
  entity: string;
  company?: string;
  folder: string;
  title: string;
  diff: string[];
  money: Money;
  duplicate_of?: { id: string; released_at: string };
  approved_at?: string;
  /** "terminal", or the person's message: "message at 14:02 (“yes, post it”)" */
  approved_by?: string;
  released_at?: string;
  released_tool_use_id?: string;
}

/** How long a hold waits for its yes before the same call starts a new one. */
export const HOLD_TTL_MS = 24 * 60 * 60 * 1000;

export function identityOf(server: string, tool: string, args: unknown): string {
  return createHash("sha256")
    .update(stableStringify({ server, tool, args: args ?? null }))
    .digest("hex");
}

export function newHoldId(identity: string, createdAt: string): string {
  return `bg_${createHash("sha256").update(`${identity}:${createdAt}`).digest("hex").slice(0, 8)}`;
}

export class HoldStore {
  readonly dir: string;
  constructor(guardDir: string) {
    this.dir = holdsDir(guardDir);
  }

  private file(id: string): string {
    if (!/^bg_[0-9a-f]{8}$/.test(id))
      throw new Error(`"${id}" is not a hold id (bg_ and 8 hex digits)`);
    return path.join(this.dir, `${id}.json`);
  }

  /** Run `fn` with the holds directory locked. */
  locked<T>(fn: () => T): T {
    mkdirSync(this.dir, { recursive: true });
    return withFileLock(path.join(this.dir, ".lock"), fn);
  }

  get(id: string): Hold | undefined {
    const f = this.file(id);
    if (!existsSync(f)) return undefined;
    try {
      return JSON.parse(readFileSync(f, "utf8")) as Hold;
    } catch {
      return undefined;
    }
  }

  put(hold: Hold): void {
    mkdirSync(this.dir, { recursive: true });
    const f = this.file(hold.id);
    const tmp = `${f}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(hold, null, 2) + "\n");
    renameSync(tmp, f);
  }

  all(): Hold[] {
    if (!existsSync(this.dir)) return [];
    const out: Hold[] = [];
    for (const name of readdirSync(this.dir)) {
      if (!/^bg_[0-9a-f]{8}\.json$/.test(name)) continue;
      try {
        out.push(JSON.parse(readFileSync(path.join(this.dir, name), "utf8")) as Hold);
      } catch {
        // a torn file is skipped; the audit log keeps the record
      }
    }
    return out.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  /** The open hold (waiting or approved, not expired) for this exact call. */
  open(identity: string, now: number): Hold | undefined {
    return this.all()
      .filter(
        (h) =>
          h.identity === identity &&
          (h.status === "held" || h.status === "approved") &&
          now - Date.parse(h.created_at) < HOLD_TTL_MS,
      )
      .pop();
  }

  /** Holds still waiting for a person, newest last. */
  pending(now: number): Hold[] {
    return this.all().filter(
      (h) =>
        (h.status === "held" || h.status === "approved") &&
        now - Date.parse(h.created_at) < HOLD_TTL_MS,
    );
  }

  /** The latest release of this exact call inside the window. */
  lastRelease(identity: string, now: number, windowMs: number): Hold | undefined {
    return this.all()
      .filter(
        (h) =>
          h.identity === identity &&
          h.status === "released" &&
          h.released_at !== undefined &&
          now - Date.parse(h.released_at) < windowMs,
      )
      .pop();
  }

  /** The release that answered this very tool call (a second hook on the same call). */
  releasedFor(identity: string, toolUseId: string | undefined): Hold | undefined {
    if (!toolUseId) return undefined;
    return this.all().find((h) => h.identity === identity && h.released_tool_use_id === toolUseId);
  }
}
