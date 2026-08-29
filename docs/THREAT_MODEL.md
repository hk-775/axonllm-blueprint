# Threat model

## Scope

This model covers the browser workspace, Express API, in-memory session manager, AWS credential chain, and Amazon Bedrock invocation path.

## Assets

- AWS credentials and role sessions
- Bedrock invocation permissions and quotas
- user-provided infrastructure code and logs
- generated architecture and IaC output
- conversation history held in process memory

## Primary threats and controls

| Threat | Current control |
| --- | --- |
| Browser submits an arbitrary model ARN or ID | Server-side allowlist |
| Oversized requests exhaust memory or token budget | JSON, message, history, and output-token limits |
| Repeated requests create unbounded Bedrock cost | Bounded per-principal in-process rate limiter |
| Repeated SPA fallback reads consume filesystem capacity | Per-IP in-process rate limiter before the static shell fallback |
| One principal reuses another principal's session ID | Trusted-proxy identity hashing and owner-bound sessions |
| Production is started without an access-control decision | Startup requires trusted-proxy mode or explicit unauthenticated acknowledgement |
| Prompt injection in pasted configuration | User content remains in the user role and is labelled untrusted by the system policy |
| AWS credentials leak to the browser or repository | Standard credential chain; no credential API or secret retrieval feature |
| Bedrock throttling causes uncontrolled retries | AWS SDK adaptive retries with a fixed maximum |
| Raw provider errors expose implementation details | Stable translated API errors and request IDs |
| Model output is treated as deployed or validated | Advisory language, human review gate, and explicit native validation step |
| Session storage grows without bound | Session count, history length, and inactivity expiry |

## Known beta gaps

- identity authentication remains the responsibility of the trusted proxy
- explicit unauthenticated mode is single-tenant and intended only for controlled demos
- the rate limiters are process-local rather than distributed
- no durable or encrypted application session store
- no application audit trail
- no malware or sensitive-data inspection for pasted content
- no automated Bedrock Guardrail attachment

Do not expose explicit unauthenticated mode to the public internet. A production proxy must strip spoofed identity headers before injecting the authenticated identity expected by Blueprint.

## Production recommendations

1. Put the API behind an authenticated gateway or trusted identity-aware proxy.
2. Strip client-supplied identity headers and inject a verified principal.
3. Replace process-local sessions and rate limits with shared tenant-aware services when scaling horizontally.
4. Use workload roles with the narrowest model resource permissions possible.
5. Add structured audit events without logging prompts or secret-bearing content by default.
6. Add approved data classification and retention rules.
7. Add observability for latency, token usage, throttling, and denied requests.
8. Re-run threat modelling whenever retrieval, deployment, tools, or agents are added.
