FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate

# Build
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

# Production
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY package.json ./

RUN mkdir -p uploads

EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
