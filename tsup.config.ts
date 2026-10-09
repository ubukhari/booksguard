import { defineConfig } from "tsup";

/**
 * One runtime dependency, served by npm: `@agentwares/agentguard-core` (okgate's engine) for the
 * shell reader, the transcript's human-turn rules, the kill switch and the hash-chained audit log.
 * tsup leaves dependencies out of the bundle. Nothing on the paths booksguard calls opens a network
 * connection.
 *
 * `removeNodeProtocol: false` keeps `node:` on built-in imports.
 */
export default defineConfig({
  entry: { cli: "src/cli.ts", index: "src/index.ts" },
  format: ["esm"],
  platform: "node",
  target: "node20",
  removeNodeProtocol: false,
  dts: { entry: { index: "src/index.ts" } },
  sourcemap: true,
  clean: true,
  splitting: false,
});
