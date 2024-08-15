FROM node:18-slim AS base

FROM base AS builder
WORKDIR /app

RUN npm install -g turbo
COPY . .

# Generate a partial monorepo with a pruned lockfile for a target workspace.
RUN turbo prune worker --docker


FROM base AS installer
WORKDIR /app
RUN npm install -g pnpm

# First install the dependencies (as they change less often)
COPY --from=builder /app/out/json/ .
RUN pnpm install --frozen-lockfile

# Build the project
COPY --from=builder /app/out/full/ .
RUN yarn turbo run build --filter=worker


FROM base AS runner
WORKDIR /app

USER node

CMD node apps/worker/dist/index.js