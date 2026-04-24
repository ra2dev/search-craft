import data from "emojibase-data/en/data.json" with { type: "json" };
import fs from "fs";
const result = data.map((e) => {
  const emoji = String.fromCodePoint(
    ...e.hexcode.split("-").map((h) => parseInt(h, 16))
  );

  const name = e.annotation;
  const keywords = e.tags || [];
  const category = e.group;
  const unicode = "U+" + e.hexcode;

  return {
    content: [
      emoji,
      name,
      ...keywords
    ].join(" "),

    metadata: {
      emoji,
      name,
      category,
      unicode
    }
  };
});


fs.writeFileSync("emojis-full-data.json", JSON.stringify(result, null, 2));