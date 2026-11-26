export const STANDARD_MODEL = "@cf/qwen/qwen3.8-27b";
export const DEEP_MODEL = "@cf/deepseek-ai/deepseek-v4.1-flash-1017";
export const FALLBACK_MODELS = ["@cf/zai-org/glm-5.3", "@cf/google/gemma-4-26b-a4b-it"] as const;
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
export function candidateModels(env: {AUDITOR_MODEL_STANDARD?: string; AUDITOR_MODEL_DEEP?: string}, level: "standard" | "deep"): string[] {
  const override = (level === "deep" ? env.AUDITOR_MODEL_DEEP : env.AUDITOR_MODEL_STANDARD)?.trim();
  const defaults = level === "deep"
    ? [DEEP_MODEL, FALLBACK_MODELS[0], STANDARD_MODEL, FALLBACK_MODELS[1]]
    : [STANDARD_MODEL, FALLBACK_MODELS[1], DEEP_MODEL, FALLBACK_MODELS[0]];
  return [...new Set([override, ...defaults].filter((m): m is string => Boolean(m) && !RETIRED.has(m!)))];
}
export function modelInput(model: string, prompt: string, packet: string, level: "standard" | "deep"): Record<string, unknown> {
  const input: Record<string, unknown> = {
    messages: [{role: "system", content: prompt}, {role: "user", content: packet}],
    stream: false, temperature: 0, max_completion_tokens: level === "deep" ? 1200 : 900,
    response_format: {type: "json_object"},
  };
  if (model === DEEP_MODEL) input.reasoning_effort = "none";
  else if (model === STANDARD_MODEL || model === FALLBACK_MODELS[0]) input.reasoning_effort = "low";
  return input;
}
