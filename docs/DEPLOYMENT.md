# Deployment

## Local development

Install dependencies and create `backend/.env`:

```bash
npm run setup
cp backend/.env.example backend/.env
```

Run the API and frontend in separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

Vite proxies `/api` to `http://localhost:3001`.

## Combined Docker image

The root Dockerfile builds both applications and serves the static frontend from Express:

```bash
docker build -t axonllm-blueprint .
docker run --rm -p 3001:3001 \
  -e AWS_REGION=us-east-1 \
  -e BEDROCK_MODEL_ID=us.amazon.nova-2-lite-v1:0 \
  -e BLUEPRINT_ALLOW_UNAUTHENTICATED=true \
  axonllm-blueprint
```

Supply credentials through a workload role, short-lived environment credentials, or a read-only local AWS configuration mount. Never add credentials to the image or repository.

`BLUEPRINT_ALLOW_UNAUTHENTICATED=true` is an explicit local-demo acknowledgement. The production runtime refuses to start without that acknowledgement or `BLUEPRINT_TRUST_AUTH_PROXY=true`.

## Authenticated proxy mode

For a shared or internet-reachable deployment, place Blueprint behind an identity-aware gateway or reverse proxy. Configure the proxy to remove any client-provided identity header, authenticate the request, and inject a verified identity:

```text
BLUEPRINT_TRUST_AUTH_PROXY=true
BLUEPRINT_AUTH_HEADER=x-blueprint-user
BLUEPRINT_TRUST_PROXY_HOPS=1
```

Blueprint hashes the verified identity before using it for session ownership and rate-limit keys. Requests without the configured identity header receive `401`, and one principal cannot use another principal's session ID.

## Production checklist

- configure an authenticated gateway or identity-aware proxy
- ensure the proxy strips and replaces the configured identity header
- replace the in-process limiter with a distributed limiter for multi-instance deployments
- replace process-local sessions with a tenant-aware store
- configure exact CORS origins
- restrict Bedrock model resources in IAM
- place the service behind TLS
- add centralized metrics, logs, traces, and alarms
- define prompt and session retention
- add backup and recovery controls for any durable store
- validate the image, SBOM, and provenance in the deployment pipeline
- keep deployment actions outside Blueprint unless separately designed and approved
