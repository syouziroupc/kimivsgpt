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
assert.match(src, /"@cf\/moonshotai\/kimi-k2\.6"/);
assert.match(src, /"@cf\/zai-org\/glm-5\.3"/);
assert.match(src, /"@cf\/openai\/gpt-oss-120b"/);
assert.match(src, /members\.length !== expectedMembers/);
assert.match(src, /auditor_invalid_critic_configuration/);
assert.match(src, /"@cf\/deepseek-ai\/deepseek-v4-pro-0813"/);
assert.match(src, /"@cf\/nvidia\/nemotron-3-120b-a12b"/);
assert.match(src, /maxOutputTokens: 200/);
assert.match(src, /auditor_compact_packet_over_budget/);
assert.match(src, /compactReviewPacket\(packet\)/);
assert.match(src, /parseCompactAudit\(raw, role\)/);
assert.match(skill, /optional `perspectives`/);
assert.match(entry, /MODEL_CALL_TIMEOUT_MS = 12000/);
assert.match(config, /"main": "src\/index-reliable\.ts"/);

console.log("ensemble contract checks passed");
