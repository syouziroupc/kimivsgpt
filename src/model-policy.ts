export const DEEP_MODEL = "@cf/deepseek-ai/deepseek-v4.1-flash-1017";
export const STANDARD_MODEL = "@cf/google/gemma-4-26b-a4b-it";
export const ECONOMY_MODELS = [STANDARD_MODEL, "@cf/mistralai/mistral-small-3.1-24b-instruct", "@cf/meta/llama-4-scout-17b-16e-instruct"] as const;
export const PANEL = [DEEP_MODEL, ...ECONOMY_MODELS] as const;
export const FRONTIER_RESERVE = "@cf/zai-org/glm-5.3";
export const ECONOMY_RESERVE = "@cf/qwen/qwen3.8-27b";
export const FRONTIER_MODELS = [DEEP_MODEL, FRONTIER_RESERVE] as const;
export const RESERVE_MODELS = [FRONTIER_RESERVE, ECONOMY_RESERVE] as const;
const RETIRED = new Set([
  "@cf/zai-org/glm-5.3-flash", "@cf/zai-org/glm-5.2",
  "@cf/moonshotai/kimi-k2.5", "@cf/moonshotai/kimi-k2.6", "@cf/moonshotai/kimi-k2.7-code",
  "@cf/deepseek-ai/deepseek-v4-pro-0813", "@cf/deepseek-ai/deepseek-v4-flash-0731",
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", "@cf/nvidia/nemotron-3-120b-a12b",
  "@cf/qwen/qwq-32b", "@cf/qwen/qwen3-30b-a3b-fp8",
  "@cf/meta-llama/llama-2-7b-chat-hf-lora", "@cf/google/gemma-2b-it-lora",
  "@cf/google/gemma-7b-it-lora", "@cf/meta-llama/llama-3.1-8b-instruct-fp8",
  "@cf/meta-llama/llama-3.2-1b-instruct", "@cf/meta-llama/llama-3.2-3b-instruct",
]);
// Fixed heterogeneous panel; stale environment overrides cannot change membership.
export function candidateModels(_env: unknown, level: "standard" | "deep"): string[] {
  return level === "deep" ? PANEL.filter(m => !RETIRED.has(m)) : [...ECONOMY_MODELS, DEEP_MODEL].filter(m => !RETIRED.has(m));
}
export function modelInput(model: string, prompt: string, packet: string, level: "standard" | "deep", schema?: unknown): Record<string, unknown> {
  const messages = [{role: "system", content: prompt}, {role: "user", content: packet}];
  // Deep review keeps a frontier reviewer but bounds reasoning in the synchronous MCP path.
  if (model === DEEP_MODEL || model === FRONTIER_RESERVE || model === ECONOMY_RESERVE) {
    return {messages, stream:false, temperature:0.1, max_completion_tokens:level === "deep" ? 1800 : 1400, reasoning_effort:"low", response_format:{type:"json_object"}};
  }
  if (model === STANDARD_MODEL) return {messages, stream:false, temperature:0.1, max_completion_tokens:850, chat_template_kwargs:{enable_thinking:false}, response_format:{type:"json_object"}};
  return {messages, stream:false, temperature:0.1, max_tokens:850, ...(schema ? {guided_json:schema} : {})};
}
