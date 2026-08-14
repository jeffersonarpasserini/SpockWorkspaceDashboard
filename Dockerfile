FROM node:20.19.5-bookworm-slim@sha256:9e70124bd00f47dd023e349cd587132ae61892acc0e47ed641416c3e18f401c3 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20.19.5-bookworm-slim@sha256:9e70124bd00f47dd023e349cd587132ae61892acc0e47ed641416c3e18f401c3 AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20.19.5-bookworm-slim@sha256:9e70124bd00f47dd023e349cd587132ae61892acc0e47ed641416c3e18f401c3 AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

COPY --chown=node:node --from=builder /app/.next/standalone/server.js ./server.js
COPY --chown=node:node --from=builder /app/.next/standalone/package.json ./package.json
COPY --chown=node:node --from=builder /app/.next/standalone/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/.next/standalone/.next ./.next
COPY --chown=node:node --from=builder /app/.next/static ./.next/static
COPY --chmod=0555 scripts/workspace-startup-gate.sh /usr/local/bin/workspace-startup-gate

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
ENTRYPOINT ["/usr/local/bin/workspace-startup-gate"]
CMD ["node", "server.js"]
