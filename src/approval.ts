/**
 * Did the person approve a held write in their own message?
 *
 * The latest entry a person wrote is found in the Claude Code (and Cowork) transcript with okgate's
 * rules (`scanTranscript` in @agentwares/agentguard-core): a user entry that is not a tool result,
 * not injected by the harness, not a subagent's prompt and, where Claude Code labels it, of human
 * origin. Text the model writes, even "User: yes", sits in an assistant entry and never counts.
 *
 * That message approves the hold only when all of these hold:
 * - it was written after the hold was made, so the person could have seen the diff;
 * - it is recent (rules.approval_window_minutes, 30 by default);
 * - it says nothing that refuses or changes the write ("no", "don't", "wait", "instead", "but",
 *   "change … to …");
 * - it approves: "approve", "confirm", "post it", "delete it", "go ahead and post", or a plain yes ("yes",
 *   "ok", "sure", "go ahead", "do it") answering the assistant's own question about this write,
 *   i.e. the assistant's text just before it names the hold, the record or the ledger.
 *
 * Codex and Gemini CLI transcripts are not a verified format for this check, so there a person
 * approves in a terminal (`booksguard approve <id>`).
 */
import { closeSync, existsSync, openSync, readSync, statSync } from "node:fs";
import { scanTranscript, type HumanTurn } from "@agentwares/agentguard-core";
import type { Hold } from "./holds.js";

const STEPS = [1 << 20, 8 << 20, 64 << 20];

export interface TurnEvidence {
  turn?: HumanTurn;
  missing?: string;
}

function readTail(file: string, bytes: number, size: number): string {
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

/** The latest message a person typed, from the end of the transcript (widening if needed). */
export function latestHumanTurn(file: string | undefined): TurnEvidence {
  if (!file) return { missing: "the hook's input carried no transcript_path" };
  if (!existsSync(file)) return { missing: `no transcript at ${file}` };
  let size: number;
  try {
    size = statSync(file).size;
  } catch (err) {
    return { missing: `the transcript could not be read (${(err as Error).message})` };
  }
  for (const step of STEPS) {
    let turn: HumanTurn | undefined;
    try {
      turn = scanTranscript(readTail(file, step, size)).turn;
    } catch (err) {
      return { missing: `the transcript could not be read (${(err as Error).message})` };
    }
    if (turn) return { turn };
    if (step >= size) break;
  }
  return { missing: "no message typed by a person in the transcript" };
}

const REFUSAL =
  /\b(no|nope|nah|don'?t|do not|never|stop|cancel|wait|hold (?:on|off)|reject(?:ed)?|decline[d]?|deny|denied|instead|wrong|not yet|but|except|rather|undo)\b|\bchange\b.*\bto\b/i;
const STRONG =
  /\b(approve[ds]?|approved|confirm(?:ed)?|(?:post|send|delete|void|update|change|record|create|import) (?:it|them|this|these|that|those|all|both)|go ahead and (?:post|create|send|save|record|delete|void|update)|ship it)\b/i;
const WEAK =
  /^\s*(y|yes|yep|yeah|yup|ok|okay|k|sure|go|go ahead|go for it|do it|please do|proceed|lgtm|sounds good|correct|right|yes please|please)\b/i;

export interface ApprovalVerdict {
  ok: boolean;
  reason: string;
  /** "message at 14:02 (“yes, post it”)" */
  by?: string;
  at?: string;
}

const hhmm = (iso: string): string => iso.slice(11, 16) || iso;

const quoteOf = (text: string): string => {
  const t = text.trim().replace(/\s+/g, " ");
  return `“${t.length > 60 ? `${t.slice(0, 59)}…` : t}”`;
};

/** Words that tie an assistant question to this hold. */
function holdWords(hold: Pick<Hold, "id" | "entity" | "ledger">): string[] {
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
    "ledger",
  ];
}

export function approvalFromTurn(
  evidence: TurnEvidence,
  hold: Pick<Hold, "id" | "entity" | "ledger" | "created_at">,
  now: number,
  windowMinutes: number,
): ApprovalVerdict {
  const turn = evidence.turn;
  if (!turn)
    return {
      ok: false,
      reason: evidence.missing ?? "no message typed by a person in the transcript",
    };
  const at = Date.parse(turn.at);
  if (!(at > Date.parse(hold.created_at)))
    return {
      ok: false,
      reason: `the person's latest message (${hhmm(turn.at)}) came before the hold (${hhmm(hold.created_at)}), so they have not answered it yet`,
    };
  const ageMin = (now - at) / 60_000;
  if (ageMin > windowMinutes)
    return {
      ok: false,
      reason: `the person's latest message is ${Math.round(ageMin)} minutes old; an approval counts for ${windowMinutes}`,
    };
  const text = turn.text.trim();
  const by = `message at ${hhmm(turn.at)} UTC (${quoteOf(text)})`;
  if (REFUSAL.test(text))
    return {
      ok: false,
      reason: `the person's latest message ${quoteOf(text)} does not approve it as it stands`,
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
        at: turn.at,
      };
    return {
      ok: false,
      reason: `the person's latest message ${quoteOf(text)} does not answer a question about this ${hold.entity}`,
    };
  }
  return {
    ok: false,
    reason: `the person's latest message ${quoteOf(text)} does not approve it`,
  };
}
