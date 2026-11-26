# Model and cost policy

- Standard: `@cf/qwen/qwen3.8-27b`.
- Deep: `@cf/deepseek-ai/deepseek-v4.1-flash-1017`.
- Bounded failover: GLM-5.3, Gemma 4, and the other review tier. Each candidate is tried once; shared budget 24.5 seconds.
- Output must pass schema validation; an explicit evidence-gap fallback is not an independent audit.
- Completion caps: 900 standard / 1200 deep; review packet limit 5,000 characters.
- The reviewer never writes code or replacement answers or performs the underlying research.
