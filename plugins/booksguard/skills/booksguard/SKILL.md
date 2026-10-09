---
name: booksguard
description: How to work when booksguard holds a QuickBooks or Xero write - present the held change (its diff, totals and journal balance) to the person, ask whether to post it, wait for their answer in their own message, then retry the identical call once; and how to show what is waiting or what AI wrote this month. Use when a tool call is refused with APPROVAL_REQUIRED from booksguard, when the user asks what booksguard held, what AI changed in their books, or how to approve a held write.
argument-hint: "[holds | log | status]"
---

# Writes to QuickBooks and Xero wait for the person

booksguard (MIT, [source](https://github.com/agentwares/booksguard)) is a hook on this machine. It
holds every create, update, delete, void or send that you make to QuickBooks or Xero, through their
MCP servers or a `curl` to their APIs, until the person approves it. Reads pass. It never calls
QuickBooks or Xero itself and sends nothing anywhere.

When a call comes back refused with `APPROVAL_REQUIRED` and a hold id:

1. **Show the person the change.** The refusal's `details.diff` lists what the write would create,
   change or delete, the total, and for a journal entry whether debits equal credits. Say plainly
   if it is flagged `DUPLICATE` (an identical write was already posted) or `OUT OF BALANCE`.
2. **Ask whether to post it, and stop.** Do not retry until the person answers in their own
   message. Your own text never counts as their answer.
3. **If they say yes,** call the same tool again with exactly the same arguments. It runs once.
4. **If they want a change,** make the call with the changed arguments; booksguard holds it again
   with a new diff, and you ask again.
5. **If they say no,** do not try another route to the books: not another tool, not a script, not
   the API. Never run `booksguard approve` yourself; the hook refuses it, and approving is the
   person's decision.

In Codex and Gemini CLI, the person approves in their own terminal with
`npx --allow-git=root github:agentwares/booksguard approve <id>`; tell them the id and wait.

To show what is waiting or what was written, run one of these with the Bash tool (Claude Code asks
the person first; this skill pre-approves nothing):

```sh
npx -y --allow-git=root github:agentwares/booksguard $ARGUMENTS
```

- `holds`: the writes waiting, with their diffs;
- `log`: this month's AI writes per client, who approved each, and what was refused;
- `status`: where the hook is installed.
