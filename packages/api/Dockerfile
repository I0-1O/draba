# ── Build stage ──
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /draba ./cmd/draba

# ── Dev stage (used by docker-compose for hot reload) ──
FROM golang:1.23-alpine AS dev
RUN go install github.com/air-verse/air@latest
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
CMD ["air", "-c", ".air.toml"]

# ── Production stage ──
FROM alpine:3.19 AS prod
RUN apk add --no-cache ca-certificates
COPY --from=builder /draba /usr/local/bin/draba
EXPOSE 8080
CMD ["draba"]
