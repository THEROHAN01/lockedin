# syntax=docker/dockerfile:1
#
# A self-hosted image for the app. Vercel is the deployment target of record
# (ADR-007) and does not use this file — it exists so the app can also run
# anywhere that takes a container, and so a reviewer can run the built app
# without a Node toolchain.
#
#   docker build -t lockedin .
#   docker run --rm -p 3000:3000 --env-file .env lockedin
#
# Migrations are deliberately not run here; see the `migrator` stage at the end.

# Debian rather than Alpine, and pinned to bookworm for one specific reason:
# Prisma's query engine is a native binary chosen per-platform at generate time.
# Bookworm ships OpenSSL 3.0, so `prisma generate` resolves
# libquery_engine-debian-openssl-3.0.x — the same engine a glibc host produces,
# which is what makes a build verified outside the container transferable to it.
# Alpine would resolve the musl engine instead and needs libc6-compat on top.
ARG NODE_IMAGE=node:20.19.4-bookworm-slim


# ── base ──────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS base

# openssl is what the Prisma engine dynamically links against; the slim images
# omit it. Missing it fails at run time with a library-load error rather than at
# build time, so it is installed here, once, for every stage that inherits.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# pnpm comes from package.json's `packageManager` field rather than a version
# pinned here, so the lockfile is never resolved by a different pnpm than the one
# that wrote it (ADR-008). The prompt is disabled because a build has no tty.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable pnpm

WORKDIR /app


# ── deps ──────────────────────────────────────────────────────────────────────
# Split from the build so that editing a component does not reinstall 1.1 GB of
# dependencies. Only the files below invalidate this layer.
FROM base AS deps

# source.config.ts is here because `postinstall` is not a no-op: it runs
# fumadocs-mdx, which exits non-zero without that file. prisma/ is here for the
# same reason — @prisma/client's own postinstall generates against the schema.
#
# content/ is deliberately NOT copied, though fumadocs reads it during the real
# build. It is not needed to generate types (verified: the postinstall succeeds
# without it), and copying it here would put every docs edit in this layer's
# cache key — reinstalling all dependencies to change a sentence, which is the
# cost this stage exists to avoid.
COPY package.json pnpm-lock.yaml ./
COPY source.config.ts ./
COPY prisma ./prisma

RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
  pnpm config set store-dir /pnpm-store \
  && pnpm install --frozen-lockfile


# ── builder ───────────────────────────────────────────────────────────────────
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Emits .next/standalone: the server plus only the node_modules files Next
# traced as reachable. 104 MB against 1.1 GB of installed dependencies, because
# mermaid, the Prisma CLI, TypeScript and the test toolchain are all build-time
# only. See the comment in next.config.ts for why this is opt-in.
ENV BUILD_STANDALONE=1
ENV NEXT_TELEMETRY_DISABLED=1

# Placeholders, not configuration. `next build` evaluates modules that assert
# their environment at import time — src/auth.ts throws on a missing
# BETTER_AUTH_SECRET while merely being loaded — so the build needs these set to
# something non-empty. Nothing here is read at run time: the runner stage does
# not carry them, and every value is inert and reaches no real service.
#
# The database URL is the clearest case. It is never connected to; `prisma
# generate` only writes types, and nothing in `next build` opens a connection.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    BETTER_AUTH_SECRET="build-time-placeholder-not-a-secret" \
    BETTER_AUTH_URL="http://localhost:3000" \
    RESEND_API_KEY="re_build_time_placeholder" \
    EMAIL_FROM="LockedIn <build@example.invalid>" \
    CRON_SECRET="build-time-placeholder-not-a-secret"

RUN pnpm build


# ── runner ────────────────────────────────────────────────────────────────────
FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Standalone's server reads both. HOSTNAME especially: left unset it binds
# localhost inside the container, so the port is published and every request
# still refused.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# `node` (uid 1000) ships with the official images. Running as root would give a
# process that only needs to read its own bundle and speak Postgres the ability
# to write anywhere in the container.
USER node

# Ownership is set on copy rather than with a later chown, which would duplicate
# every file into a second layer.
#
# Two copies, because standalone is not self-sufficient by design: Next traces
# server code only, leaving the client bundle in .next/static to be served by a
# CDN in deployments that have one. There is no public/ directory in this repo
# today — add a third COPY for it alongside these if one appears.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

EXPOSE 3000

# Deliberately hits an endpoint with no database access: it is unauthenticated,
# generated in memory from the Zod schemas, and so answers "the server is
# serving" rather than "Postgres is reachable". A check that also failed on a
# database blip would restart a container that is not the broken part.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/openapi.json').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]


# ── migrator ──────────────────────────────────────────────────────────────────
# A separate image, not a step in the one above, because applying migrations is
# not something every replica should do on boot — N containers starting together
# would race on the same schema. Run it once, as its own task, before rolling
# out a new runner:
#
#   docker build --target migrator -t lockedin-migrate .
#   docker run --rm --env-file .env lockedin-migrate
#
# It inherits the builder, so it has the Prisma CLI and the migrations that the
# runner deliberately does not.
FROM builder AS migrator

# Inheriting the builder also inherits its placeholder DATABASE_URL, which for
# this stage is actively dangerous in a quiet way: run without --env-file and
# Prisma would dial the placeholder host rather than say it was misconfigured.
# Blanking it turns that into an immediate, legible failure about a missing
# connection string, which is the only correct outcome for a migration whose
# target is unknown.
ENV DATABASE_URL=""

CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]
