FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/event-bus/package.json ./packages/event-bus/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY apps/server/package.json ./apps/server/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/*/node_modules ./packages/
COPY . .
RUN pnpm --filter @pos/shared-types build && \
    pnpm --filter @pos/event-bus build && \
    pnpm --filter @pos/core build && \
    pnpm --filter @pos/db build && \
    pnpm --filter @pos/server build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["node", "dist/index.js"]
