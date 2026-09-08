# Model and cost policy

- Standard review: `@cf/zai-org/glm-5.3-flash`.
- Deep review: `@cf/moonshotai/kimi-k2.6`.
- Deep review falls back to the standard model only if the deep model fails.
- The reviewer output is capped at 420 completion tokens and at most three short issues.
- The serialized review packet is rejected above 5,000 characters.
- The reviewer never writes code or a replacement answer and never performs the underlying research.
- Standard review uses terse plain JSON validated in the Worker rather than requiring JSON Mode.
- One external review call per substantive answer is the default.
