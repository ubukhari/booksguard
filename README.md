# booksguard

**Nothing an AI writes to QuickBooks or Xero posts until a person says yes.**

```sh
npx --allow-git=root github:agentwares/booksguard install
```

booksguard is a pre-tool-use hook for Claude Code, Cowork, Codex and Gemini CLI. It holds every
create, update, delete, void, send or import that an agent makes to QuickBooks or Xero, through
their MCP servers or their REST APIs, until a person approves it:

- **A dry-run diff first.** The held call comes back to the agent with what it would create, change
  or delete, field by field. It shows line totals and, for a journal entry, debits against credits,
  flagged `OUT OF BALANCE` when they differ. A write identical to one released in the last 24 hours
  is flagged `DUPLICATE`.
- **Approval on the person's own turn.** In Claude Code and Cowork, the person's own next message
  ("yes, post it") releases the identical call once. booksguard reads it from the session transcript
  with okgate's rules for what a person wrote, so text the model writes never counts. Anywhere,
  `booksguard approve <id>` in a terminal does the same. The agent cannot approve its own holds.
- **A record per client.** Every hold, release (with who approved it and when) and refusal goes to
  `~/.booksguard/audit.jsonl`, okgate's hash-chained log. `booksguard log` prints the month per
  client, `--csv` exports it for the workpapers, and `booksguard verify` checks the chain.
- **Reads pass** with no output, so the agent's own permission prompts decide as usual.

No account, no signup, no LLM. It makes no network request and never calls QuickBooks or Xero.

## Recorded run

`booksguard demo` puts synthetic calls through the real hook in a temporary home. It reads and
writes nothing of yours. Tool names and argument shapes are the public ones; every company, amount
and message is invented.

<!-- recorded-run -->

```text
$ npx --allow-git=root github:agentwares/booksguard demo
booksguard demo: synthetic calls through the real hook, in a temporary home.
Nothing of yours is read or written. Tool names and argument shapes are the public ones.

$ npx --allow-git=root github:agentwares/booksguard install --client claude
added   Claude Code PreToolUse hook in ~/.claude/settings.json
        matcher ^mcp__|^(Bash|PowerShell|Write|Edit|MultiEdit|NotebookEdit)$

14:01  person  types: Bill Acme Landscaping for October: 10 hours of bookkeeping, invoice 1042.

14:02  agent   mcp__quickbooks__search_customers  (a read)
        hook    passes (no output: the harness decides as usual)

14:03  agent   mcp__quickbooks__create_invoice  (Intuit's server)
        hook    deny
                  + customer_ref: "58"
                  + doc_number: "1042"
                  + txn_date: "2026-10-09"
                  + customer_memo: "Thank you for your business."
                  + line 1: 1,250.00 · item_ref "12" · qty 10 · unit_price 125 · description "October bookkeeping, 10 hours"
                  + line 2: 0.00 · item_ref "19" · qty 1 · unit_price 0 · description "Receipt capture (included)"
                  = total 1,250.00 across 2 lines
        person  sees: booksguard held create invoice 1,250.00 · QuickBooks via "quickbooks" (Intuit's QuickBooks Online MCP server) (hold bg_106a5a26). Reply "yes, post it" to approve, or run: npx --allow-git=root github:agentwares/booksguard approve bg_106a5a26

14:04  agent   mcp__quickbooks__create_invoice  (the agent retries before anyone answered)
        hook    deny
                  + customer_ref: "58"
                  + doc_number: "1042"
                  + txn_date: "2026-10-09"
                  + customer_memo: "Thank you for your business."
                  + line 1: 1,250.00 · item_ref "12" · qty 10 · unit_price 125 · description "October bookkeeping, 10 hours"
                  + line 2: 0.00 · item_ref "19" · qty 1 · unit_price 0 · description "Receipt capture (included)"
                  = total 1,250.00 across 2 lines
        person  sees: booksguard held create invoice 1,250.00 · QuickBooks via "quickbooks" (Intuit's QuickBooks Online MCP server) (hold bg_106a5a26). Reply "yes, post it" to approve, or run: npx --allow-git=root github:agentwares/booksguard approve bg_106a5a26

14:04  agent   says: booksguard is holding invoice 1042 for Acme Landscaping, 1,250.00. Shall I post it?
14:05  person  types: yes, post it

14:06  agent   mcp__quickbooks__create_invoice  (same arguments)
        hook    allow (a note only)
        person  sees: booksguard released create invoice 1,250.00 · QuickBooks via "quickbooks" (Intuit's QuickBooks Online MCP server) (hold bg_106a5a26), approved by your message at 14:05 UTC (“yes, post it”).

14:07  agent   mcp__quickbooks__create_invoice  (a retry after a timeout: the official server has no idempotency, #100)
        hook    deny
                  + customer_ref: "58"
                  + doc_number: "1042"
                  + txn_date: "2026-10-09"
                  + customer_memo: "Thank you for your business."
                  + line 1: 1,250.00 · item_ref "12" · qty 10 · unit_price 125 · description "October bookkeeping, 10 hours"
                  + line 2: 0.00 · item_ref "19" · qty 1 · unit_price 0 · description "Receipt capture (included)"
                  = total 1,250.00 across 2 lines
        person  sees: booksguard held create invoice 1,250.00 · QuickBooks via "quickbooks" (Intuit's QuickBooks Online MCP server) (hold bg_0eb85624). DUPLICATE of a write released earlier. Reply "yes, post it" to approve, or run: npx --allow-git=root github:agentwares/booksguard approve bg_0eb85624

14:08  agent   mcp__3f0c2a9e-5b7d-4c11-9e2a-0d6f4b8a1c37__create_journal_entry  (Meridian, under a connector id the harness does not name)
        hook    deny
                  + TxnDate: "2026-09-30"
                  + PrivateNote: "Accrue September rent"
                  + line 1: debit 2,500.00 · AccountRef Rent (67)
                  + line 2: credit 2,250.00 · AccountRef Accrued liabilities (33)
                  = debits 2,500.00, credits 2,250.00: OUT OF BALANCE by 250.00
        person  sees: booksguard held create journal entry 2,500.00 OUT OF BALANCE · QuickBooks via connector 3f0c2a9e… · company 9130354821 (hold bg_dec9ff82). Reply "yes, post it" to approve, or run: npx --allow-git=root github:agentwares/booksguard approve bg_dec9ff82

14:09  agent   Bash  (Xero's REST API)
        hook    deny
                  + Type: "ACCPAY"
                  + Contact: c-204
                  + Status: "DRAFT"
                  + line 1: 1,899.00 · Description "Laptop" · Quantity 1 · UnitAmount 1899 · AccountCode "720"
                  = total 1,899.00 across 1 line
        person  sees: booksguard held create bill 1,899.00 · Xero API (api.xero.com) · company 7d1c2a40-1111-4b2b-9c3d-000000000001 (hold bg_66760bac). Reply "yes, post it" to approve, or run: npx --allow-git=root github:agentwares/booksguard approve bg_66760bac

14:10  agent   mcp__quickbooks__delete_invoice
        hook    deny
                  - delete invoice 1042
        person  sees: booksguard held delete invoice 1042 · QuickBooks via "quickbooks" (Intuit's QuickBooks Online MCP server) (hold bg_17a9ecc1). Reply "yes, delete it" to approve, or run: npx --allow-git=root github:agentwares/booksguard approve bg_17a9ecc1

14:10  agent   says: Should I also delete the old draft of invoice 1042?
14:11  person  types: no, don't delete anything

14:12  agent   mcp__quickbooks__delete_invoice  (the agent tries anyway)
        hook    deny
                  - delete invoice 1042
        person  sees: booksguard held delete invoice 1042 · QuickBooks via "quickbooks" (Intuit's QuickBooks Online MCP server) (hold bg_17a9ecc1). Reply "yes, delete it" to approve, or run: npx --allow-git=root github:agentwares/booksguard approve bg_17a9ecc1

14:13  agent   Bash  (the agent tries to approve its own hold)
        hook    deny
        person  sees: booksguard refused booksguard approve: an agent may not run `booksguard approve`: a person approves held writes and removes the hook

14:14  agent   mcp__stripe__create_invoice  (Stripe, not a ledger)
        hook    passes (no output: the harness decides as usual)

$ npx --allow-git=root github:agentwares/booksguard log
AI writes to the books, 2026-10, per client

folder acme-landscaping: 3 held, 1 released (1,250.00), 2 still waiting, 1 refused
  10-09 14:03  held       create invoice 1,250.00 · QuickBooks via "quickbooks" (Intuit's QuickBooks Online MCP server)
  10-09 14:06  released   create invoice 1,250.00 · QuickBooks via "quickbooks" (Intuit's QuickBooks Online MCP server) — message at 14:05 UTC (“yes, post it”)
  10-09 14:07  held       create invoice 1,250.00 · QuickBooks via "quickbooks" (Intuit's QuickBooks Online MCP server)
  10-09 14:10  held       delete invoice 1042 · QuickBooks via "quickbooks" (Intuit's QuickBooks Online MCP server)
  10-09 14:13  refused    booksguard approve

QuickBooks 9130354821: 1 held, 0 released, 1 still waiting, 0 refused
  10-09 14:08  held       create journal entry 2,500.00 OUT OF BALANCE · QuickBooks via connector 3f0c2a9e… · company 9130354821

Xero 7d1c2a40-1111-4b2b-9c3d-000000000001: 1 held, 0 released, 1 still waiting, 0 refused
  10-09 14:09  held       create bill 1,899.00 · Xero API (api.xero.com) · company 7d1c2a40-1111-4b2b-9c3d-000000000001

$ npx --allow-git=root github:agentwares/booksguard verify
ok: 9 entries, hash chain intact (head f6a022ceb2bd)
(exit 0)
```

<!-- /recorded-run -->

## What is held

The write tools of each server, read from its public source on 9 October 2026:

| Server                                                                                                                              | Write tools | Examples                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Intuit QuickBooks connector in Claude's directory (`ai-inc.quickbooks.intuit.com/v1/mcp`)                                           | 27 of 74    | `qbo_sales_create_invoice`, `qbo_sales_send_invoice`, `qbo_sales_delete_invoice`, `qbo_contact_create_customer`, `quickbooks-transaction-import` |
| [Intuit's open-source QuickBooks Online MCP server](https://github.com/intuit/quickbooks-online-mcp-server) (commit `31a1dd5c3e17`) | 71 of 142   | every `create_`, `update_` and `delete_` tool, e.g. `create_invoice`, `create_journal_entry`, `create-bill`, `delete_payment`                    |
| Meridian Connector for QuickBooks (`qbo-connector.meridian.pilot.com/mcp`)                                                          | 32 of 63    | `create_journal_entry`, `delete_transaction`, `delete_entity`, `void_invoice`, `batch_entity_operations`                                         |
| Xero connector in Claude's directory (`mcp.xero.com/mcp`)                                                                           | none        | read-only at launch ([Xero](https://www.xero.com/ai-in-accounting/claude/))                                                                      |
| [Xero's open-source MCP server](https://github.com/XeroAPI/xero-mcp-server) (commit `f24583c867df`)                                 | 24 of 50    | `create-invoice` (a bill is `type: ACCPAY`), `create-payment`, `create-manual-journal`, `update-contact`                                         |

Tool lists: [Intuit's connector](https://claude.com/connectors/intuit-quickbooks) and
[Meridian's](https://claude.com/connectors/meridian-connector-for-quickbooks) directory pages.

Also held:

- a tool on a server whose name says QuickBooks, Xero, Intuit, QBO or Meridian (or one you add to
  `ledger_servers` in `~/.booksguard/rules.json`) that is not catalogued and does not read;
- a catalogued write name on a connector that arrives under an opaque server id, as claude.ai
  connectors can. Generic names such as `create_invoice` on a server named for something else,
  Stripe say, pass;
- `curl`, `wget` and HTTPie calls to `quickbooks.api.intuit.com`, `sandbox-quickbooks.api.intuit.com`
  or `api.xero.com` that are not a GET (a QuickBooks POST to `/query` is a read). Any other command
  that names one of those hosts is held too, because booksguard cannot see what it sends;
- edits to the harnesses' hook settings files, which could remove the hook.

Refused outright: the agent running `booksguard approve` or `uninstall`, or writing into
`~/.booksguard`.

## Where it works

| Harness     | Hook                                                                                | How the person approves                                                                                      |
| ----------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Claude Code | `PreToolUse` in `~/.claude/settings.json` (or `$CLAUDE_CONFIG_DIR`)                 | their own next message, or `booksguard approve <id>` in a terminal                                           |
| Cowork      | the booksguard plugin's `hooks/hooks.json`                                          | their own next message                                                                                       |
| Codex       | `PreToolUse` in `~/.codex/hooks.json` (or `$CODEX_HOME`); trust it once in `/hooks` | `booksguard approve <id>` in a terminal                                                                      |
| Gemini CLI  | `BeforeTool` in `~/.gemini/settings.json`                                           | `booksguard approve <id>` in a terminal. Written to Gemini CLI's hook docs, not yet run on a live Gemini CLI |

Codex and Gemini CLI transcripts are not a format booksguard reads, so there a message does not
approve. Claude chat on the web, desktop and mobile ignores plugin hooks and is not covered.

Hook APIs read 9 October 2026: [Claude Code](https://code.claude.com/docs/en/hooks) (a `deny` still
applies in `bypassPermissions`), [plugins across Claude](https://claude.com/docs/plugins/platform-support)
(hooks load in Cowork and Claude Code, not chat), [Codex](https://learn.chatgpt.com/docs/hooks),
[Gemini CLI](https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md).

## Commands

```sh
npx --allow-git=root github:agentwares/booksguard install     # the hook where each harness is installed, and ~/.booksguard/rules.json
npx --allow-git=root github:agentwares/booksguard status      # where it is installed, the rulebook, ledger servers found, what is waiting
npx --allow-git=root github:agentwares/booksguard holds       # the writes waiting, with their diffs
npx --allow-git=root github:agentwares/booksguard approve <id>
npx --allow-git=root github:agentwares/booksguard deny <id>
npx --allow-git=root github:agentwares/booksguard log         # this month per client; --month 2026-10, --company, --csv, --json
npx --allow-git=root github:agentwares/booksguard verify      # check the log's hash chain
npx --allow-git=root github:agentwares/booksguard check mcp__quickbooks__create_invoice --args '{"params":{…}}'
npx --allow-git=root github:agentwares/booksguard mcp         # read-only MCP server: booksguard_check_write, booksguard_list_holds, booksguard_month_log
npx --allow-git=root github:agentwares/booksguard uninstall   # removes only booksguard's hook entries
```

`install` also notes the names of QuickBooks and Xero servers it finds in the harnesses' MCP
configs. It reads names only and never prints a value from those files. `--project` writes the
project's own settings instead of the user's. `--no-hooks` only records where booksguard is, for the
plugin's hook. `~/.booksguard/rules.json` sets `mode` (`hold`, or `watch` to log without holding),
the approval window (30 minutes), the duplicate window (24 hours), and `ledger_servers`,
`hold_tools` and `pass_tools`.

The MCP server's three tools only read, and each sets `readOnlyHint`, `destructiveHint: false`,
`idempotentHint` and `openWorldHint: false`. There is no approve tool, by design.

## What it does not do

- It cannot see inside a script the agent writes and then runs, unless the command line names a
  QuickBooks or Xero API host. A local hook is a seatbelt, not a vault: an agent with a shell that is
  set on getting around it can.
- An update shows the fields it would set, not the values they replace: reading those would mean
  calling the ledger.
- The log records what was held, released and refused, and who approved each. The ledger's answer
  to a released write is not recorded.
- It never moves money and never files anything.

okgate's kill switch (`OKGATE_KILL=1`, or a `KILL` file in `~/.okgate`) refuses every ledger write
while it is on.

## For a bookkeeping firm

The log stays on one machine. One firm-wide record of every client's AI changes, with a monthly
sign-off, is not built yet:
[say you want it](https://agentwares-agentguard.vercel.app/books/firm-log?ref=booksguard). The page
counts the visit and nothing else.

Pages: [agentwares-agentguard.vercel.app/books](https://agentwares-agentguard.vercel.app/books).
MIT licensed.
