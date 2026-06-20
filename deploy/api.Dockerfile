# syntax=docker/dockerfile:1
# 信逢 Inkling · API 生产镜像（NestJS + Prisma，启动时应用迁移）
# 构建上下文 = 仓库根目录（见 deploy/docker-compose.prod.yml 的 build.context: ..）
# 基底统一 bookworm-slim：与构建阶段同 libc，Prisma native 引擎可直接复用。
ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS build
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.27.0 --activate
WORKDIR /repo
# .dockerignore 已排除 node_modules/.output 等，故 install 在镜像内重新进行（linux 原生二进制）
COPY . .
# 仅装 api + 其依赖(shared)，跳过 web —— 解耦构建、不触发 web 的 nuxt prepare、镜像更小
RUN pnpm install --frozen-lockfile --filter "@inkling/api..." \
 && pnpm build:shared \
 && pnpm --filter @inkling/api prisma:generate \
 && pnpm --filter @inkling/api build

ENV NODE_ENV=production \
    API_PORT=3001
WORKDIR /repo/apps/api
EXPOSE 3001

# 就绪探针（DB + Redis）：编排/反代据此判活
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost:3001/v1/health/ready || exit 1

# 单实例：启动时应用待执行 migration 后再起服务。
# ⚠️ 仅在 api 单副本下安全；多副本须改用独立一次性迁移任务（见 docs/部署与运维.md）。
CMD ["sh", "-lc", "pnpm prisma:deploy && node dist/main.js"]
