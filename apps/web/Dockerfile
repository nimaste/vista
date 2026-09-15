# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN apk add --no-cache openssl
WORKDIR /repo

# --- build stage ---
FROM base AS build
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --filter @vista/web...

COPY apps/web apps/web
WORKDIR /repo/apps/web
RUN pnpm prisma generate
RUN pnpm build

# --- runtime ---
FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl wget
# Prisma CLI is needed at runtime for `prisma db push`. Installing it globally keeps
# the image simple (no pnpm workspace layout carrying over).
RUN npm install -g prisma@5.22.0

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next.js standalone output already contains a flattened node_modules with @prisma/client
# and the engine binaries it needs at runtime.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
COPY --from=build /repo/apps/web/prisma ./apps/web/prisma

COPY apps/web/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
