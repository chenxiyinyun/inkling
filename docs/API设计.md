# 《信逢 Inkling · MVP API 接口设计》

> 版本：v1.0（细化设计阶段）· 日期：2026-06-14
> 配套文档：《MVP 信息架构与页面流程》《MVP 数据库设计（PostgreSQL 16）》
> 约定：端点路径与字段命名与数据库设计保持一致（对外只暴露 `public_id`，绝不暴露自增 `id`）。所有标注 **[MVP]** 为本期范围，**[演进预留]** 为后续阶段、接口可预留但不实现业务逻辑。

---

## 1. 总则

### 1.1 RESTful 风格

- 资源名用复数名词，动作型操作用子资源动词（漂流邮局是强状态机业务，纯 CRUD 难以表达"打捞/拆封/回信"，故对状态迁移采用 `POST /resource/{id}/action` 风格）。
- 方法语义：`GET` 查询（幂等、无副作用）、`POST` 创建/触发动作、`PATCH` 局部更新、`DELETE` 删除/注销。
- 列表统一游标分页（不用 offset，避免漂流池数据频繁变动导致翻页错乱）。

### 1.2 版本前缀与基础路径

```
https://api.inkling.app/v1/...
```

- 所有端点统一前缀 `/v1`。大版本通过路径切换；小版本兼容性变更不升路径。
- `Accept-Language` 头决定文案语言（海外/港台多语：`zh-Hant` / `zh-Hans` / `en`）。
- `X-Jurisdiction`（可选）由客户端回传声明法域，服务端以 `users.jurisdiction` 为准做合规分支。

### 1.3 鉴权方式（JWT，双 Token）

采用 **JWT 双 Token** 方案（无状态、利于 SSR/PWA 多端，配合 Redis 黑名单做强制下线）：

- **Access Token**：JWT，短时效（15 分钟），放 `Authorization: Bearer <token>`。载荷含 `sub`(=public_id)、`age_tier`、`guardian`(守护模式布尔)、`status`、`scope`、`jti`。
- **Refresh Token**：长时效（30 天），HttpOnly + Secure + SameSite=Strict Cookie 存储（PWA Web 端防 XSS 窃取），服务端在 Redis 维护 `refresh:{jti}` 白名单，注销/封禁即删。
- Token 内嵌 `age_tier` 与 `guardian` 标志，使网关层可对未成年接口做快速门控，无需每次查库。
- 注销、封禁、家长撤回同意 → 服务端将 `jti` 写入 Redis 黑名单（TTL=access 剩余时效），并删除 refresh 白名单，实现"强制下线"。

> **[演进预留]** 设备指纹/多设备会话管理、生物识别快速登录。

### 1.4 统一响应结构

成功：

```json
{
  "code": 0,
  "message": "ok",
  "data": { },
  "meta": {
    "request_id": "req_01HZX...",
    "server_time": "2026-06-14T08:30:00Z"
  }
}
```

- `code=0` 恒表示业务成功；HTTP 状态码同时为 2xx。
- 列表响应 `data` 内含 `items` + `page`：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [ ],
    "page": { "next_cursor": "eyJpZCI6MTAyM30=", "has_more": true, "limit": 20 }
  }
}
```

失败：

```json
{
  "code": 42901,
  "message": "今日打捞次数已用尽，明日潮汐再启",
  "data": null,
  "meta": { "request_id": "req_01HZX...", "server_time": "2026-06-14T08:30:00Z" }
}
```

- `message` 为可直接展示给用户的世界观文案（已按 `Accept-Language` 本地化）；技术细节放 `data.detail`（仅 4xx 调试态返回，生产对客户端隐藏敏感细节）。

### 1.5 错误码规范

错误码为 5 位整数：前 3 位对齐 HTTP 状态，后 2 位为业务序号。HTTP 状态码与业务码并存。

| 业务码 | HTTP | 含义 | 备注 |
|---|---|---|---|
| 0 | 200/201 | 成功 | |
| 40001 | 400 | 参数校验失败 | `data.detail` 给字段级错误 |
| 40002 | 400 | 协议未勾选 | 注册 |
| 40101 | 401 | 未登录/Token 失效 | 触发刷新 |
| 40102 | 401 | Refresh 失效，需重新登录 | |
| 40301 | 403 | 账号被封禁/暂停 | |
| 40302 | 403 | 未满最低年龄，禁止访问 | 年龄门控 |
| 40303 | 403 | 待家长同意，功能受限 | `pending_consent` |
| 40304 | 403 | 守护模式限制此操作 | 未成年保护 |
| 40305 | 403 | 隐身/闭关中，操作受限 | |
| 40401 | 404 | 资源不存在 | |
| 40901 | 409 | 状态冲突（乐观锁/状态机非法迁移） | 拆封并发 |
| 42201 | 422 | 内容审核未通过（高危拦截） | 投递/回信 |
| 42202 | 422 | 检测到联系方式/导流 | |
| 42901 | 429 | 配额用尽（投/捞/拆） | `data.quota` 返回详情 |
| 42902 | 429 | 触发限流（频率过高） | `Retry-After` 头 |
| 42301 | 423 | 资源被锁定（预览锁未释放） | |
| 50001 | 500 | 服务器内部错误 | |
| 50301 | 503 | 依赖不可用（审核服务/队列） | 降级文案 |

### 1.6 通用约定

- **幂等**：所有写动作支持 `Idempotency-Key` 头（投递、打捞、拆封、回信尤其需要，防止移动端弱网重复提交）。服务端以 Redis 缓存 `idem:{user}:{key}` → 首个结果，TTL 24h。
- **时间**：均为 UTC ISO8601；对外展示由客户端模糊化（"刚刚漂来/已漂泊 N 天"），API 不返回任何 `read_at`/`seen` 字段（永不"已读"）。
- **地理**：所有响应只返回粗粒度 `distance_band`（枚举：`near`/`mid`/`far`），绝不返回 geohash、经纬度或精确距离数字。
- **去人格化**：响应中不含对方 `last_login_at`、在线状态、真人照片 URL；打捞预览只返回去人格化快照字段。

---

## 2. 端点清单（按领域分组）

权限标记：🔓 公开 | 🔑 需登录 | 🛡️ 守护模式额外校验 | 🚫 隐身态/封禁态受限

---

### 2.1 认证与注册（含年龄门控 / 家长同意）

#### `POST /v1/auth/register` 🔓 [MVP]
注册账号（邮箱/手机/OAuth）。注册即触发协议勾选校验，但**尚不完成年龄档锁定**——年龄声明走独立步骤。

请求：
```json
{
  "channel": "email",
  "email": "rin@example.com",
  "password": "••••••••",
  "agreed_terms": true,
  "agreed_privacy": true,
  "jurisdiction": "HK",
  "locale": "zh-Hant"
}
```
响应（201）：
```json
{
  "code": 0,
  "data": {
    "user": { "public_id": "u_9aZ...", "status": "pending_consent", "age_tier": "unknown" },
    "next_step": "age_gate",
    "access_token": "eyJ...",
    "expires_in": 900
  }
}
```
> `status=pending_consent` 表示尚未通过年龄门控，此时只能访问年龄声明与资料引导接口，业务接口一律 403/40303。

#### `POST /v1/auth/login` 🔓 [MVP]
```json
{ "channel": "email", "email": "rin@example.com", "password": "••••••••" }
```
响应：`access_token` + Set-Cookie(refresh) + `user` + `next_step`（若年龄未确认则 `age_gate`，资料未完成则 `onboarding`，否则 `home`）。

#### `POST /v1/auth/oauth/{provider}` 🔓 [MVP]
`provider ∈ {apple, google}`。请求体携带三方 `id_token`，服务端校验后映射到 `users.oauth_provider/oauth_subject`。

#### `POST /v1/auth/token/refresh` 🔓 [MVP]
基于 HttpOnly Cookie 中 refresh token 换发新 access token。响应仅 `access_token` + `expires_in`。失效返回 40102。

#### `POST /v1/auth/logout` 🔑 [MVP]
将当前 `jti` 入黑名单、删除 refresh 白名单。响应 `code=0`。

#### `POST /v1/auth/age-declaration` 🔑 [MVP]
**年龄门控核心**。提交出生年月（数据最小化，仅年月）。服务端判定 `age_tier` 并锁定 `age_locked_at`，依 `jurisdiction` 决定后续合规分支。

请求：
```json
{ "birth_year": 2010, "birth_month": 5 }
```
响应（判定为 13–17 未成年）：
```json
{
  "code": 0,
  "data": {
    "age_tier": "t1317",
    "age_assurance": "self_declared",
    "guardian_required": true,
    "guardian_mode_forced": true,
    "consent_required": true,
    "next_step": "parental_consent",
    "compliance_notice": "依你所在地区法规（PDPO），未成年用户将开启守护模式并需监护人同意。"
  }
}
```
分支：
- 判定 `a18` → `next_step=onboarding`。
- 判定 `t1317` → 强制 `guardian_mode`，`next_step=parental_consent`（部分法域）或直接 `onboarding`（守护模式开启即可）。
- 判定 `u13` 或低于目标地最低年龄 → 返回 403 / 40302，`data.appeal_url` 提供申诉入口，账号置 `pending_consent` 且不可继续。

> 年龄档一旦落入未成年区间，`age_locked_at` 锁定，前端不可自助上调；上调需走 `age-assurance` 验证。

#### `POST /v1/auth/parental-consent` 🔑🛡️ [MVP]
发起/记录家长同意（对应 `parental_consents` 表，事件 `granted`）。MVP 采用邮箱验证型同意（VPC 的轻量实现），记录 `consent_event`。

请求：
```json
{ "guardian_email": "parent@example.com", "method": "email_verification" }
```
响应：
```json
{ "code": 0, "data": { "consent_id": "pc_01H...", "event": "granted", "status": "pending_verification", "verify_sent": true } }
```
> 监护人点击邮件链接后回调 → 事件落 `granted` 且 `users.age_assurance` 可升级；撤回走 `consent_event=revoked` → 账号回 `pending_consent`、强制下线。

#### `POST /v1/auth/age-assurance` 🔑 [演进预留]
更强年龄保障（信用卡校验 / 第三方身份 / AI 面部估计——估值即弃）。MVP 仅预留端点与 `age_assurance_level` 枚举，不实装第三方。

---

### 2.2 用户资料（自报 MBTI / 兴趣 / 偏好滑杆 / 守护模式 / 隐身）

#### `POST /v1/onboarding/profile` 🔑 [MVP]
首次资料引导一次性提交（昵称 → MBTI → 兴趣 → 偏好滑杆）。对应 `user_profiles`。

请求：
```json
{
  "nickname": "海边的卡夫卡",
  "mbti_type": "INFP",
  "mbti_confidence": "unsure",
  "interest_tags": ["书信", "独立音乐", "散步", "旧书店"],
  "preference_similar_complement": 30,
  "preference_near_far": 60,
  "card_text": "在城市的褶皱里写信。",
  "geo_consent": true,
  "geohash5": "wecnz"
}
```
- `mbti_type` 可为 `null`（不确定/跳过）；`mbti_confidence ∈ {unknown, unsure, confident}`（`verified` 为演进）。自报不可信时服务端在匹配中降权。
- `preference_*` 为 0–100 滑杆值（相似↔互补、就近↔远方）。
- `geohash5`：客户端本地由经纬度截取前 5 位上送，服务端**只存前缀**，原始经纬度绝不上送/落库。`geo_consent=false` 则降级为兴趣+MBTI 匹配。

响应（200）：返回完整 profile（脱敏）。

#### `GET /v1/me` 🔑 [MVP]
获取本人账号 + 资料 + 守护/隐身状态 + 配额摘要。
```json
{
  "code": 0,
  "data": {
    "user": { "public_id": "u_9aZ...", "status": "active", "age_tier": "t1317", "is_invisible": false, "guardian_mode": true },
    "profile": {
      "nickname": "海边的卡夫卡", "mbti_type": "INFP", "mbti_confidence": "unsure",
      "interest_tags": ["书信","独立音乐","散步","旧书店"],
      "preference_similar_complement": 30, "preference_near_far": 60,
      "card_text": "在城市的褶皱里写信。", "distance_band_visible": true
    },
    "quota_today": { "send": 1, "fish": 3, "unseal": 1, "send_used": 0, "fish_used": 1, "unseal_used": 0 }
  }
}
```

#### `PATCH /v1/me/profile` 🔑 [MVP]
局部更新资料（昵称/MBTI/兴趣/偏好/名片文案/重新授权地理）。字段同上，均可选。

#### `GET /v1/profiles/{public_id}` 🔑 [MVP]
查看他人**公开**资料（仅笔友或已拆封对象可见全量；陌生人不可直接查）。返回去人格化卡片，无照片、无活跃状态。非授权关系返回 40401（不泄露存在性）。

#### `PATCH /v1/me/settings/guardian` 🔑🛡️ [MVP]
守护模式设置。未成年账号 `guardian_mode` 为强制开启，**不可关闭**（尝试关闭返回 40304）；成年账号可自愿开启。
```json
{ "guardian_mode": true, "quiet_hours": { "start": "22:00", "end": "07:00" } }
```

#### `PATCH /v1/me/settings/visibility` 🔑 [MVP]
隐身（闭关）开关。开启后不进入新匹配/不被打捞，已结缘笔友往来不受影响。
```json
{ "is_invisible": true }
```
响应更新 `users.is_invisible` 与 `account_status=invisible`。

#### `PATCH /v1/me/settings/notifications` 🔑 [MVP]
通知节奏设置（信件抵达/笔友回信/弱通知开关、安静时段）。

#### `POST /v1/me/export` 🔑 [MVP]
GDPR 数据导出请求（异步生成）。返回 `request_id`，完成后通过通知/邮件发下载链接。

#### `DELETE /v1/me` 🔑 [MVP]
账号注销（GDPR/COPPA 删除权）。落 `data_deletion_requests(status=requested)` + `users.deleted_at` 软删，触发物理删除作业。响应 `code=0` 并使所有 token 失效。

---

### 2.3 写信投递

#### `POST /v1/letters/draft` 🔑 [MVP]
保存草稿（状态 `draft`）。可多次更新（同一 draft_id `PATCH`）。
```json
{ "paper_style": "kraft", "body": "你好，陌生人……", "mood_tag": "微醺的夜" }
```
响应：`{ "letter": { "public_id": "lt_01H...", "status": "draft", "version": 0 } }`

#### `POST /v1/letters/{public_id}/submit` 🔑🛡️🚫 [MVP]
**投递**（封缄寄出）。核心卡点：先入审核态，不直接入池。需 `Idempotency-Key`。

流程：校验当日投递配额（`daily_quotas`，1/日）→ 状态 `draft→reviewing` → 同步触发机器审核（秒级）→ 通过则 `reviewing→in_transit` 并创建 `delivery_tasks`（按 `geohash5` 距离粗档决定 `delivery_vehicle` 与时延）→ 审核高危则 `reviewing→rejected`。

请求（可空，内容已在草稿）：`{ }`
响应（审核通过，进入在途）：
```json
{
  "code": 0,
  "data": {
    "letter": { "public_id": "lt_01H...", "status": "in_transit", "version": 1 },
    "delivery": { "vehicle": "horse", "distance_band": "far", "eta_band": "2-3天", "delivery_task_id": "dt_01H..." },
    "quota": { "send_used": 1, "send_limit": 1 }
  }
}
```
响应（审核拦截，422 / 42201 或 42202）：
```json
{
  "code": 42202,
  "message": "信里似乎写了联系方式，漂流邮局不传递它们。修改后可重新投递。",
  "data": { "letter_status": "rejected", "categories": ["contact_info"], "can_resubmit": true }
}
```
配额耗尽（429 / 42901）：`data.quota` 返回 `{ "send_used": 1, "send_limit": 1, "reset_at": "明日 00:00 当地" }`。

> **审核异步降级**：若机器审核服务超时/不可用，状态停留 `reviewing`，由异步队列补审；前端 `我的信件` 显示"邮局正在分拣"。审核完成通过 WebSocket 推送状态变更（见 §5）。

#### `GET /v1/letters/{public_id}` 🔑 [MVP]
查看自己某封信详情（含状态、递送进度、是否被打捞——但**不透露**被谁打捞、不透露"已读"）。

---

### 2.4 漂流海打捞

#### `POST /v1/ocean/fish` 🔑🛡️🚫 [MVP]
**打捞一封漂流信**。核心动作，强配额 + 匹配 + 去重。需 `Idempotency-Key`。

流程（见 §4 时序）：校验隐身/守护态 → 校验当日打捞配额（3/日）→ 匹配引擎按"地理就近 + 兴趣 Jaccard + MBTI 离散相容 + 同圈层随机"从 `drifting` 池选信 → 排除自己投递的、已打捞过的（`fishing_records` 唯一约束）、已拉黑双向的 → 选中信状态 `drifting→previewing` 并加 Redis 预览锁（10 分钟）→ 落 `fishing_records` + 冻结 `preview_snapshots`。

请求：`{ }`（匹配由服务端决策，客户端不指定捞哪封）
响应（200）：
```json
{
  "code": 0,
  "data": {
    "fishing_id": "fr_01H...",
    "preview": {
      "letter_public_id": "lt_77K...",
      "author_card": {
        "nickname": "雾港的信号灯",
        "mbti_type": "ENFJ",
        "mbti_confidence": "confident",
        "interest_tags_preview": ["航海", "爵士"],
        "distance_band": "mid"
      },
      "body_preview": "如果你也在某个失眠的夜里点过这盏灯……",
      "mood_tag": "潮湿的温柔",
      "preview_lock_expires_at": "2026-06-14T08:40:00Z",
      "preview_lock_seconds": 600
    },
    "quota": { "fish_used": 2, "fish_limit": 3 }
  }
}
```
- `body_preview` 仅前 2–3 行（服务端截断后存入 `preview_snapshots`，对外只读此快照）。
- 绝不返回作者 `public_id`、照片、精确距离。
- 池中无可捞信（429 不适用，返回 200 + 空）：
```json
{ "code": 0, "data": { "fishing_id": null, "preview": null, "message": "此刻海面平静，稍后再来打捞。", "quota": { "fish_used": 2, "fish_limit": 3 } } }
```
> **注意**：即使无信可捞，是否消耗配额由产品决策——MVP 约定"成功捞到才计数"，空捞不扣（落地于流程：先匹配成功再写 `daily_quotas`）。

配额耗尽：429 / 42901。

---

### 2.5 打捞预览

#### `GET /v1/fishing/{fishing_id}/preview` 🔑 [MVP]
重新拉取某次打捞的预览快照（从 `preview_snapshots` 读，不重新生成）。返回剩余预览锁时间。锁已过期则 `data.expired=true`，信已回池。

#### `POST /v1/fishing/{fishing_id}/release` 🔑 [MVP]
**放回海面**（主动放弃）。状态 `previewing→drifting`，释放 Redis 预览锁。打捞次数已消耗不退还。
```json
{ "code": 0, "data": { "released": true, "letter_status": "drifting" } }
```

---

### 2.6 拆封

#### `POST /v1/fishing/{fishing_id}/unseal` 🔑🛡️🚫 [MVP]
**拆开火漆封印**。最关键并发动作：Redis 原子锁 + DB 乐观锁双保险。需 `Idempotency-Key`。

流程（见 §4）：校验当日拆封配额（1/日）→ Redis 原子锁 `unseal:{letter_id}` 抢占 → DB CAS 更新 `UPDATE letters SET status='unsealed', version=version+1 WHERE id=? AND status='previewing' AND version=?` → 成功则落 `unseal_records`、信进"暂离池"（不可被他人打捞）、启动 7 天回信窗口（`reply_deadline_at = now()+7d`，并向 RabbitMQ 投延时回池任务）。

请求：`{ }`
响应（200）：
```json
{
  "code": 0,
  "data": {
    "unseal_id": "us_01H...",
    "letter": {
      "public_id": "lt_77K...",
      "status": "unsealed",
      "body": "如果你也在某个失眠的夜里点过这盏灯，那么我想，我们或许走过同一片雾……（全文）",
      "author_card": {
        "nickname": "雾港的信号灯", "mbti_type": "ENFJ",
        "interest_tags": ["航海","爵士","老电影"], "distance_band": "mid",
        "card_text": "守着一座没有船的港。"
      }
    },
    "reply_window": { "deadline_at": "2026-06-21T08:35:00Z", "days_left": 7 },
    "quota": { "unseal_used": 1, "unseal_limit": 1 }
  }
}
```
失败（并发抢锁失败 / 状态已变 → 409 / 40901）：
```json
{ "code": 40901, "message": "这封信刚刚有了新的去向，换一封试试吧。", "data": { "letter_status": "drifting" } }
```
配额耗尽：429 / 42901。预览锁已过期信已回池：423 / 42301。

---

### 2.7 回信（7 天窗口）

#### `POST /v1/unseals/{unseal_id}/reply` 🔑🛡️🚫 [MVP]
**提笔回信**。审核卡点同投递：先入审核态。需 `Idempotency-Key`。

流程：校验 `unseal_records` 在 7 天窗口内（`reply_deadline_at > now()` 且未超时回池）→ 审核（`content_reviews`，多态目标=correspondence）→ 通过则**结缘**：创建 `pen_pal_relations`（规范化 `user_low/user_high`，状态 `active`），创建首封 `correspondences`，原信状态 `unsealed→paired`，取消 RabbitMQ 回池任务，按距离创建在途递送 → 高危则 `rejected`，不结缘。

请求：
```json
{ "body": "我也守过一盏灯，在另一座海的对岸。很高兴遇见你。", "paper_style": "linen" }
```
响应（200，结缘成功）：
```json
{
  "code": 0,
  "data": {
    "paired": true,
    "relation": { "public_id": "rel_01H...", "status": "active", "pen_pal": { "public_id": "u_pal...", "nickname": "雾港的信号灯", "distance_band": "mid" } },
    "correspondence": { "public_id": "co_01H...", "status": "in_transit", "delivery": { "vehicle": "horse", "eta_band": "2-3天" } },
    "letter_status": "paired"
  }
}
```
失败（窗口已过 → 409 / 40901）：
```json
{ "code": 40901, "message": "回信潮汐已退，这封信已重新漂回海面。", "data": { "letter_status": "re_drifting" } }
```
审核拦截：422 / 42201。

---

### 2.8 笔友关系与信匣

#### `GET /v1/penpals` 🔑 [MVP]
笔友列表（`pen_pal_relations` 状态 `active`）。游标分页。每项含对方去人格化卡片、最近一封往来摘要（**无"已读"、无对方在线**）、是否有在途新信。
```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "relation_public_id": "rel_01H...",
        "pen_pal": { "public_id": "u_pal...", "nickname": "雾港的信号灯", "mbti_type": "ENFJ", "distance_band": "mid" },
        "latest_excerpt": "我也守过一盏灯……",
        "has_incoming_in_transit": true,
        "paired_at": "2026-06-14T08:36:00Z"
      }
    ],
    "page": { "next_cursor": null, "has_more": false, "limit": 20 }
  }
}
```

#### `GET /v1/penpals/{relation_public_id}/letters` 🔑 [MVP]
某笔友的往来书信（`correspondences`），按时间顺序，游标分页。**不返回 read_at**。在途的信对收件方不可见正文，仅显示"信鸽在路上"。
```json
{
  "code": 0,
  "data": {
    "items": [
      { "public_id": "co_01H...", "direction": "outgoing", "status": "delivered", "body": "我也守过一盏灯……", "delivered_band": "已抵达" },
      { "public_id": "co_02H...", "direction": "incoming", "status": "in_transit", "body": null, "delivery": { "eta_band": "约1天", "vehicle": "pigeon" } }
    ],
    "page": { "next_cursor": null, "has_more": false, "limit": 30 }
  }
}
```

#### `POST /v1/penpals/{relation_public_id}/letters` 🔑🛡️🚫 [MVP]
给笔友回一封（保留在途延迟）。审核卡点同投递。请求 `{ "body": "...", "paper_style": "..." }`。响应返回新 `correspondence`（状态 `in_transit` + 递送档）。注意：**笔友往来不消耗每日 投/捞/拆 配额**（MVP 约定笔友往来不限于每日 1 投，但可设独立频控防刷，见 §6）。

#### `GET /v1/penpals/{relation_public_id}` 🔑 [MVP]
关系详情 + 对方完整公开资料（已结缘可见全量卡片，仍无照片/无活跃态）。

#### `POST /v1/penpals/{relation_public_id}/archive` 🔑 [MVP]
归档/拉黑笔友（状态 `active→archived` 或 `blocked`）。拉黑后会话归档、双向不再匹配/往来。
```json
{ "action": "block" }
```

---

### 2.9 我的信件列表（在途 / 已送达 / 已结缘）

#### `GET /v1/letters` 🔑 [MVP]
我寄出的信，按状态筛选。游标分页。
查询参数：`?tab=in_transit|delivered|paired&cursor=...&limit=20`
- `in_transit`：状态 `in_transit`，返回递送动画所需粗档进度。
- `delivered`：已漂入海面（`drifting`）或被打捞（`previewing`/`unsealed`）——**统一去人格化**为"已送达远方"，不透露被谁打捞、不透露是否被拆封到具体人。
- `paired`：状态 `paired`，跳转对应笔友关系。

响应：
```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "public_id": "lt_01H...",
        "status": "in_transit",
        "display_state": "信鸽振翅",
        "delivery": { "vehicle": "pigeon", "distance_band": "near", "progress_band": "途中", "eta_band": "约半天" },
        "created_band": "今天寄出"
      }
    ],
    "page": { "next_cursor": "...", "has_more": true, "limit": 20 }
  }
}
```
> `delivered` 标签项不暴露 `fishing_records`/打捞者信息，仅 `display_state: "已漂向远方"` 或 `"已被有缘人拾起"`（模糊、不可定位到人）。

---

### 2.10 每日配额查询

#### `GET /v1/quota/today` 🔑 [MVP]
查询当日 投/捞/拆 配额（`daily_quotas`，按用户当地日界）。
```json
{
  "code": 0,
  "data": {
    "quota_date": "2026-06-14",
    "send":   { "limit": 1, "used": 0, "remaining": 1 },
    "fish":   { "limit": 3, "used": 1, "remaining": 2 },
    "unseal": { "limit": 1, "used": 0, "remaining": 1 },
    "reset_at": "2026-06-15T00:00:00+08:00"
  }
}
```
> 配额计数以 Redis 为准（原子 `INCR` + 当日 TTL），`daily_quotas` 表为持久化镜像。日界按用户 `jurisdiction`/时区。

---

### 2.11 举报 / 拉黑 / 申诉

#### `POST /v1/reports` 🔑 [MVP]
举报一封信或一个笔友往来（`reports`，多态目标）。
```json
{ "target_type": "letter", "target_public_id": "lt_77K...", "category": "harassment", "detail": "言语骚扰" }
```
响应：`{ "report_id": "rp_01H...", "status": "open" }`。`category` 用 `review_category` 枚举。涉 `sexual_minor`/`grooming`/`self_harm` 走加急通道（见 §6）。

#### `POST /v1/blocks` 🔑 [MVP]
拉黑某用户（退回邮局）。`{ "target_public_id": "u_pal..." }`。落 `blocks`，双向不再匹配/打捞/往来。

#### `DELETE /v1/blocks/{target_public_id}` 🔑 [MVP]
取消拉黑。

#### `GET /v1/blocks` 🔑 [MVP]
我的拉黑列表。

#### `POST /v1/appeals` 🔑 [MVP]
申诉（针对处罚 `penalties` 或被拒内容 `rejected`、或年龄门控婉拒）。
```json
{ "target_type": "penalty", "target_id": "pn_01H...", "reason": "误判，我并未发送联系方式。" }
```
响应：`{ "appeal_id": "ap_01H...", "status": "open" }`。

#### `GET /v1/me/penalties` 🔑 [MVP]
查看自己当前处罚状态（禁言/降权/守护锁等，`penalties`），用于"安全中心"展示与申诉。

---

### 2.12 通知

#### `GET /v1/notifications` 🔑 [MVP]
通知列表（信件抵达、笔友回信抵达、被打捞弱通知、审核结果、处罚/申诉结果、家长同意结果），游标分页。**弱通知**遵循去人格化（"有人拾起了你的一封信"，不透露是谁）。
```json
{
  "code": 0,
  "data": {
    "items": [
      { "public_id": "nt_01H...", "type": "letter_fished", "title": "有人在海面拾起了你的一封信", "ref": { "letter_public_id": "lt_01H..." }, "created_band": "刚刚", "read": false },
      { "public_id": "nt_02H...", "type": "penpal_reply_arrived", "title": "雾港的信号灯回信抵达", "ref": { "relation_public_id": "rel_01H..." }, "created_band": "1天前", "read": false }
    ],
    "page": { "next_cursor": null, "has_more": false, "limit": 20 }
  }
}
```
> 此处 `read` 仅指**本人对系统通知**的已读态（用于红点），与"信件已读"无关——信件永不显示已读。

#### `POST /v1/notifications/read` 🔑 [MVP]
批量标记通知已读：`{ "ids": ["nt_01H...", "nt_02H..."] }` 或 `{ "all": true }`。

---

## 3. 关键时序与状态机（API 视角）

### 3.1 信件状态机（与数据库 `letter_status` 一致）

```
draft ──submit──► reviewing ──pass──► in_transit ──(delivery_task到时)──► drifting
  ▲                   │                                                      │
  │                   └──high/block──► rejected                              │ fish
  │                                                                          ▼
  └──(can_resubmit)                                                     previewing
                                                                    (Redis预览锁10min)
                                       release / 锁超时 ◄──────────────────┤
                                            │                              │ unseal(CAS)
                                            ▼                              ▼
                                         drifting ◄──reply超时回池──── unsealed
                                                                    (7天回信窗,暂离池)
                                                                           │ reply(pass)
                                                                           ▼
                                                                        paired
```

### 3.2 打捞 → 预览锁 → 拆封（并发 + 配额）时序

```
Client                API/Quota                 Redis                    PostgreSQL
  │  POST /ocean/fish    │                         │                         │
  ├─────────────────────►│ 检查 is_invisible/守护  │                         │
  │                      ├─INCR fish:{u}:{date}────►│ (>limit? 回滚→42901)    │
  │                      ├─匹配引擎选信(排除自投/已捞/互黑)──────────────────►│ SELECT ... drifting
  │                      │  SETNX preview:{letter} ►│ (抢预览锁,TTL=600s)     │
  │                      ├─CAS: drifting→previewing ─────────────────────────►│ UPDATE WHERE status,version
  │                      ├─INSERT fishing_records (uniq u+letter) ────────────►│
  │                      ├─INSERT preview_snapshots(去人格化截断) ────────────►│
  │◄─preview + lock_exp──┤                         │                         │
  │                      │                         │                         │
  │ POST /unseal         │                         │                         │
  ├─────────────────────►│ INCR unseal:{u}:{date}  │ (>1? →42901)            │
  │                      ├─SETNX unseal:{letter}───►│ (抢拆封原子锁)          │
  │                      ├─CAS: previewing→unsealed ────────────────────────►│ UPDATE WHERE status='previewing' AND version=?
  │                      │   (影响0行→40901 状态已变)                          │
  │                      ├─INSERT unseal_records, reply_deadline=now+7d ──────►│
  │                      ├─MQ.publish(回池延时任务,7d) ─►RabbitMQ              │
  │◄─全文+7天窗口────────┤                         │                         │
```

要点：
- **双保险**：Redis `SETNX` 先挡住绝大多数并发；DB `WHERE status=? AND version=?` 的 CAS 是最终真相源，影响 0 行即返回 40901。
- **配额回滚**：若匹配/CAS 失败，已 `INCR` 的配额需 `DECR` 回补（或采用"成功后才计数"的两段式：先匹配成功再计数，MVP 采用后者更稳）。
- **预览锁超时**：Redis key 自然过期 + 一个兜底扫描作业把 `previewing` 超 10min 的信改回 `drifting`（防 Redis 与 DB 漂移）。

### 3.3 7 天回信窗口

- 拆封时写 `unseal_records.reply_deadline_at = now()+7d`，并向 RabbitMQ 投 7 天延时消息。
- 回信成功（`/reply` 通过审核）→ 消费方校验仍在窗口内 → 结缘、取消/忽略延时任务。
- 7 天到期延时消息触发 → 若仍 `unsealed` 未回信 → `unsealed→re_drifting`（回池重漂），给拆封者发温和通知，关系不建立。
- 查询：`GET /v1/unseals/{unseal_id}` 返回 `reply_window.days_left`、`deadline_at`、`expired`。

### 3.4 递送在途状态查询

- `delivery_tasks` 记录 `vehicle`/`scheduled`/到时改 `delivered` 并把信 `in_transit→drifting`（投递信）或落入笔友信匣（往来信）。
- 客户端轮询 `GET /v1/letters/{id}` 或 `GET /v1/letters?tab=in_transit` 拿 `progress_band`/`eta_band` 粗档（不暴露精确剩余秒数，维持"慢"的世界观）；到达由 WebSocket 推送。

---

## 4. WebSocket / 实时事件

> 实时通道用于推送状态变更，**不破坏"慢"与去人格化原则**：仅推"抵达类"事件，不推在线状态、不推"对方正在写"。

### 4.1 连接

```
wss://api.inkling.app/v1/ws?token=<access_token>
```
- 鉴权：连接握手用 access token（query 或 `Sec-WebSocket-Protocol`）。失效推 `auth.expired` 后断开，客户端刷新重连。
- 心跳：服务端 30s `ping`，客户端 `pong`；漏 2 次断开。
- 降级：WebSocket 不可用时，客户端回退到轮询 `GET /v1/notifications`（弱网/PWA 后台态）。

### 4.2 事件消息格式

```json
{
  "event": "penpal.reply_arrived",
  "ts": "2026-06-15T03:00:00Z",
  "data": { "relation_public_id": "rel_01H...", "correspondence_public_id": "co_02H...", "preview_excerpt": "我也守过一盏灯……" }
}
```

### 4.3 事件清单 [MVP]

| event | 触发 | data 关键字段 | 去人格化约束 |
|---|---|---|---|
| `letter.delivered` | 投递的信到达漂流海（在途结束） | `letter_public_id` | 不含打捞者信息 |
| `letter.fished` | 自己投递的信被人打捞（弱通知） | `letter_public_id` | **不透露**打捞者身份 |
| `penpal.reply_arrived` | 笔友回信经在途后抵达 | `relation_public_id`, `correspondence_public_id`, `preview_excerpt` | 不含 read/在线 |
| `unseal.reply_window_warning` | 自己拆封的信回信窗口剩 1 天 | `unseal_id`, `days_left` | — |
| `unseal.expired_redrift` | 7 天未回信，信回池 | `unseal_id`, `letter_public_id` | 温和文案 |
| `review.result` | 投递/回信审核异步完成 | `target_type`, `target_public_id`, `risk_level` | 仅本人可见 |
| `paired.success` | 回信成功结缘（双方收到） | `relation_public_id`, `pen_pal_card` | 卡片去人格化 |
| `safety.penalty` | 收到处罚/守护锁定 | `penalty_type`, `appeal_url` | 仅本人 |
| `consent.result` | 家长同意验证结果 | `event`(`granted`/`revoked`) | — |

> **[演进预留]** `event: ai_warm_letter`（AI 暖场信抵达）、稀有递送掉落事件等不在 MVP。

---

## 5. 内容审核在 API 流程中的卡点

**核心原则：所有用户生成内容（投递信、回信、笔友往来）必须"先入审核态，再异步/秒级决策，方可入池/送达"，绝不直接公开。**

### 5.1 卡点位置

| 入口端点 | 卡点 | 审核目标(多态) | 通过后 | 拦截后 |
|---|---|---|---|---|
| `POST /letters/{id}/submit` | `draft→reviewing` | letter | `→in_transit` 入池 | `→rejected`，`can_resubmit` |
| `POST /unseals/{id}/reply` | 回信入审核 | correspondence | 结缘 + 在途 | `rejected`，不结缘 |
| `POST /penpals/{rel}/letters` | 往来入审核 | correspondence | 在途送达 | `rejected` |

### 5.2 审核流程（秒级同步 + 异步兜底）

1. 提交即创建 `content_reviews` 记录（`risk_level` 初始 `pass` 占位，目标多态指向 letter/correspondence）。
2. **同步**调机器审核（秒级），命中 `review_category`：
   - `pass`/`low` → 放行（low 记录证据、不阻断）。
   - `mid` → 放行但匹配降权 / 记录，或要求修改（产品可配）。
   - `high`/`block` → 立即拦截，HTTP 422 / 42201（或 42202 联系方式），内容置 `rejected`，证据脱敏存 `content_reviews`。
3. **零容忍类别**（`sexual_minor`/`grooming`/`self_harm`）→ 直接 `block` + 触发安全加急通道（`penalties`/危机干预文案/必要时上报），且**无论年龄档**强制拦截。
4. **联系方式检测**（`contact_info`）单列：命中即拦，文案"漂流邮局不传递联系方式"。
5. **异步兜底**：审核服务超时 → 内容停留 `reviewing`，进异步队列补审；前端显示"邮局正在分拣"；补审结果经 WebSocket `review.result` 推送。审核不可用超阈值 → 50301 降级文案，禁止入池（安全优先，宁可不发不可错发）。

### 5.3 未成年审核增强 🛡️

- `age_tier ∈ {t1317, unknown}` 或 `guardian_mode=true` 的用户，审核阈值收紧（`mid` 即拦），且对方为成年人时双向加严。
- 命中 `grooming` 类别对未成年方零容忍，立即拦截 + `penalty_type=guardian_lock` 评估。

---

## 6. 安全要点

### 6.1 限流（Rate Limiting）

- **网关层全局限流**：按 `public_id` + IP 令牌桶。匿名接口（注册/登录/验证码）更严：登录 5 次/分钟，验证码 1 次/60s。
- **动作级业务配额**：投/捞/拆 由 `daily_quotas` + Redis 原子计数硬限（非限流，是业务规则）。
- **笔友往来频控**：虽不占每日配额，但设独立频控（如 30 封/天/关系）防刷，超限 429 / 42902 + `Retry-After`。
- **写动作幂等**：`Idempotency-Key` 防弱网重复（投递/打捞/拆封/回信）。
- 限流响应统一 429 / 42902，带 `Retry-After` 秒数。

### 6.2 未成年接口限制 🛡️

- Token 内嵌 `age_tier`/`guardian`，网关对未成年账号：
  - 强制守护模式，`PATCH /me/settings/guardian` 关闭操作返回 40304。
  - 安静时段（`quiet_hours`）内抑制非紧急 WebSocket 推送与通知。
  - 审核阈值收紧（见 §5.3）。
  - `pending_consent` 状态下除资料/同意接口外全部 40303。
- `age-declaration` 判定 `u13`/低于法域门槛 → 直接拒绝进入（40302），仅留申诉。
- 数据最小化：年龄只收年月；面部年龄估计（演进）估值即弃不落库。

### 6.3 地理粗粒度返回

- 服务端**只存 `geohash5`**（±2.4km），API 对外**只返回 `distance_band`**（`near`/`mid`/`far`），绝不返回 geohash、经纬度或精确公里数。
- 匹配/递送档位在服务端内部用 geohash 邻接计算，结果只暴露粗档。
- 客户端上送 geohash5（本地截取），原始经纬度永不上送/落库。

### 6.4 不泄露拒绝者 / 打捞者身份（去人格化保护）

- 信被打捞 → 投递者仅收到弱通知"有人拾起了你的信"，**不返回打捞者 `public_id`/卡片**。
- 信被放回 / 拆封后 7 天未回信 → 投递者不知道是谁、为何放回；拆封者 7 天超时也只得到温和文案，不暴露对方拒绝意图。
- 陌生人资料 `GET /profiles/{id}` 对非授权关系返回 40401（不区分"不存在"与"无权"，防枚举探测）。
- 拉黑/被拉黑 → 双向不可见、不可匹配，被拉黑方**不被告知**（避免针对性骚扰）。
- 所有响应不含 `last_login_at`、在线态、"正在输入"、"已读"——数据库层即无这些可外泄字段。

### 6.5 其他

- 所有写接口校验 `account_status`：`suspended`/`banned`→40301；`invisible` 态下投递/打捞/被捞受限（40305，按产品：隐身仅"不被捞"，本人仍可捞——以产品决策为准）。
- 敏感操作（注销、家长同意撤回）二次确认 + 强制下线（token 黑名单）。
- 审核命中证据脱敏存储；举报涉零容忍类别加急人工复核。

---

## 7. MVP 与演进对照（接口层面）

| 能力 | MVP | 演进预留 |
|---|---|---|
| 鉴权 | JWT 双 Token | 多设备会话、生物识别 |
| 年龄保障 | 自声明 + 邮箱型家长同意 | 信用卡/第三方ID/面部估计（`age-assurance` 端点已留） |
| 匹配 | 地理就近+兴趣Jaccard+MBTI离散相容+同圈层随机 | 向量召回（pgvector）、偏好滑杆精调 |
| MBTI | 自报+可信度降权 | mini-test 校准（`mbti_confidence=verified`） |
| 递送 | 固定/粗档时延（pigeon/horse） | 稀有递送掉落、真实路网时延 |
| 经济/装扮 | 无 | 墨滴/笔友值/真诚徽印/装扮矩阵（独立领域端点） |
| 关系仪式 | 无 | 信缘博物馆、AI 暖场信（`ai_warm_letter` 事件） |
| 实时 | 抵达类弱通知 | 更多事件类型（保持去人格化） |

---

以上为《信逢 Inkling · MVP API 接口设计 v1.0》完整内容。端点路径、字段名、ENUM 取值均与《MVP 数据库设计》保持一致（`letter_status`/`review_category`/`age_tier`/`delivery_vehicle` 等），对外标识统一用 `public_id`，全程贯彻"永不已读、地理粗档、去人格化、未成年保护、审核先行"五大铁律。
