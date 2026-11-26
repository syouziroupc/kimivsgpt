# Model and cost policy

- Primary panel: DeepSeek V4.1 Flash, Gemma 4, Mistral Small 3.1, Llama 4 Scout. Independent reserves: GLM-5.3 (frontier) and Qwen3.8 27B (economy).
- Four independent validated votes required: >=1 frontier and >=3 economy. Reserves start immediately on failure or after 5.5 seconds if their tier is short; at most six inference calls. Return at quorum without waiting for redundant slow calls, or return explicit partial coverage at the deadline. No model is retried; late completions cannot mutate a returned result. In-flight provider calls may still incur charges.
- Absolute request budget: 24.5s inference, 28s MCP; per-model cap 23s. Compact output, low reasoning on frontier models for both tiers, strict validation; no synthetic votes or averaging self-reported confidence.
- The schema-valid packet is retained in full; every obtained vote is available in model_reviews. Coverage failure never passes. Dissent among collected votes remains visible.
