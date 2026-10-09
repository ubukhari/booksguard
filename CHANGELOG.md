# Changelog

## 0.1.0 (2026-10-09)

Nothing an AI writes to QuickBooks or Xero posts until a person says yes.

- A pre-tool-use hook for Claude Code (`PreToolUse`), Codex (`PreToolUse`) and Gemini CLI
  (`BeforeTool`), written by `booksguard install`. For Claude Code and Cowork there is also a
  plugin whose `hooks/hooks.json` carries the same hook.
- Holds every write tool of Intuit's QuickBooks connector (27), Intuit's open-source QuickBooks
  Online MCP server (71), Meridian's QuickBooks connector (32) and Xero's open-source MCP server
  (24), read from their public sources on 9 October 2026. Also holds uncatalogued non-read tools on
  servers named for a ledger, catalogued write names on connectors with opaque server ids, REST
  calls to the QuickBooks and Xero APIs that are not a GET, and edits to the hook settings. Reads
  pass.
- A dry-run diff on every hold: fields, line totals, journal debits against credits with
  `OUT OF BALANCE`, the company named, and `DUPLICATE` for a write identical to one released in the
  last 24 hours.
- Released once, for the identical retry: by the person's own message after the hold (Claude Code,
  Cowork; read with okgate's transcript rules), or `booksguard approve <id>` in a terminal. The agent
  may not approve its own holds or write booksguard's home.
- okgate's hash-chained log in `~/.booksguard/audit.jsonl`; `log` (per client, `--csv`, `--json`),
  `verify`, `holds`, `status`, `check`, `deny`, `uninstall`, `demo`.
- `booksguard mcp`: three read-only tools, every one with all four annotations.
- No account, no network request, no LLM. It never calls QuickBooks or Xero.
