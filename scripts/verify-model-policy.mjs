import assert from "node:assert/strict";
import { candidateModels, modelInput, STANDARD_MODEL, DEEP_MODEL } from "../src/model-policy.ts";
const old = {AUDITOR_MODEL_STANDARD:"@cf/zai-org/glm-5.3-flash", AUDITOR_MODEL_DEEP:"@cf/moonshotai/kimi-k2.6"};
assert.equal(candidateModels(old,"standard")[0], STANDARD_MODEL);
assert.equal(candidateModels(old,"deep")[0], DEEP_MODEL);
for (const level of ["standard","deep"]) {
  const models = candidateModels(old,level);
  assert.equal(models.length,4);
  assert.equal(new Set(models).size,4);
  assert.ok(models.every(m => !m.includes("kimi-") && !m.includes("glm-5.3-flash")));
}
assert.equal(modelInput(DEEP_MODEL,"a","b","deep").reasoning_effort,"none");
assert.equal(modelInput(STANDARD_MODEL,"a","b","standard").reasoning_effort,"low");
assert.equal(modelInput(STANDARD_MODEL,"a","b","standard").response_format.type,"json_object");
console.log("model policy checks passed");
