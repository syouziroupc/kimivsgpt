import fs from "node:fs";

const config = fs.readFileSync("wrangler.jsonc", "utf8");
const reliable = fs.readFileSync("src/index-reliable.ts", "utf8");
const resilient = fs.readFileSync("src/index-resilient.ts", "utf8");

const assertions = [
  [config.includes('"main": "src/index-reliable.ts"'), "reliable entrypoint must be active"],
  [!config.includes('"AUDIT_RATE_LIMITER"'), "standard review rate limiter must not be configured"],
  [!config.includes('"DEEP_RATE_LIMITER"'), "deep review rate limiter must not be configured"],
  [config.includes('"AUTH_RATE_LIMITER"'), "authentication rate limiter must remain configured"],
  [reliable.includes("AUDIT_RATE_LIMITER = undefined"), "standard limiter must be neutralized defensively"],
  [reliable.includes("DEEP_RATE_LIMITER = undefined"), "deep limiter must be neutralized defensively"],
  [reliable.includes("MODEL_CALL_TIMEOUT_MS = 23000"), "model timeout bounded"],
  [reliable.includes("AUDITOR_DEADLINE_AT = startedAt + INFERENCE_BUDGET_MS"), "absolute deadline propagated"],
  [resilient.includes("resultSchema.safeParse(value)"), "incomplete results must fail closed"],
  [resilient.includes("await runPanel("), "resilient scheduler must be active"],
  [reliable.includes("INFERENCE_BUDGET_MS"), "review inference needs a bounded total budget"],
  [reliable.includes("rpcFailureResponse"), "MCP failures need a protocol response fallback"],
  [reliable.includes("hedged_failover: true"), "hedged failover must be enabled"],
];

for (const [ok, message] of assertions) {
  if (!ok) throw new Error(`reliability contract failed: ${message}`);
}

console.log("reliability contract OK");
