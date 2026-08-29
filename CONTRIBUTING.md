# Contributing

Thank you for improving AxonLLM Blueprint.

## Development

1. Install Node.js 22.23.2 or newer.
2. Run `npm run setup`.
3. Copy `backend/.env.example` to `backend/.env`.
4. Create a focused branch.
5. Run `npm run verify` before opening a pull request.

## Pull requests

- Keep changes focused and explain user-visible behavior.
- Add or update tests for behavior changes.
- Update documentation when configuration or architecture changes.
- Do not commit credentials, generated `node_modules`, build output, or personal AWS configuration.
- Pin third-party GitHub Actions and container bases to immutable digests.
- Preserve the human deployment gate and server-side model allowlist unless the security design is updated with the change.

## Style

Use TypeScript strict mode, small composable functions, and actionable error messages. Prefer the AWS SDK default credential chain and service-native retry behavior.
