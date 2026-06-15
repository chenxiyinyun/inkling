# 信逢-Inkling《自报MBTI处理与MVP匹配落地》

> 适用阶段：细化设计（不写业务代码）；技术栈 PostgreSQL16(PostGIS/JSONB) + Redis + RabbitMQ；MVP 不上 pgvector，纯规则 + SQL。
> 设计原则：宁可"够用且可解释"，不追求"精准"。匹配只服务于"打捞候选召回 + 精排"，不是强配对，serendipity（偶遇感）优先于命中率。

---

## 0. 总览：匹配在状态机里的两个触点

慢社交的匹配不发生在"投递时给信找人"，而发生在 **打捞时给人找信**。整条链路只有两处需要算法：

| 触点 | 时机 | 算法职责 | 计算预算 |
|---|---|---|---|
| **投递时分桶** | 信件通过审核 → 入漂流海 | 给信打标签、写入倒排桶（粗筛维度：geo / 兴趣 / MBTI 兴趣偏好），便于后续快速召回 | 离线/异步，毫秒级写 |
| **打捞时精排** | 用户点"打捞"（每日3次） | 从候选池召回 N 封 → 相容打分排序 → 注入随机 → 返回 1 封 | 实时，目标 <200ms |

记住：用户一次打捞只拿 **1 封**（每日上限3捞）。所以精排不是"排一页列表"，而是"从候选里挑 1 封且不能每次都挑同一类"。这决定了 serendipity 和反霸屏是 MVP 必需而非锦上添花。

---

## 1. 自报 MBTI 的产品与数据处理

### 1.1 录入流程

不做测评。注册引导页 + 个人资料页均可设置。三段式：

1. **16型选择器**：4 维二选一拼装（E/I · S/N · T/F · J/P），实时拼出型号并显示中文俗称（如 INFP=调停者）。避免一次性甩 16 个卡片造成选择瘫痪。
2. **"不确定/未知"选项**：作为第一公民，不是藏在角落。提供三档自我确定度，落库为 `mbti_confidence`：
   - `unknown`：完全不知道 / 没测过
   - `unsure`：大概是 XXXX，但不确定
   - `confident`：很确定就是 XXXX
3. **可选一句话说明**：`mbti_note`，≤30字，纯展示用（出现在名片"半张"里），**不参与算法**。例："I人但话痨""测过两次都不一样"。

> 关键产品决策：**不强制填 MBTI**。空着也能完成注册，匹配自动退化为"兴趣+地理"。MBTI 是加分项不是门槛，符合"真诚纯粹"调性。

### 1.2 缺失/未知型号的匹配处理

核心思路：**MBTI 只是打分的一项，缺失就把这一项的权重转移给兴趣+地理**，而不是给 0 分或拒绝匹配。

```
有效 MBTI 判定：mbti_type ∈ 16型 且 mbti_confidence != 'unknown'
```

三种退化策略（按权重重分配实现，见 §2.3）：

| 双方状态 | MBTI 项处理 |
|---|---|
| 双方都有效 | 正常查表打分 × confidence 系数 |
| 一方缺失/unknown | MBTI 项给 **中性分 0.5**，并将其权重的一半转移给兴趣项（避免缺失方系统性吃亏） |
| 双方都缺失 | MBTI 项整体移除，归一化到"纯兴趣+地理"打分 |

**自报不可信降权**：`confidence` 直接作为 MBTI 子分的乘法系数：

```
conf_factor = { confident: 1.0, unsure: 0.7, unknown: 0.0(走缺失分支) }
两人取较小值：pair_conf = min(conf_a, conf_b)
mbti_score_final = mbti_raw_score * pair_conf + 0.5 * (1 - pair_conf)
```

即：越不确定，MBTI 子分越向中性 0.5 收敛——不确定的人不会因为"碰巧型号互补"被强配，也不会因为"碰巧型号冲突"被错杀。

### 1.3 自报不可信问题 & "可选 mini-test 校准"演进设计

**问题本质**：自报 MBTI 噪声大（社交期望偏差、网红型号扎堆、记错型号）。MVP 用 `confidence` 降权扛过去，**不投入测评成本**。

**演进路线（非 MVP）**：

- **Phase 2 — 可选 8~12 题 mini-test**：用户主动点"校准我的型号"。出分后给出 `mbti_test_type` 与 `mbti_test_score`（每维度 -100~+100 的连续值，可后续喂 pgvector）。测过的人 `confidence` 升级为 `verified`（conf_factor=1.1，轻微加成，鼓励校准但不歧视没测的人）。
- **Phase 2 — 自报-测评一致性回填**：若自报与测评型号不符，UI 温和提示"你自报 INFP，校准结果偏 INTP，要更新吗"，由用户决定，不强改。
- **Phase 3 — 行为隐式校正**：用回信行为（回谁、回得快慢）做隐式画像，向量化后进 pgvector，MBTI 从"硬查表"过渡为"软相似度"。MVP 阶段把 `mbti_test_score` 四维连续值字段先留好，避免将来迁移痛。

---

## 2. MVP 匹配的可落地规则（规则 + SQL，无 pgvector）

### 2.1 用户/信件特征（精排输入）

| 特征 | 来源 | 类型 | 存储 |
|---|---|---|---|
| 自报 MBTI | 用户资料 | 离散16型 + confidence | `mbti_type CHAR(4)`, `mbti_confidence` |
| 兴趣标签 | 用户资料 | 集合（受控词表 id） | `interest_tags INT[]` / JSONB |
| 地理 | 注册定位 | GeoHash5（±2.4km） | `geohash5 CHAR(5)` |
| 偏好滑杆 | 用户设置 | 0~100 三根 | `pref_similarity`,`pref_distance`,`pref_serendipity` |

信件继承作者的上述特征快照（写时落库到信件行，避免精排时回查作者表 + 防作者改资料后历史信错乱）。

### 2.2 相容打分公式（总分 0~1）

四项加权和，权重受偏好滑杆调制（§4）：

```
Score(reader, letter) =
      w_mbti * S_mbti          // MBTI 离散相容，0~1
    + w_interest * S_interest  // 兴趣 Jaccard，0~1
    + w_geo * S_geo            // 地理就近，0~1
    + w_fresh * S_fresh        // 新信扶持，0~1（公平性项）
    + ε_random                 // serendipity 随机扰动
```

**默认权重**（双方 MBTI 都有效时）：

```
w_mbti = 0.30, w_interest = 0.40, w_geo = 0.20, w_fresh = 0.10
```

**各子分定义**：

- **S_interest（兴趣 Jaccard）**
  ```
  S_interest = |tags_a ∩ tags_b| / |tags_a ∪ tags_b|
  双方都空 → 0.3（中性偏低，不鼓励但不封杀）
  ```

- **S_geo（地理就近，GeoHash5 前缀匹配）**
  注意"真实距离决定递送速度"是递送层职责；匹配层只做粗就近。用 GeoHash 公共前缀长度近似距离：
  ```
  共享前缀长度 L (0~5):  S_geo = L / 5
  示例：同 geohash5 → 1.0；共享前4位 → 0.8；完全不同 → 0.0
  ```
  但偏好"远方陌生人"的用户会把 w_geo 调低甚至反转（§4）。

- **S_mbti**：见 §3 查表，再乘 confidence 系数（§1.2）。

- **S_fresh（新信扶持）**：见 §6。
  ```
  age_h = 信件入池小时数
  S_fresh = clamp(1 - age_h / 72, 0, 1)   // 72h 内线性衰减扶持
  ```

- **ε_random**：见 §4.3。

### 2.3 缺失 MBTI 时的权重重分配（落地公式）

```
if 双方都缺失:
    w_interest += w_mbti; w_mbti = 0
elif 一方缺失:
    w_interest += w_mbti * 0.5
    w_mbti     *= 0.5      // 保留一半 MBTI 权重给中性分
# 之后对 w_* 归一化使其和恒为 1（fresh 项除外可外加）
```

### 2.4 打捞候选召回与排序（SQL/伪代码）

**两阶段：召回（粗，倒排桶/索引）→ 精排（细，应用层打分）**

**召回 SQL**（PostgreSQL，候选限 ~200 封后内存精排）：

```sql
-- 入参: :uid, :geohash5, :tags(int[]), :geo_prefix3 (geohash5 前3位)
WITH candidate AS (
  SELECT l.id, l.author_id, l.mbti_type, l.mbti_confidence,
         l.interest_tags, l.geohash5, l.pooled_at,
         -- 兴趣交集数（GIN 索引加速 &&）
         cardinality(l.interest_tags & :tags) AS tag_overlap,
         -- 地理前缀共享长度（粗）
         CASE
           WHEN l.geohash5 = :geohash5 THEN 5
           WHEN left(l.geohash5,4)=left(:geohash5,4) THEN 4
           WHEN left(l.geohash5,3)=left(:geohash5,3) THEN 3
           ELSE 0 END AS geo_prefix_len
  FROM letters l
  WHERE l.status = 'drifting'              -- 在漂流海可打捞
    AND l.author_id <> :uid                -- 不捞自己
    AND l.id NOT IN (                       -- 不重复捞（看过/捞过/拆过）
        SELECT letter_id FROM user_letter_seen WHERE user_id = :uid)
    AND NOT EXISTS (                        -- 不捞已拉黑作者
        SELECT 1 FROM user_block b
        WHERE b.user_id=:uid AND b.blocked_id=l.author_id)
    -- 粗召回门槛：地理近 OR 有兴趣交集 OR 新信（保证池子不空）
    AND ( left(l.geohash5,3) = :geo_prefix3
          OR l.interest_tags && :tags
          OR l.pooled_at > now() - interval '24 hours' )
)
SELECT * FROM candidate
ORDER BY (tag_overlap * 2 + geo_prefix_len) DESC,   -- 粗排只为截断
         pooled_at DESC
LIMIT 200;
```

**精排伪代码**（应用层，对召回的 ≤200 封打分取 Top）：

```python
def fish(reader, candidates):
    scored = []
    for c in candidates:
        w = base_weights()                       # §2.2 默认权重
        w = redistribute_for_missing_mbti(reader, c, w)   # §2.3
        w = apply_preference_sliders(reader, w)  # §4：滑杆调制权重
        s  = w.mbti     * s_mbti(reader, c)
        s += w.interest * jaccard(reader.tags, c.tags)
        s += w.geo      * geo_score(reader, c)   # 含"偏远方"反转
        s += w.fresh    * fresh_score(c)
        s += epsilon_random(reader.pref_serendipity)  # §4.3
        s *= antimonopoly_penalty(c.author_id, reader) # §6 防霸屏
        scored.append((s, c))
    scored.sort(reverse=True)
    # 不直接取 Top1，而是 Top-K 加权抽样，制造偶遇感
    return weighted_sample_from_topk(scored, k=8)
```

> 为什么 Top-K 抽样而非 Top1：每日只捞 3 次、用户基数小，纯 Top1 会导致"总捞到最像我的人"，违背"漂流/偶遇"世界观，也加剧热门霸屏。k=8 加权抽样在"相关"与"惊喜"间折中。

---

## 3. MBTI 离散相容：16×16 静态查表

### 3.1 两种配对维度

打捞偏好滑杆决定走哪张表（或加权混合）：

- **相似配 S_sim**：维度重合度。`相同字母数 / 4`。
  ```
  INFP vs INFJ = 3/4 = 0.75；INTJ vs ESFP = 0/4 = 0.0
  ```
- **荣格互补配 S_comp**：认知功能栈互补（不是字母相反，是功能流互锁）。用静态查表，不在线算功能栈。

最终 `S_mbti_raw = α·S_sim + (1-α)·S_comp`，α 由"相似↔相异"滑杆给出（§4）。

### 3.2 关键高互补对清单（荣格"黄金搭档/镜像"型，S_comp=1.0）

基于双元组（Socionics Duality）与功能互补，列出 8 对核心高互补（双向）：

| 对 | 关系类型 | S_comp |
|---|---|---|
| INFP ↔ ENFJ | 主导功能镜像（Fi/Fe + Ne/Ni） | 1.0 |
| INTP ↔ ENTJ | Ti/Te + Ne/Ni | 1.0 |
| INFJ ↔ ENFP | Ni/Ne + Fe/Fi | 1.0 |
| INTJ ↔ ENTP | Ni/Ne + Te/Ti | 1.0 |
| ISFP ↔ ESFJ | Fi/Fe + Se/Si | 1.0 |
| ISTP ↔ ESTJ | Ti/Te + Se/Si | 1.0 |
| ISFJ ↔ ESFP | Si/Se + Fe/Fi | 1.0 |
| ISTJ ↔ ESTP | Si/Se + Te/Ti | 1.0 |

**次高互补（S_comp=0.7）**：同直觉/感觉气质但 J/P 或 T/F 互补的"激活/镜像"对，如 INFP↔ENFP、INTJ↔INFJ 等。**中性（0.5）**：无显著功能关系。**低（0.3）**：功能冲突（如双方主导功能直接对抗，ESTJ↔INFP 在"互补"维度上反而摩擦）。

> MVP 落地：这张 16×16 矩阵就是一个 **256 行静态表**（`mbti_compat(type_a, type_b, s_sim, s_comp)`），上线时一次性灌库，查询 O(1)。不在请求里算认知功能栈。建议直接做成应用层常量字典（256 个键），连 DB 都不查，最快。

### 3.3 缺失型号兜底

```
任一方无有效 MBTI → 不查表，S_mbti = 0.5（中性），并触发 §2.3 权重重分配
```

---

## 4. 偏好滑杆 MVP 简化实现

三根滑杆，0~100，默认全 50：

| 滑杆 | 字段 | 含义 |
|---|---|---|
| 相似 ↔ 相异 | `pref_similarity` | 0=要互补/不同的人，100=要像我的人 |
| 就近 ↔ 远方 | `pref_distance` | 0=想认识远方陌生人，100=想认识附近的人 |
| 稳妥 ↔ 惊喜 | `pref_serendipity` | 0=精准匹配，100=听天由命 |

### 4.1 "相似↔相异"映射到 MBTI 子分

滑杆值 `p_sim ∈ [0,1]` 直接当 §3.1 的 α：

```
α = p_sim / 100
S_mbti_raw = α·S_sim + (1-α)·S_comp
```

- 滑到"相似"端 → 几乎只看维度重合（找同类）
- 滑到"相异"端 → 几乎只看荣格互补（找互补搭档）
- 兴趣维度同理可加一层："相异"端时 `S_interest` 可改用"互补兴趣加成"（MVP 可先不做，仅作用于 MBTI 即可）

### 4.2 "就近↔远方"映射到地理权重/反转

```
p_dist = pref_distance / 100
# 权重：越想就近，geo 权重越高
w_geo_effective = w_geo * (0.4 + 1.2 * p_dist)   # p_dist=0→0.4倍, =1→1.6倍
# 反转：极端"远方"端（p_dist<0.2）时，地理分反转，鼓励捞远处的信
if p_dist < 0.2:
    S_geo = 1 - S_geo
```

### 4.3 "稳妥↔惊喜"注入随机 serendipity

`pref_serendipity` 控制随机扰动幅度 + Top-K 抽样的 K 与温度：

```
p_ser = pref_serendipity / 100
ε_random ~ Uniform(0, 0.15 * p_ser)        # 给总分加随机噪声，最多±0.15

# 同时影响抽样：惊喜越高，K 越大、抽样越平
K = round(3 + 7 * p_ser)                     # 3~10
temperature = 0.3 + 0.7 * p_ser              # softmax 温度
choice = softmax_sample(topK_scores, temperature)
```

> 全局兜底：即使滑到"最稳妥"，也强制保留 `ε_min = 0.03` 的随机和 K≥3，确保永远不会"每天捞到同一个人"。这是世界观的护栏。

---

## 5. 投递时分桶 + 打捞时精排（工程方案）

### 5.1 投递时分桶（信入漂流海时）

信通过 AI 审核后，异步写入多套倒排桶。MVP 双写：**PG（权威，可查询）+ Redis（加速，可重建）**。

**Redis 倒排桶设计**（ZSET，score=入池时间戳，便于按新旧截断 + TTL）：

```
# 地理桶（按 geohash 前3位，约 ±78km 粒度，召回半径）
ZADD pool:geo:{gh3}            <pooled_at_ts> letter:{id}
# 兴趣桶（每个标签一个桶）
ZADD pool:interest:{tag_id}    <pooled_at_ts> letter:{id}
# MBTI 桶（按型号，便于按相似/互补快速取）
ZADD pool:mbti:{type}          <pooled_at_ts> letter:{id}
# 全局新信桶（冷启动/空池兜底）
ZADD pool:fresh:global         <pooled_at_ts> letter:{id}
# 每桶设 TTL 与漂流时效一致（如 7~14 天自然过期）
```

信状态流转时维护桶：被打捞（拆封）→ 从可捞桶移除；超时回池 → 重新 ZADD。用 RabbitMQ 延时队列驱动状态翻转，翻转时同步增删桶。

### 5.2 打捞时精排流程（Redis 召回 + PG 精排）

```
1. 读 reader 画像（geohash5, tags, mbti, 三滑杆）
2. Redis 并集召回候选 id（ZUNIONSTORE 临时键 或 多 ZRANGE 后应用层合并）：
   - pool:geo:{我的gh3}            取最近 N=100
   - pool:interest:{我的每个tag}   各取最近 30
   - pool:mbti:{相似/互补型号}     取最近 30
   - pool:fresh:global             取最近 50（兜底）
3. 去重 + 过滤（已看/已捞/拉黑/自己）→ 候选 ≤200
4. 用候选 id 批量回 PG / Redis Hash 取信特征快照
5. 应用层精排打分（§2.4 伪代码）→ Top-K 加权抽样 → 返回 1 封
6. 写 user_letter_seen（防重复捞）+ Redis 配额扣减（每日3捞原子 DECR）
```

**为什么不纯 Redis 精排**：打分要查 16×16 矩阵、做权重重分配、Jaccard，逻辑复杂，放应用层；Redis 只做"快速给我一批近期相关 id"。**为什么不纯 PG**：§2.4 的 SQL 完全够 MVP 用；Redis 桶是当 PG 在打捞高峰扛不住时的加速层。**MVP 起步可以只用 PG（§2.4 那条 SQL）+ GIN 索引**，Redis 桶作为压测后再开的优化，避免双写一致性复杂度过早引入。

> 落地建议（MVP 最小路径）：**先纯 PG**。`letters` 表对 `status`、`geohash5`、`interest_tags`(GIN)、`pooled_at` 建索引，§2.4 SQL 召回 + 应用层精排即可支撑早期量级。Redis 仅用于配额计数 + 拆封分布式锁（这两个是刚需），倒排桶等有量再上。

---

## 6. 公平性与冷启动兜底（MVP 最小实现）

### 6.1 新信扶持（S_fresh）

`S_fresh = clamp(1 - age_h/72, 0, 1)`，权重 `w_fresh=0.10`。新信 72h 内有额外曝光加成，避免刚入池就被旧信淹没、永远捞不到。可叠加"零曝光强保护"：

```
若 letter.fished_count = 0 且 age_h < 12:
    S_fresh = 1.0  且 进入"必抽样"小池（每次打捞 20% 概率强制从零曝光池抽）
```

### 6.2 防热门霸屏（同作者/同信去重 + 惩罚）

热门作者的信不能反复占满所有人的打捞结果：

```
antimonopoly_penalty(author, reader):
    # 该作者近 24h 全局被打捞次数
    n = redis.get(f"fished_cnt:author:{author}:24h") or 0
    return 1 / (1 + 0.15 * n)        # 被捞越多，分数衰减越狠
```

- 同一封信被多人预览锁定时（10分钟预览锁），对其他召回隐藏（状态非 drifting）。
- 同一 reader 对同一作者 24h 内最多召回 1 封（去重键 `seen:author`）。

### 6.3 空池处理（冷启动/小流量必现）

打捞时候选不足，逐级放宽兜底，**保证永远捞得到东西**（哪怕相关性低），否则新用户首日体验崩塌：

```
召回数 < 3 时逐级降级：
  L1 放宽地理：gh3 → gh2 → 不限地理
  L2 放宽兴趣门槛：要求交集 → 不要求
  L3 拉全局新信桶 pool:fresh:global
  L4 仍不足 → 投放"AI 暖场信/官方漂流瓶"（MVP 砍了复杂规则，但保留最简版：
       一批预置的官方信件，标记 is_seed=true，永远在池，确保不空池）
```

**冷启动用户（无任何资料）**：MBTI 缺失 + 无 tag → §2.3 退化为纯地理 + fresh + 随机。首三天给"新人扶持"反向加成（新用户的信也更容易被别人捞到，加速建立连接）。

---

## 7. 匹配所需字段清单（供数据库设计参考）

### 7.1 用户表 `users`（匹配相关字段）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | BIGINT PK | |
| `mbti_type` | CHAR(4) NULL | 自报型号，NULL=未填 |
| `mbti_confidence` | SMALLINT/ENUM | unknown/unsure/confident（/未来 verified） |
| `mbti_note` | VARCHAR(30) NULL | 一句话说明，纯展示，不入算法 |
| `mbti_test_type` | CHAR(4) NULL | 演进预留：mini-test 结果 |
| `mbti_test_score` | SMALLINT[4] NULL | 演进预留：四维 -100~100 连续值 |
| `interest_tags` | INT[] | 受控词表 id 集合，建 GIN 索引 |
| `geohash5` | CHAR(5) | 仅前5位，±2.4km；原始经纬度不落库 |
| `pref_similarity` | SMALLINT | 0~100，默认50 |
| `pref_distance` | SMALLINT | 0~100，默认50 |
| `pref_serendipity` | SMALLINT | 0~100，默认50 |
| `is_minor` | BOOL | 未成年守护（影响匹配可见范围，合规项） |
| `created_at` | TIMESTAMPTZ | 冷启动新人扶持判定 |

### 7.2 信件表 `letters`（匹配相关字段，特征快照）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | BIGINT PK | |
| `author_id` | BIGINT FK | |
| `status` | ENUM | draft/reviewing/in_transit/drifting/previewing/opened/... 召回只取 drifting |
| `mbti_type` | CHAR(4) NULL | 作者快照 |
| `mbti_confidence` | SMALLINT | 作者快照 |
| `interest_tags` | INT[] | 作者快照，GIN 索引 |
| `geohash5` | CHAR(5) | 作者快照 |
| `pooled_at` | TIMESTAMPTZ | 最近一次入漂流海时间，算 S_fresh / 桶 score |
| `fished_count` | INT | 累计被打捞次数，防霸屏 + 零曝光保护 |
| `is_seed` | BOOL | 官方暖场信，永不空池兜底 |
| `version` | INT | 乐观锁 CAS（拆封并发，配合 Redis 锁） |

### 7.3 辅助表

- `mbti_compat(type_a CHAR(4), type_b CHAR(4), s_sim NUMERIC, s_comp NUMERIC)` — 256 行静态相容矩阵（或应用层常量）。
- `user_letter_seen(user_id, letter_id, seen_at)` — 防重复打捞，召回时 NOT IN。
- `user_block(user_id, blocked_id)` — 拉黑过滤。
- `interest_tag_dict(id, name, category)` — 受控兴趣词表（必须用 id 不用自由文本，否则 Jaccard 失真）。

### 7.4 Redis 键（运行态，非持久结构）

| 键 | 类型 | 用途 |
|---|---|---|
| `quota:fish:{uid}:{date}` | INT(DECR) | 每日3捞配额 |
| `quota:send:{uid}:{date}` / `quota:open:{uid}:{date}` | INT | 1投/1拆配额 |
| `lock:open:{letter_id}` | SETNX+TTL | 拆封分布式原子锁 |
| `fished_cnt:author:{id}:24h` | INT+TTL | 防霸屏惩罚 |
| `pool:geo:{gh3}` / `pool:interest:{tag}` / `pool:mbti:{type}` / `pool:fresh:global` | ZSET | 倒排桶（量大后启用） |

---

## 附：MVP 参数默认值速查

```
权重:    w_mbti=0.30  w_interest=0.40  w_geo=0.20  w_fresh=0.10
confidence系数:  confident=1.0  unsure=0.7  unknown=0(走缺失分支)
缺失MBTI:  中性分=0.5; 一方缺失MBTI权重×0.5且半数转兴趣; 双方缺失MBTI权重清零
兴趣双空:  S_interest=0.3
geo:      S_geo = 共享前缀长度/5; 远方端(p_dist<0.2)反转
fresh:    S_fresh = clamp(1-age_h/72,0,1); 零曝光<12h → 1.0
随机:     ε ~ U(0, 0.15*p_ser); ε_min=0.03(强制护栏)
抽样:     K = 3+7*p_ser (3~10); temp=0.3+0.7*p_ser; K≥3护栏
召回:     PG候选上限200; 空池逐级降级 L1~L4; 官方seed信兜底
防霸屏:   penalty=1/(1+0.15*n_24h); 同作者24h内最多召回1封
冷启动:   新用户首3天双向扶持加成
```

---

**MVP 落地优先级建议**：先实现"§2.4 纯 PG 召回 SQL + 应用层精排 + 三滑杆调权 + Top-K 抽样 + 空池 seed 兜底"这一条最小闭环即可上线；Redis 倒排桶（§5）、mini-test 校准（§1.3）、pgvector 向量召回均为后续演进，字段已在 §7 预留，不阻塞 MVP。
