FROM node:22.23.2-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY scripts/copy-public-assets.mjs /app/scripts/copy-public-assets.mjs
COPY docs/assets/ /app/docs/assets/
RUN npm run build

FROM node:22.23.2-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS backend-build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

FROM node:22.23.2-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS runtime
LABEL org.opencontainers.image.title="AxonLLM Blueprint"
LABEL org.opencontainers.image.description="Bedrock-powered infrastructure design and review workbench"
LABEL org.opencontainers.image.source="https://github.com/hk-775/axonllm-blueprint"
LABEL org.opencontainers.image.licenses="MIT-0"

ENV NODE_ENV=production
ENV PORT=3001
ENV STATIC_DIR=/app/public
WORKDIR /app/backend

RUN apk upgrade --no-cache libcrypto3 libssl3

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force \
  && rm -rf /root/.npm /usr/local/lib/node_modules/npm \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=frontend-build /app/frontend/dist /app/public

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD ["node", "dist/index.js"]
