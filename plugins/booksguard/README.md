# booksguard

Nothing an AI writes to QuickBooks or Xero posts until you say yes.

This plugin adds a `PreToolUse` hook to Claude Code and Cowork. It holds every create, update,
delete, void or send through the QuickBooks and Xero MCP servers (Intuit's connector and
open-source server, Meridian's connector, Xero's open-source server) and through `curl` calls to
their APIs. Claude shows you the change, with its totals and whether a journal entry balances, and
asks. Your yes, in your own next message, lets the identical call through once. Reads pass. Every
hold, release and refusal is written to a hash-chained log on your machine, per client.

The hook runs on your computer and needs Node 20 or later. For a fast hook with no download on each
call, run this once in a terminal (it records where booksguard is, without adding a second hook):

```sh
npx --allow-git=root github:agentwares/booksguard install --no-hooks
```

Otherwise the hook runs `npx -y --allow-git=root github:agentwares/booksguard` on each call it
checks. The skill `/booksguard:booksguard` shows what is waiting and what was written; it
pre-approves nothing. Not covered: Claude chat on the web, desktop or mobile, which ignores plugin
hooks, and a script the agent writes and runs that does not name the QuickBooks or Xero API host.
