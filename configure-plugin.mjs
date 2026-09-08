import fs from "node:fs";

const base = process.argv[2];
if (!base) {
  console.error("Usage: node configure-plugin.mjs https://<worker>.workers.dev/mcp");
  process.exit(1);
}

const file = "plugin/skills/answer-auditor/agents/openai.yaml";
let text = fs.readFileSync(file, "utf8");
text = text.replace(/https:\/\/[^\s\"]+\/mcp/, base.replace(/\/$/, ""));
fs.writeFileSync(file, text);
console.log(`Configured ${file} -> ${base}`);
