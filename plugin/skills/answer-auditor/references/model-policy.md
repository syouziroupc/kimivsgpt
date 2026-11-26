# Model and cost policy

- Four parallel independent reviews: DeepSeek V4.1 Flash (frontier); Gemma 4 26B, Mistral Small 3.1 24B, Llama 4 Scout (economy).
- Each result is strictly schema-validated and returned in model_reviews. Missing or conflicting votes prevent proceed. One material revise vote is retained; max risk is preserved. Confidence is an uncalibrated bounded agreement indicator.
- Shared 24.5s inference budget; frontier up to 22s, economy up to 12s; no retries per model.
- Four upstream inference calls per review; cost depends on actual tokens.
