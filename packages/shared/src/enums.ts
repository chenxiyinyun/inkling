/**
 * 跨前后端共享的枚举（单一事实来源）。
 * ⚠️ 这些枚举在 apps/api/prisma/schema.prisma 中有对应的 Prisma enum，
 *    修改时请保持两边同步。
 */

/** 信件状态机（详见 docs/产品设计文档.md §1.1） */
// REVIEWING/RECYCLED/DIMMED/FROZEN 为预留态：MVP 暂无写入方，保留以对接路线图功能。
// 成员集合须与 prisma/schema.prisma 的 LetterStatus 一致（apps/api 的 enum-drift.spec.ts 守护）。
export enum LetterStatus {
  DRAFT = 'DRAFT', // 草稿
  REVIEWING = 'REVIEWING', // 预留：异步/人工审核队列（MVP 同步审核，不写入）
  DELIVERING = 'DELIVERING', // 在途（车马/信鸽）
  FLOATING = 'FLOATING', // 漂入海面，可被打捞
  HOOKED = 'HOOKED', // 被打捞，进入 10 分钟预览锁
  SEALED_OPEN = 'SEALED_OPEN', // 已拆封，暂离池，7 天回信窗口
  PAIRED = 'PAIRED', // 已回信结缘成笔友
  RECYCLED = 'RECYCLED', // 预留：MVP 回池改用 FLOATING + recycleCount，不写入
  DIMMED = 'DIMMED', // 预留：多次回池降权（archive 已兼容读取，无写入方）
  ARCHIVED = 'ARCHIVED', // 漂流到期归档
  FROZEN = 'FROZEN', // 预留：违规冻结（MVP 不写入）
}

/** 年龄分级（未成年人保护，详见 docs/安全与未成年人保护.md） */
export enum AgeTier {
  CHILD = 'CHILD', // 低于法定最低年龄 → 婉拒
  TEEN = 'TEEN', // 13–17，进入守护模式
  ADULT = 'ADULT', // 18+
}

/** 内容审核风险等级 */
export enum RiskLevel {
  SAFE = 'SAFE',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH', // 联系方式 / 涉政 / 诈骗 / 自残等高危
}

/** 审核处置动作 */
export enum ReviewAction {
  PASS = 'PASS',
  REVIEW = 'REVIEW', // 入人工/二次复审队列
  BLOCK = 'BLOCK',
}

/** 处罚类型（信用分双轨阶梯） */
export enum PenaltyType {
  WARNING = 'WARNING',
  RATE_LIMIT = 'RATE_LIMIT',
  FREEZE = 'FREEZE',
  BAN = 'BAN',
}

/** 递送工具（真实距离决定速度） */
export enum DeliveryVehicle {
  FOOT = 'FOOT', // 徒步信使 <20km
  CARRIAGE = 'CARRIAGE', // 马车 20–200km
  PIGEON = 'PIGEON', // 信鸽 200–800km
  FAST_HORSE = 'FAST_HORSE', // 加急驿马 800–2000km
  ALBATROSS = 'ALBATROSS', // 天涯专递 >2000km
}

/** 笔友关系状态 */
export enum RelationStatus {
  ACTIVE = 'ACTIVE',
  DORMANT = 'DORMANT', // 长期无往来休眠
  ARCHIVED = 'ARCHIVED', // 封存（信缘博物馆，演进）
  BLOCKED = 'BLOCKED',
}

/** 举报原因 */
export enum ReportReason {
  HARASSMENT = 'HARASSMENT', // 辱骂骚扰
  SEXUAL = 'SEXUAL', // 性暗示色情
  CONTACT_INFO = 'CONTACT_INFO', // 联系方式
  SCAM = 'SCAM', // 引流诈骗
  POLITICAL = 'POLITICAL', // 涉政违禁
  SELF_HARM = 'SELF_HARM', // 自残心理危机
  MINOR_SAFETY = 'MINOR_SAFETY', // 未成年人安全
  OTHER = 'OTHER',
}

/** 偏好滑杆端点语义（相似 ↔ 互补） */
export enum MatchPreference {
  SIMILAR = 0, // 寻一个懂我的人
  COMPLEMENT = 1, // 遇一个全然不同的世界
}

/**
 * 系统通知类型（仅"抵达类"弱通知，遵循去人格化；详见 docs/API设计.md §4.3）。
 * 成员集合须与 prisma/schema.prisma 的 NotificationType 一致（enum-drift.spec.ts 守护）。
 */
export enum NotificationType {
  LETTER_DELIVERED = 'LETTER_DELIVERED', // 投递的信漂入海面
  LETTER_FISHED = 'LETTER_FISHED', // 自己的信被人拾起（去人格化，不透露是谁）
  PENPAL_REPLY_ARRIVED = 'PENPAL_REPLY_ARRIVED', // 笔友回信经在途后抵达
  UNSEAL_REPLY_WINDOW_WARNING = 'UNSEAL_REPLY_WINDOW_WARNING', // 自己拆封的信回信窗口剩 ≤1 天
  UNSEAL_EXPIRED_REDRIFT = 'UNSEAL_EXPIRED_REDRIFT', // 7 天未回信，信回池重漂
}

/**
 * 申诉处理状态。
 * 成员集合须与 prisma/schema.prisma 的 AppealStatus 一致（enum-drift.spec.ts 守护）。
 */
export enum AppealStatus {
  OPEN = 'OPEN', // 已提交，待人工复核
  UPHELD = 'UPHELD', // 维持原处罚（申诉驳回）
  OVERTURNED = 'OVERTURNED', // 推翻原处罚（申诉成立）
}
