import { existsSync } from "node:fs";

const requiredPaths = [
  "README.md",
  "wrangler.jsonc",
  "src/index.ts",
  "src/models/types.ts",
  "src/adapters/types.ts",
  "src/services/telegram.ts",
  "src/services/sync.ts",
  "src/services/dedupe.ts",
  "src/storage/schema.sql",
  "docs/setup-mailboxes.md",
  "docs/setup-telegram.md",
  "docs/deploy-cloudflare.md",
];

const missing = requiredPaths.filter((relativePath) => !existsSync(relativePath));

if (missing.length > 0) {
  console.error("missing required project files:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("self-check ok");
