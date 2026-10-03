# 信逢 · Inkling

> 让社交回归真诚与纯粹。一座**漂流邮局**——每天写一封信、打捞三次、认真拆开一封，慢慢遇见值得成为笔友的人。

**信逢** 是一个面向海外/港台的慢社交书信 PWA：匿名笔友、永久没有「已读」、用真实地理距离决定车马与信鸽的抵达时间。产品与合规设计已定稿，MVP 已实现核心循环（见下方「当前状态」）。

## 核心循环

```
写信投递 → 内容审核（高危秒级拦截）→ 在途（车马/信鸽）→ 漂入海面
→ 打捞预览（10 分钟决策锁）→ 拆封（每日 1 次）→ 7 天内回信 → 结缘成为笔友
                                               └ 超时未回 → 信回池重新漂流
```

- **每日配额**：1 投递 / 3 打捞 / 1 拆封，不卖次数。
- **打捞 ≠ 占有**：打捞便宜（看半张文字名片），拆封昂贵且不可逆。
- **去人格化**：不显示真人照片、在线状态、已读回执；只有文字名片与模糊距离。
- **并发安全**：拆封 = Redis 原子锁 + DB 条件更新（CAS）双保险，杜绝一封信被两人拆开。

## 当前状态

- ✅ **已实现**：核心循环全链路、并发安全、时间驱动状态机（20s 轮询）、配额、规则匹配（自报 MBTI + 兴趣 + 地理）、内容审核（本地规则 + 可插拔 Provider）、举报/拉黑/隐身/申诉、自动冻结与封禁即时生效、GDPR 导出与注销执行器、去人格化通知、限流防爆破、PWA、CI 三档、生产部署预案。
- ⚠️ **占位**：远程审核 API（fail-closed 桩）、监护人同意链路、RabbitMQ 秒级调度、WebSocket/Web Push。
- 🧭 **演进**：装扮经济、信手礼、向量匹配、信缘博物馆等。
- ❗ **尚未真机部署过**（刻意推迟到「C 档·需付费」；本机 Docker 联调全程免费）。

完整现状、占位与演进清单见 **[docs/设计文档.md](docs/设计文档.md)** §0。

## 技术栈

- **前端** `apps/web` — Nuxt 3（Vue 3 / SPA / 移动优先 / PWA）+ Pinia + UnoCSS + GSAP
- **后端** `apps/api` — NestJS 10 + Prisma 5 + PostgreSQL 16 + Redis 7（`@nestjs/schedule` 时间驱动 + `@nestjs/throttler` 限流）
- **共享** `packages/shared` — 枚举 / 常量 / 类型 / MBTI 相容算法
- 单仓 pnpm workspace；测试 Vitest；CI GitHub Actions（单测 / 集成 e2e / 镜像构建）

## 快速开始

### 🅰 纯前端体验（无需后端 / 数据库，最快）

前端自带一层**内存假后端**（开发态默认开启）：

```bash
pnpm install
pnpm build:shared            # 编译共享包
pnpm dev:web                 # 仅启动 web(:3000)
```

打开 http://localhost:3000 → 注册（假后端也校验年龄与字数）→ 完善名片 → 漂流海打捞种子信 → 拆封 → 回信结缘 → 笔友往来。状态存 sessionStorage（刷新不丢，关标签页即清）。接真实后端时设 `NUXT_PUBLIC_USE_MOCK=0`。

### 🅱 全栈本地联调

```bash
docker compose up -d         # PostgreSQL 16 + Redis 7（或自行安装并改 .env）
pnpm install
cp .env.example .env         # 按需修改 DATABASE_URL / REDIS_URL / JWT_SECRET

pnpm build:shared
pnpm db:generate
pnpm db:deploy               # 应用迁移建表
pnpm db:seed                 # 6 位「漂流邮局」种子写信人（密码 inkling123，仅本地/演示）

pnpm dev                     # api(:3001) + web(:3000)
```

> 演示提示：`LETTER_POOL_DELAY_SECONDS` 控制「投递→入海」等待；`DELIVERY_HOURS_SCALE`（生产 1，测试 0）控制笔友往来在途时长。

### 🅲 生产部署

照做型 runbook 见 **[docs/设计文档.md](docs/设计文档.md)** §8（拓扑、密钥清单、首次部署、备份恢复、回滚预案、上线检查清单、故障排查）；配套产物在 [`deploy/`](deploy/)。

```bash
cp deploy/env.production.example .env   # 填密钥（生产会强制校验 JWT_SECRET）
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build
```

## 测试

```bash
pnpm test                    # 单元测试（Vitest，零基建，无需 DB）
pnpm typecheck               # 全包类型检查
# 集成 / e2e（需本机 PG+Redis）：pnpm db:deploy && pnpm test:integration
```

集成测试与镜像构建由 CI 免费档自动执行（GitHub Actions `services:` 容器）。

## 目录结构

```
inkling/
├── apps/
│   ├── api/                 # NestJS 后端
│   │   ├── prisma/          # schema.prisma + 迁移 + seed
│   │   └── src/
│   │       ├── common/      # prisma / redis / geo / 守卫 / 拦截器 / 过滤器
│   │       ├── config/      # 运行时配置（节奏参数 / 生产密钥校验）
│   │       └── modules/     # auth users letters ocean penpals quota delivery
│   │                        #   moderation penalty reports notifications health
│   └── web/                 # Nuxt 3 前端
│       ├── pages/           # 登录 / 引导 / 漂流海 / 我的信件 / 笔友信匣 / 我的
│       ├── components/      # TabBar / AppHeader / OceanScene / UnsealCeremony …
│       ├── stores/          # auth / quota / ocean (Pinia)
│       ├── composables/     # useApi（401 自动刷新）/ useToast / useNotifications
│       └── mocks/           # 内存假后端（开发态默认开启）
├── packages/shared/         # 共享枚举/常量/类型/MBTI 算法
├── deploy/                  # Dockerfile ×2 / Caddyfile / 生产 compose / env 模板
└── docs/                    # 设计文档（唯一细节文档）
```

## 文档

- **[docs/设计文档.md](docs/设计文档.md)** — 唯一细节文档（原 11 份文档已归并）：
  - §0 现状速览（已实现 / 占位 / 演进 / 待拍板）
  - §1 产品定位与核心玩法 ｜ §2 界面与交互 ｜ §3 匹配与递送
  - §4 内容安全与风控 ｜ §5 未成年人保护与合规
  - §6 数据模型与 API ｜ §7 技术架构与工程实践
  - §8 部署与运维（runbook）｜ §9 风险、决策与待办

## 许可

见 [LICENSE](LICENSE)。
