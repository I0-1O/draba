# ── Web builder ──
FROM node:22-alpine AS web-builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/web/package.json packages/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY packages/web packages/web
COPY packages/shared packages/shared
RUN pnpm --filter @draba/web build

# ── Go dependency cache ──
FROM golang:1.25-alpine AS go-deps
WORKDIR /app
COPY packages/api/go.mod packages/api/go.sum ./
RUN go mod download

# ── Production builder — embeds web dist into the Go binary ──
FROM go-deps AS builder
COPY packages/api/ .
COPY --from=web-builder /workspace/packages/web/dist ./ui/static
RUN CGO_ENABLED=0 go build -o /draba ./cmd/draba

# ── Dev stage (used by docker-compose for hot reload) ──
# Source is provided by the docker-compose volume mount, not baked in here —
# baking it in caused Air to see a spurious "change" on first mount and restart.
FROM golang:1.25-alpine AS dev
RUN go install github.com/air-verse/air@latest
WORKDIR /app
COPY packages/api/go.mod packages/api/go.sum ./
RUN go mod download
CMD ["air", "-c", ".air.toml"]

# ── Production stage ──
FROM alpine:3.21 AS prod
RUN apk add --no-cache ca-certificates \
    && addgroup -g 1000 draba \
    && adduser -u 1000 -G draba -s /bin/sh -D draba \
    && mkdir -p /data \
    && chown draba:draba /data
COPY --from=builder /draba /usr/local/bin/draba
WORKDIR /data
USER draba
EXPOSE 8080
CMD ["draba"]
