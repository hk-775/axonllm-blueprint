# Publication artifacts

| Artifact | Canonical source | Published behavior |
| --- | --- | --- |
| Product site | `frontend/src/PublicSite.tsx` | Overview, workbench, architecture |
| Synthetic workbench | Canonical React components plus `publicDemo.ts` | Browser-local, deterministic, non-persistent |
| Current architecture | `docs/assets/axonllm-blueprint-architecture.drawio` | Implemented beta boundaries |
| AWS services reference | `docs/assets/axonllm-blueprint-aws-services-reference.drawio` | Proposed target; not deployed |
| Public browser test | `scripts/test-public-site.mjs` | Routes, interactions, diagrams, mobile, no private network |

The public site does not contain credentials, customer data, private endpoints,
AWS account identifiers, backend connectivity, or a deployment path.
