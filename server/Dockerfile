# ── Build stage ──────────────────────────────────────────────────────────
# A single `npm ci` (deterministic + cached on the lockfile) installs every
# dependency once. The original Dockerfile ran `npm install` TWICE (once for
# prod deps, once for dev) — this halves install time and the layer is reused
# across code-only rebuilds since package*.json rarely change.
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline --no-audit --no-fund
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
RUN npm run build

# ── Runtime stage ────────────────────────────────────────────────────────
# Carries the full node_modules from build: it already contains the generated
# Prisma client AND the prisma CLI, so `migrate deploy` runs offline at startup
# (no on-the-fly npx download). Build time — the actual pain point — is now a
# single install that caches.
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN mkdir -p uploads
EXPOSE 5000
# Apply pending migrations BEFORE starting so every deploy self-migrates and is
# idempotent (avoids the "column does not exist → 502 on everything" outage).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
