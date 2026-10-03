# 信逢 Inkling · API 生产镜像（多阶段 · 非 root）
# 构建上下文 = 仓库根目录（见 deploy/docker-compose.prod.yml 的 build.context: ..）
# 阶段① build：装依赖（含 prisma CLI / ts-node —— 运行期仍需 migrate/seed）并编译；
# 阶段② runtime：仅拷贝运行所需产物，以 node 用户运行。
ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS build
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
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

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    API_PORT=3001 \
    COREPACK_HOME=/opt/corepack
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* \
 # 运行期只需 pnpm 这一个入口（migrate/seed 脚本）：corepack 预置到共享 COREPACK_HOME，
 # 供非 root（node）用户离线解析（否则 corepack 会在运行时尝试重新下载）
 && corepack enable \
 && corepack prepare pnpm@10.27.0 --activate \
 && chmod -R a+rX /opt/corepack

WORKDIR /repo
# 依赖整体拷贝（pnpm 的符号链接结构需保持）——保留完整依赖是刻意选择：容器内要跑 prisma migrate/seed，见 docs/设计文档.md §8.7
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/package.json /repo/pnpm-workspace.yaml /repo/pnpm-lock.yaml /repo/tsconfig.base.json ./
COPY --from=build --chown=node:node /repo/packages/shared/package.json packages/shared/
COPY --from=build --chown=node:node /repo/packages/shared/dist packages/shared/dist
COPY --from=build --chown=node:node /repo/packages/shared/node_modules packages/shared/node_modules
COPY --from=build --chown=node:node /repo/apps/api/package.json apps/api/
COPY --from=build --chown=node:node /repo/apps/api/dist apps/api/dist
COPY --from=build --chown=node:node /repo/apps/api/prisma apps/api/prisma
COPY --from=build --chown=node:node /repo/apps/api/node_modules apps/api/node_modules
COPY --from=build --chown=node:node /repo/apps/api/tsconfig*.json apps/api/

USER node
WORKDIR /repo/apps/api
EXPOSE 3001

# 就绪探针（DB + Redis）：编排/反代据此判活
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost:3001/v1/health/ready || exit 1

# 单实例：启动时应用待执行 migration 后再起服务。
# ⚠️ 仅在 api 单副本下安全；多副本须改用独立一次性迁移任务（见 docs/设计文档.md §8）。
CMD ["sh", "-lc", "pnpm prisma:deploy && node dist/main.js"]
