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
> `CORRESPONDENCE_DELIVER_SECONDS`（默认 60s）控制笔友往来的"在途"时长。生产期按真实距离精算。

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
│       └── stores/          # auth / quota / ocean (Pinia)
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
