import assert from "node:assert/strict";
import { candidateModels, modelInput, STANDARD_MODEL, DEEP_MODEL, PANEL, FRONTIER_MODELS, RESERVE_MODELS } from "../src/model-policy.ts";
import { aggregatePanel } from "../src/panel.ts";
const old = {AUDITOR_MODEL_STANDARD:"@cf/zai-org/glm-5.3-flash", AUDITOR_MODEL_DEEP:"@cf/moonshotai/kimi-k2.6"};
assert.equal(candidateModels(old,"standard")[0],STANDARD_MODEL);
assert.equal(candidateModels(old,"deep")[0],DEEP_MODEL);
assert.equal(new Set(PANEL).size,4);
assert.equal(new Set(PANEL.map(m=>m.split("/")[1])).size,4);
assert.equal(modelInput(DEEP_MODEL,"a","b","deep").reasoning_effort,"low");
for (const level of ["standard","deep"]) {
  const gemma = modelInput(STANDARD_MODEL,"a","b",level);
  assert.equal(gemma.chat_template_kwargs.enable_thinking,false);
  assert.equal(gemma.max_completion_tokens,850);
  assert.equal(gemma.response_format.type,"json_object");
}
const audit={verdict:"proceed",risk:0,issues:[],verify:[],next_step:"none",confidence:1};
const full=PANEL.map(model=>({model,status:"ok",audit}));
assert.equal(aggregatePanel(full,FRONTIER_MODELS).verdict,"proceed");
assert.equal(aggregatePanel(full,FRONTIER_MODELS).confidence,0.6);
const partial=[...full.slice(0,3),{model:PANEL[3],status:"failed",error:"5028"}];
assert.equal(aggregatePanel(partial,FRONTIER_MODELS).verdict,"verify");
assert.equal(aggregatePanel(partial,FRONTIER_MODELS).confidence,0.1);
const dissent=[...full.slice(0,3),{model:PANEL[3],status:"ok",audit:{...audit,verdict:"revise",risk:3}}];
assert.equal(aggregatePanel(dissent,FRONTIER_MODELS).verdict,"revise");
assert.equal(aggregatePanel(dissent,FRONTIER_MODELS).risk,3);
assert.equal(aggregatePanel(dissent,FRONTIER_MODELS).confidence,0.25);
assert.equal(aggregatePanel(dissent,FRONTIER_MODELS).model_reviews.length,4);
assert.equal(aggregatePanel(full.map(r=>({model:r.model,status:"failed",error:"timeout"})),FRONTIER_MODELS).verdict,"verify");
console.log("panel checks passed");

assert.equal(new Set([...PANEL,...RESERVE_MODELS].map(m=>m.split("/")[1])).size,6);
const replaced=[...full.slice(1),{model:RESERVE_MODELS[0],status:"ok",audit},{model:PANEL[0],status:"failed",error:"timeout"}];
assert.equal(aggregatePanel(replaced,FRONTIER_MODELS).coverage.complete,true);
assert.equal(aggregatePanel(replaced,FRONTIER_MODELS).verdict,"proceed");
assert.equal(aggregatePanel([...full.slice(1),{model:RESERVE_MODELS[1],status:"ok",audit}],FRONTIER_MODELS).verdict,"verify");
