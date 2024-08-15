FROM node:18-slim AS base

FROM base AS builder
WORKDIR /app

RUN npm install -g turbo
COPY . .

# Generate a partial monorepo with a pruned lockfile for a target workspace.
RUN turbo prune server --docker


FROM base AS installer
WORKDIR /app
RUN npm install -g pnpm

# First install the dependencies (as they change less often)
COPY --from=builder /app/out/json/ .
RUN pnpm install --frozen-lockfile

# Build the project
COPY --from=builder /app/out/full/ .
RUN pnpm turbo run build --filter=server


FROM base AS runner
WORKDIR /app

USER node

EXPOSE 49152

CMD node apps/server/dist/index.js