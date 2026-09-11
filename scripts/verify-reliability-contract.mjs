import fs from "node:fs";

const config = fs.readFileSync("wrangler.jsonc", "utf8");
const reliable = fs.readFileSync("src/index-reliable.ts", "utf8");

const assertions = [
  [config.includes('"main": "src/index-reliable.ts"'), "reliable entrypoint must be active"],
  [!config.includes('"AUDIT_RATE_LIMITER"'), "standard review rate limiter must not be configured"],
  [!config.includes('"DEEP_RATE_LIMITER"'), "deep review rate limiter must not be configured"],
  [config.includes('"AUTH_RATE_LIMITER"'), "authentication rate limiter must remain configured"],
  [reliable.includes("AUDIT_RATE_LIMITER = undefined"), "standard limiter must be neutralized defensively"],
  [reliable.includes("DEEP_RATE_LIMITER = undefined"), "deep limiter must be neutralized defensively"],
  [reliable.includes("MODEL_CALL_TIMEOUT_MS"), "model calls need a hard timeout"],
  [reliable.includes("INFERENCE_BUDGET_MS"), "review inference needs a bounded total budget"],
  [reliable.includes("rpcFailureResponse"), "MCP failures need a protocol response fallback"],
  [reliable.includes("skip_retry_after_timeout"), "timed-out models must not consume a second full timeout"],
];

for (const [ok, message] of assertions) {
  if (!ok) throw new Error(`reliability contract failed: ${message}`);
}

console.log("reliability contract OK");
