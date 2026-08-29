# Security policy

## Supported versions

Security fixes are applied to the latest beta or stable release on the default branch.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability.

Use the repository's **Security** tab and select **Report a vulnerability** to create a private security advisory. Include:

- affected version or commit
- reproduction steps
- expected and observed impact
- suggested mitigation, if known

Avoid including live credentials, customer data, or secret values. Replace them with clearly marked test values.

## Security model

Blueprint relies on the standard AWS credential provider chain and never needs plaintext AWS keys in source code. The browser receives only model IDs from a server-managed allowlist.

The production runtime refuses to start until the operator selects trusted-proxy mode or explicitly acknowledges unauthenticated operation. Trusted-proxy mode requires a verified identity header, binds sessions to a hash of that identity, and applies a bounded per-principal model-call limit.

The beta remains a reference implementation. Internet-facing deployments need a correctly configured identity-aware proxy, durable tenant-aware storage, distributed rate limiting, audit logging, network controls, and deployment-specific monitoring. Review [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) for the current trust boundaries.
