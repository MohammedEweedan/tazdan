FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
COPY prisma ./prisma/
RUN npm install --omit=dev && npx prisma generate

FROM base AS build
RUN npm install
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN mkdir -p uploads
EXPOSE 5000
# Apply any pending DB migrations BEFORE starting the server. Previously the
# container only ran `node dist/index.js`, so a deploy that shipped a schema
# change without a manual `migrate deploy` left the code querying columns the
# DB didn't have → the server crashed on the first query (502 for everything).
# Running migrate-then-start makes every deploy self-migrating and idempotent.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
