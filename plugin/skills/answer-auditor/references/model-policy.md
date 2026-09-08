# Model and cost policy

- Standard review: `@cf/zai-org/glm-5.3-flash`.
- Deep review: `@cf/moonshotai/kimi-k2.6`.
- Deep review falls back to the standard model if the deep model fails.
- The reviewer output is capped at 500 completion tokens and is instructed to return at most four short issues.
- The reviewer never writes code or a replacement answer.
- The primary model should keep the review packet compact; long transcripts or source dumps are prohibited.
