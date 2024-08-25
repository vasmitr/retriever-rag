FROM node:18-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.0.5 --activate

FROM base AS builder
WORKDIR /app

COPY . .

# Generate a partial monorepo with a pruned lockfile for a target workspace.
RUN pnpm dlx turbo@2 prune @repo/worker --docker


FROM base AS installer
WORKDIR /app

# First install the dependencies (as they change less often)
COPY --from=builder /app/out/json/ .

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install

# Build the project
COPY --from=builder /app/out/full/ .
WORKDIR /app/apps/worker
RUN rm -rf dist
RUN pnpm dlx turbo@2 build --filter=@repo/worker


FROM base AS runner
WORKDIR /build

# Copy the built files from the installer stage
COPY --from=installer /app/apps/worker/dist .

USER node

CMD node index.js