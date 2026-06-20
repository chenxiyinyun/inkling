# 信逢 · Inkling

> 让社交回归真诚与纯粹。一座**漂流邮局**——每天写一封信、打捞三次、认真拆开一封，慢慢遇见值得成为笔友的人。

完整产品设计见 [docs/](docs/README.md)。

## 技术栈

- **前端** `apps/web` — Nuxt 3（Vue 3 / SPA / 移动优先）+ Pinia + UnoCSS
- **后端** `apps/api` — NestJS + Prisma + PostgreSQL + Redis + `@nestjs/schedule`（时间驱动状态机）
- **共享** `packages/shared` — 跨前后端的枚举 / 常量 / 类型 / MBTI 相容算法
- 单仓：pnpm workspace

> MVP 脚手架的合理简化（均已在代码注释标注）：地理用 GeoHash 字符串、时间驱动用轮询（RabbitMQ 延时队列为生产期升级）、DB 访问用 Prisma（完整 16 表 DDL 见 [docs/数据库设计.md](docs/数据库设计.md)）。

## 快速开始

### 🅰 纯前端体验（无需后端 / 数据库，最快）

想先"玩到"产品，不必起 API/PG/Redis —— 前端自带一层**内存假后端**（开发态默认开启）：

```bash
pnpm install
pnpm build:shared            # 前端依赖共享包
pnpm dev:web                 # 仅启动 web(:3000)
```

打开 http://localhost:3000 → 账号密码随便填即可登录 → 完善名片 → 漂流海打捞 4 封种子信 → 拆封 → 回信结缘 → 笔友往来。配额（1 投 / 3 捞 / 1 拆）会真实递减，状态存在 sessionStorage（刷新不丢，关标签页即清）。
接真实后端时设 `NUXT_PUBLIC_USE_MOCK=0`。实现见 [apps/web/mocks/](apps/web/mocks/)。

### 🅱 全栈本地联调

### 0. 前置：PostgreSQL 16 + Redis 7

有 Docker：

```bash
docker compose up -d
```

无 Docker（如本机）：自行安装 PostgreSQL/Redis，建库 `inkling`，并修改 `.env` 连接串。

### 1. 安装与配置

```bash
pnpm install
cp .env.example .env        # 按需修改 DATABASE_URL / REDIS_URL / JWT_SECRET
```

### 2. 初始化数据库 + 种子数据

```bash
pnpm build:shared           # 先编译共享包（前后端都依赖）
pnpm db:generate            # 生成 Prisma Client
pnpm db:migrate             # 建表（首次会让你命名 migration）
pnpm db:seed                # 注入 6 位"漂流邮局"种子写信人（密码 inkling123）
```

### 3. 启动

```bash
pnpm dev                    # 同时启动 api(:3001) 与 web(:3000)
# 或分开：
pnpm dev:api
pnpm dev:web
```

打开 http://localhost:3000 —— 注册 → 完善名片 → 去漂流海打捞种子信 → 拆封 → 回信结缘。

> 演示提示：`.env` 里 `LETTER_POOL_DELAY_SECONDS`（默认 30s）控制"投递→漂入海面"的等待；
> `DELIVERY_HOURS_SCALE`（生产 1=真实 4–96h 距离精算；本地可设小数加速，集成测试设 0 即时）控制笔友往来的"在途"时长。

## 测试

```bash
pnpm test                    # Vitest：纯逻辑 + service 回归（无需 DB，105 用例）
pnpm typecheck               # 全包类型检查
```

## 部署上线（生产）

照做型 runbook 见 **[docs/部署与运维.md](docs/部署与运维.md)**：单机四容器（Caddy 边缘自动 HTTPS + 同源反代 → NestJS → PostgreSQL/Redis），含环境密钥清单、首次部署、备份恢复、**上线检查清单**与**回滚预案**。配套产物在 [`deploy/`](deploy/)；`git push` 触发 CI 的 **Images** 工作流离线验证镜像可构建。

```bash
cp deploy/env.production.example .env   # 填密钥（见手册 §2）
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build
```

## 目录结构

```
inkling/
├── apps/
│   ├── api/                 # NestJS 后端
│   │   ├── prisma/          # schema.prisma + seed.ts
│   │   └── src/
│   │       ├── common/      # prisma / redis / geo / 守卫 / 拦截器 / 过滤器
│   │       ├── config/      # 运行时配置（节奏参数）
│   │       └── modules/     # auth / users / letters / ocean / penpals / quota
│   │                        #   / delivery(调度) / moderation / reports / notifications
│   └── web/                 # Nuxt 3 前端
│       ├── pages/           # 登录 / 引导 / 漂流海 / 我的信件 / 笔友信匣 / 我的
│       ├── components/      # TabBar / AppHeader / LetterCard
│       ├── stores/          # auth / quota / ocean (Pinia)
│       ├── mocks/           # 内存假后端（无需 API 即可联调，开发态默认开启）
│       └── plugins/         # mock.client.ts 注入假后端
├── packages/shared/         # 共享枚举/常量/类型/MBTI
└── docs/                    # 产品设计、数据库、API、安全、合规等文档
```

## 核心循环（已实现）

写信投递 → AI 审核（高危拦截）→ 在途 → 漂入海面 → 打捞预览（10 分钟锁）→ 拆封（每日 1 次）
→ 7 天内回信 → **结缘成笔友** → 笔友信匣往来（保留"在途"慢节奏）；超时则回池重新漂流。

并发安全：拆封用 Redis 锁 + DB 乐观锁（`version` CAS）双保险，杜绝一封信被两人拆封。

## 当前阶段与待办

MVP 脚手架已打通核心循环与合规安全底座（年龄门控 / 守护模式 / 举报拉黑 / GDPR 删除导出）。
演进项（见 docs）：向量召回匹配、装扮经济与信手礼收集、RabbitMQ 延时队列、真实距离精算、
WebSocket 实时通知、PWA 离线、第三方内容安全 API。
