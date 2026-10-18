import fs from "node:fs";
import assert from "node:assert/strict";

const src = fs.readFileSync("src/index-resilient.ts", "utf8");
const entry = fs.readFileSync("src/index-reliable.ts", "utf8");
const config = fs.readFileSync("wrangler.jsonc", "utf8");
const skill = fs.readFileSync("plugin/skills/answer-auditor/SKILL.md", "utf8");

assert.match(src, /async function runReviewEnsemble\(/);
assert.match(src, /const outcomes = await Promise\.allSettled\(/);
assert.match(src, /status: "unavailable"/);
assert.match(src, /perspectives: z\.array\(/);
assert.match(src, /return runReviewEnsemble\(env, packet\);/);
assert.match(src, /AUDITOR_MODE === "legacy"/);
assert.match(src, /auditor_ensemble_all_models_failed/);
assert.match(src, /Math\.max\(failed > 0 \? 2 : 0,/);
assert.match(src, /"@cf\/qwen\/qwen3-30b-a3b-fp8"/);
assert.match(src, /"@cf\/zai-org\/glm-4\.7-flash"/);
assert.match(src, /"@cf\/google\/gemma-4-26b-a4b-it"/);
assert.match(src, /"@cf\/openai\/gpt-oss-20b"/);
assert.match(src, /maxOutputTokens: 320/);
assert.match(skill, /optional `perspectives`/);
assert.match(entry, /MODEL_CALL_TIMEOUT_MS = 12000/);
assert.match(config, /"main": "src\/index-reliable\.ts"/);

console.log("ensemble contract checks passed");
