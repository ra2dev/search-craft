/**
 * Maps samples/emojis_queries.json (written for emojis.json) to
 * expected_contents that exist in emojis-full-data.json.
 *
 * Run from repo root: node samples/generate_full_data_queries.mjs
 */
import emojis from "./emojis.json" with { type: "json" };
import full from "./emojis-full-data.json" with { type: "json" };
import queries from "./emojis_queries.json" with { type: "json" };
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const smallByContent = new Map(emojis.map((e) => [e.content, e]));

function normalizeEmoji(emoji) {
  return emoji.replace(/\uFE0F/g, "");
}

function findFullContent(smallContent) {
  const small = smallByContent.get(smallContent);
  if (!small) {
    throw new Error(`Unknown small-sample content: ${JSON.stringify(smallContent)}`);
  }
  const target = small.metadata.emoji;
  const targetNorm = normalizeEmoji(target);

  const matches = full.filter((d) => {
    const e = d.metadata?.emoji;
    if (!e) return false;
    return e === target || normalizeEmoji(e) === targetNorm;
  });

  if (matches.length === 0) {
    throw new Error(
      `No full-data document for emoji ${JSON.stringify(target)} (${smallContent})`
    );
  }
  if (matches.length > 1) {
    const preferred = matches.find((d) => d.metadata?.emoji === target);
    if (preferred) return preferred.content;
    const byNorm = matches.find((d) => normalizeEmoji(d.metadata.emoji) === targetNorm);
    if (byNorm) return byNorm.content;
  }
  return matches[0].content;
}

const resolved = queries.map((q) => ({
  query: q.query,
  expected_contents: q.expected_contents.map(findFullContent),
  ...(q.max_rank !== undefined ? { max_rank: q.max_rank } : {}),
}));

const outPath = path.join(__dirname, "emojis-full-data_queries.json");
fs.writeFileSync(outPath, JSON.stringify(resolved, null, 2) + "\n");
console.log(`Wrote ${resolved.length} queries to ${outPath}`);
