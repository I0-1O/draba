FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/web/package.json packages/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY packages/web packages/web
COPY packages/shared packages/shared
WORKDIR /app/packages/web
EXPOSE 5173
CMD ["pnpm", "dev", "--host"]
