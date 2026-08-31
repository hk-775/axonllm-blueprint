# Production readiness

AxonLLM Blueprint is a beta reference implementation, not a production service.

Before an internet-facing deployment:

- integrate a verified identity provider and trusted header-mapping boundary;
- replace process-local sessions and rate limits with tenant-aware shared state;
- define prompt, response, log, and audit retention;
- scope workload-role access to approved Bedrock resources;
- add distributed observability without prompt content by default;
- validate availability, recovery, cost, quotas, accessibility, and incident response;
- scan and sign the final container and deployment artifacts;
- require engineering, security, privacy, operations, and accountable-owner approval.

The AWS services diagram is a proposed mapping of these gaps. It does not prove
that infrastructure exists and the repository ships no AWS IaC.
