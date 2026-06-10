# syntax=docker/dockerfile:1
# ── Three stages, two of which build in parallel under BuildKit ──────────
#
#   deps   → production node_modules + generated Prisma client
#   build  → dev node_modules + esbuild transpile (NO tsc: type-checking in
#            Docker took minutes / OOM-killed the small droplet and looked
#            like a hung build; `npm run build:fast` emits in <1s. Type
#            safety is enforced by `npx tsc --noEmit` in dev/CI, not here.)
#   production → dist + prod deps only (devDeps no longer shipped)
#
# `--mount=type=cache,target=/root/.npm` keeps the npm cache on the build
# host between builds, so even lockfile-busting rebuilds reuse packages.
# A code-only change rebuilds in seconds: both npm ci layers are cached,
# only COPY + esbuild re-run.

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma/
# prisma is a production dependency (the runtime image runs `migrate deploy`
# at boot), so the CLI + generated client both land here.
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --no-audit --no-fund \
 && npx prisma generate

FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY . .
RUN npm run build:fast

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
# --chown on COPY sets ownership during extraction — a separate
# `chown -R /app` walked every node_modules inode and took ~230s on the
# droplet's disk (it also doubled the layer size).
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node package.json ./
# uploads must be writable by the unprivileged runtime user (KYC docs,
# avatars, media land here unless an external volume is mounted over it).
RUN mkdir -p uploads && chown node:node /app uploads
# Never run a money server as root: a container escape or dependency RCE
# should land in an unprivileged user, not uid 0.
USER node
EXPOSE 5000
# Apply pending migrations BEFORE starting so every deploy self-migrates and is
# idempotent (avoids the "column does not exist → 502 on everything" outage).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
