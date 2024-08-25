FROM node:18-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.0.5 --activate

FROM base AS builder
WORKDIR /app

COPY . .

# Generate a partial monorepo with a pruned lockfile for a target workspace.
RUN pnpm dlx turbo@2 prune @repo/server --docker


FROM base AS installer
WORKDIR /app

# First install the dependencies (as they change less often)
COPY --from=builder /app/out/json/ .

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install

# Build the project
COPY --from=builder /app/out/full/ .
WORKDIR /app/apps/server
RUN rm -rf dist
RUN pnpm run build


FROM base AS runner
WORKDIR /build

# Copy the built files from the installer stage
COPY --from=installer /app/apps/server/dist .

USER node

EXPOSE 49152

CMD node index.js