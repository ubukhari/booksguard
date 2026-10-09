/** booksguard as a library: the catalogue, the classifier, the diff and the hook, for embedding. */
export {
  CATALOG_SUMMARY,
  FAMILIES,
  GENERIC_WRITES,
  judgeTool,
  verbAndEntity,
  type FamilyId,
  type Ledger,
  type Op,
  type ServerFamily,
  type ToolVerdict,
} from "./catalog.js";
export {
  classify,
  companyOf,
  httpCallOf,
  judgeRest,
  splitMcpName,
  type Classification,
  type Client,
  type HookInput,
  type LedgerWrite,
} from "./classify.js";
export { moneyOf, renderDiff, type Diff, type Money } from "./diff.js";
export { approvalFromTurn, latestHumanTurn, type ApprovalVerdict } from "./approval.js";
export { decideHold, runHook, type Ctx, type HookAnswer } from "./hook.js";
export { HoldStore, type Hold } from "./holds.js";
export { readLog, summarize, toCsv, verifyLog } from "./audit.js";
export { DEFAULT_RULES, readRules, type Rules } from "./rules.js";
export { INSTALL, RUN, REPO, NAME } from "./install.js";
export { main } from "./main.js";
