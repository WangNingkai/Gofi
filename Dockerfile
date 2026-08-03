ARG NODE_VERSION=24.14.1
ARG GO_VERSION=1.26.5
ARG PNPM_VERSION=10.34.5

FROM node:${NODE_VERSION}-alpine AS frontend
ARG PNPM_VERSION
WORKDIR /src/gofi-frontend

RUN npm install --global "pnpm@${PNPM_VERSION}"
COPY gofi-frontend/package.json gofi-frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY gofi-frontend/ ./
RUN pnpm build

FROM golang:${GO_VERSION}-alpine AS backend
# Application version excludes the leading `v` reserved for Git Release tags.
ARG VERSION=dev
WORKDIR /src

COPY gofi-backend/go.mod gofi-backend/go.sum ./
RUN go mod download
COPY gofi-backend/ ./
COPY --from=frontend /src/gofi-frontend/dist ./env/dist
RUN CGO_ENABLED=0 go build \
    -tags=production \
    -trimpath -buildvcs=false \
    -ldflags="-w -s -buildid= -X gofi/db.version=${VERSION}" \
    -o /src/gofi .

FROM alpine:3.22
ARG VERSION=dev

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S gofi \
    && adduser -S -G gofi gofi \
    && mkdir -p /app/storage \
    && chown -R gofi:gofi /app

COPY --from=backend /src/gofi /usr/local/bin/gofi

WORKDIR /app
USER gofi

EXPOSE 8080
VOLUME ["/app"]

LABEL org.opencontainers.image.title="Gofi" \
      org.opencontainers.image.source="https://github.com/Sloaix/Gofi" \
      org.opencontainers.image.version="${VERSION}"

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/api/configuration || exit 1

ENTRYPOINT ["gofi"]
