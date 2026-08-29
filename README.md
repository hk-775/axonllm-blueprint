# AxonLLM Blueprint

AxonLLM Blueprint is an open-source infrastructure workbench powered by Amazon Bedrock. It helps engineers design cloud systems, generate Infrastructure as Code, review configurations, and troubleshoot failures while keeping deployment behind an explicit human gate.

> Beta software. Blueprint produces advisory output. Review every recommendation and run native validation tools before deploying infrastructure.

![AxonLLM Blueprint architecture](docs/assets/axonllm-blueprint-architecture.png)

The editable diagram is available at [`docs/assets/axonllm-blueprint-architecture.drawio`](docs/assets/axonllm-blueprint-architecture.drawio).

## Capabilities

- Architecture guidance with assumptions and tradeoffs
- CloudFormation, Terraform, and AWS CDK generation
- CloudFormation, Terraform, Dockerfile, and Kubernetes review
- Structured infrastructure troubleshooting
- Server-controlled Bedrock model allowlist
- Bounded, expiring in-memory conversation sessions
- Trusted-proxy identity enforcement and tenant-bound sessions
- Bounded per-principal model request limiting
- Markdown and syntax-highlighted code rendering
- Bedrock Converse API with adaptive SDK retries

## Safety boundaries

Blueprint does not deploy infrastructure, fetch secret values, or accept arbitrary model IDs from the browser. Production startup requires either a trusted authentication proxy or an explicit acknowledgement that the deployment is unauthenticated. In trusted-proxy mode, verified identities are hashed, sessions are tenant-bound, and model calls are rate limited per principal.

The beta does not include an identity provider, durable session store, distributed rate limiter, or application audit trail. See [the threat model](docs/THREAT_MODEL.md) before adapting it for production.

## Quick start

Prerequisites:

- Node.js 22.23.2 or newer
- AWS credentials available through the standard AWS credential chain
- Access to at least one text model or inference profile in Amazon Bedrock

Install dependencies:

```bash
npm run setup
```

Create the backend configuration:

```bash
cp backend/.env.example backend/.env
```

Start the API:

```bash
npm run dev:backend
```

In another terminal, start the web workspace:

```bash
npm run dev:frontend
```

Open `http://localhost:5173`.

The default model is `us.amazon.nova-2-lite-v1:0`. Model availability is regional and account-specific, so replace it with an inference profile available to your account when needed.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `AWS_REGION` | `us-east-1` | Bedrock Runtime region |
| `BEDROCK_MODEL_ID` | `us.amazon.nova-2-lite-v1:0` | Default model or inference profile |
| `BEDROCK_MODEL_IDS` | default model only | Comma-separated server allowlist |
| `CORS_ORIGINS` | local Vite origins | Comma-separated browser origins |
| `PORT` | `3001` | API port |
| `VERIFY_BEDROCK_ON_STARTUP` | `false` | Performs a small, billable model request at startup |
| `STATIC_DIR` | unset | Optional built frontend directory served by Express |
| `BLUEPRINT_TRUST_AUTH_PROXY` | `false` | Requires a verified identity header from a trusted proxy |
| `BLUEPRINT_ALLOW_UNAUTHENTICATED` | `false` | Explicitly permits an unauthenticated production startup |
| `BLUEPRINT_AUTH_HEADER` | `x-blueprint-user` | Header injected by the trusted authentication proxy |
| `BLUEPRINT_TRUST_PROXY_HOPS` | `0` | Number of trusted reverse-proxy hops |
| `BLUEPRINT_RATE_LIMIT_WINDOW_MS` | `60000` | In-process model request window |
| `BLUEPRINT_RATE_LIMIT_MAX_REQUESTS` | `12` | Model requests allowed per principal and window |

The frontend uses `/api` by default and proxies it to port 3001 during development. Set `VITE_API_BASE_URL` when the API is hosted on another origin.

## Docker

Build the combined frontend and API image:

```bash
docker build -t axonllm-blueprint .
```

Run it with credentials supplied by your container environment or workload role:

```bash
docker run --rm -p 3001:3001 \
  -e AWS_REGION=us-east-1 \
  -e BEDROCK_MODEL_ID=us.amazon.nova-2-lite-v1:0 \
  -e BLUEPRINT_ALLOW_UNAUTHENTICATED=true \
  axonllm-blueprint
```

Then open `http://localhost:3001`.

The unauthenticated flag is appropriate only for a controlled local demo. Production deployments should set `BLUEPRINT_TRUST_AUTH_PROXY=true` and place Blueprint behind a proxy that strips any client-supplied identity header before injecting a verified identity.

Do not bake AWS credentials into the image. For local containers, mount a read-only AWS configuration directory or pass short-lived environment credentials outside source control.

## Validation

Run the complete local verification suite:

```bash
npm run verify
```

The suite performs a secret-pattern scan, TypeScript checks, automated tests, and production builds for both applications. CI additionally verifies registry signatures, audits dependencies, generates CycloneDX SBOMs, scans the container, and runs CodeQL.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service and runtime status |
| `GET` | `/api/models` | Server-allowlisted models |
| `GET` | `/api/config` | Default inference settings and limits |
| `POST` | `/api/sessions` | Create an in-memory session |
| `DELETE` | `/api/sessions/:id` | Remove a session |
| `POST` | `/api/chat` | Send a Bedrock-backed infrastructure request |

## Repository structure

```text
backend/                  Express API, Bedrock client, prompts, sessions
frontend/                 React and Vite workbench
docs/                     Architecture, deployment, prompts, threat model
docs/assets/              Architecture PNG and editable draw.io source
.github/workflows/        CI and CodeQL
Dockerfile                Combined production image
```

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidance. Report vulnerabilities through the repository's private security advisory flow as described in [SECURITY.md](SECURITY.md).

## License

MIT-0. See [LICENSE](LICENSE).
