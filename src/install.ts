/**
 * How to run booksguard: the one constant behind every place the command is shown or printed
 * (`--help` and the hook's own messages, the README and its recorded run, the plugin, its skill and
 * hooks, and okgate's /books pages through their mirror).
 *
 * npm does not serve `booksguard` yet (the name was free on 9 Oct 2026), so it runs from the
 * public repo, whose committed dist/ needs no build (scripts/sync-oss-repos.sh). npm 12 refuses a
 * git spec unless `--allow-git` permits it; `root` permits only the spec named on the command line,
 * and npm 10 and 11 accept the flag, so the GitHub form carries it (brief REL-1). The day npm serves
 * the package, flip ON_NPM and rewrite the rest:
 *
 *   BOOKSGUARD_WRITE=1 pnpm --filter booksguard exec vitest run src/distribution
 *
 * src/distribution.test.ts fails while any surface names another form of the command.
 */
export const ON_NPM: boolean = false;

/**
 * Whether the public repo agentwares/booksguard is up, so that INSTALL and the plugin resolve.
 * Until it is, okgate's /books pages (which import a mirror of this file) show no `npx` line, no
 * plugin and no link to the repo, only the approval settings each client already has (Claude
 * Code's `ask` rules, the connector's tool permissions in Cowork and Claude, Codex's
 * `default_tools_approval_mode`, Gemini CLI's `trust`): a page never prints a command that 404s.
 * The README and the CLI live in that repo, so they name the command as they are.
 *
 * Flip it to true the day the sync has pushed the repo, then rewrite the mirror:
 *
 *   BOOKSGUARD_WRITE=1 pnpm --filter booksguard exec vitest run src/distribution
 */
export const PUBLISHED: boolean = false;

export const NAME = "booksguard";
export const REPO = `https://github.com/agentwares/${NAME}`;

/** What a person types. */
export const INSTALL = ON_NPM ? `npx ${NAME}` : `npx --allow-git=root github:agentwares/${NAME}`;

/** What an agent or a plugin hook runs unattended: no install prompt. */
export const RUN = ON_NPM
  ? `npx -y ${NAME}@latest`
  : `npx -y --allow-git=root github:agentwares/${NAME}`;

/** Where the pages live (okgate's site). */
export const SITE = "https://agentwares-agentguard.vercel.app";
export const PAGE = `${SITE}/books`;

/** The firm-wide record is not built; this page says so and counts the visit. */
export const FIRM_LOG = `${SITE}/books/firm-log?ref=booksguard`;
