# ── Build stage ──
FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /draba ./cmd/draba

# ── Dev stage (used by docker-compose for hot reload) ──
# Source is provided by the docker-compose volume mount, not baked in here —
# baking it in caused Air to see a spurious "change" on first mount and restart.
FROM golang:1.25-alpine AS dev
RUN go install github.com/air-verse/air@latest
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
CMD ["air", "-c", ".air.toml"]

# ── Production stage ──
FROM alpine:3.21 AS prod
RUN apk add --no-cache ca-certificates && mkdir -p /data
COPY --from=builder /draba /usr/local/bin/draba
WORKDIR /data
EXPOSE 8080
CMD ["draba"]
