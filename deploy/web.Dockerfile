# syntax=docker/dockerfile:1
# 信逢 Inkling · 边缘镜像（Nuxt SPA 静态产物 + Caddy 同源反代 + 自动 HTTPS）
# 构建上下文 = 仓库根目录
ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS build
RUN corepack enable && corepack prepare pnpm@10.27.0 --activate
WORKDIR /repo
COPY . .
# 仅装 web + 其依赖(shared)，跳过 api —— 解耦构建、镜像更小
RUN pnpm install --frozen-lockfile --filter "@inkling/web..." && pnpm build:shared
# 同源部署：API 基址用相对 /v1（Caddy 反代到 api 容器，免 CORS）；强制关闭前端 Mock。
# 这些是「构建期」固化值——改它们需重建本镜像。
ENV NUXT_PUBLIC_API_BASE=/v1 \
    NUXT_PUBLIC_USE_MOCK=0 \
    NODE_ENV=production
RUN pnpm --filter @inkling/web generate

FROM caddy:2-alpine AS runtime
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/.output/public /srv
EXPOSE 80 443
