# Privacy Policy — Kimi vs GPT Answer Auditor

Last updated: 2026-09-08

Kimi vs GPT Answer Auditor provides a compact second-opinion review for complex AI-generated answer directions.

## Data processed

The service is designed to receive only a compressed review packet containing the user's task summary, proposed direction, selected claims, assumptions, evidence summaries, constraints, and uncertainties. The plugin instructions explicitly prohibit sending hidden chain-of-thought, credentials, secrets, full transcripts, large file contents, full codebases, or unnecessary personal data.

## Purpose of processing

The review packet is processed only to generate a short critique identifying material issues such as unsupported assumptions, anchoring, missing alternatives, stale facts, constraint violations, or overconfidence.

## AI processing and infrastructure

The MCP service is hosted on Cloudflare Workers and uses Cloudflare Workers AI models. Standard reviews use GLM-5.3 Flash by default; a higher-cost Kimi K2.6 review may be selected only for unusually high-stakes or disputed cases.

The application does not intentionally persist review packets in an application database. Cloudflare infrastructure and observability features may process operational logs or telemetry according to the applicable Cloudflare service configuration and policies.

## Data minimization

The plugin and server enforce input size limits and instruct the calling model to send only information needed for critique. Users and calling models should not send secrets, authentication credentials, unnecessary personal information, or hidden reasoning.

## Third parties

Processing relies on Cloudflare infrastructure and Cloudflare Workers AI. No separate external model API is required by the default deployment.

## Contact and support

Support and privacy questions can be submitted through the project repository:
https://github.com/syouziroupc/kimivsgpt/issues
