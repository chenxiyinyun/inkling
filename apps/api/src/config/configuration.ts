export interface AppConfig {
  port: number;
  webOrigin: string[];
  jwt: { secret: string; accessTtl: string; refreshTtl: string };
  quota: { send: number; fish: number; unseal: number };
  previewLockSeconds: number;
  replyWindowDays: number;
  letterMaxDriftDays: number;
  letterMaxRecycle: number;
  minAgeHardFloor: number;
  guardianModeBelowAge: number;
  /** 内容审核 Provider：local（默认本地规则）/ remote（第三方 API，C 档）。 */
  moderation: { provider: string; remoteApiUrl?: string; remoteApiKey?: string };
  /** 投递后入池前的固定延时（秒）。信件入海无收件人、距离未知，故用短延时演示"漂入海面"。 */
  letterPoolDelaySeconds: number;
  /**
   * 笔友往来在途时长的缩放因子。在途毫秒 = pickDeliveryTier(距离).baseHours × 3600s × scale。
   * prod=1（真实 4–96h）；本地/测试设 0 即时（CI/集成测试用 0）。
   */
  deliveryHoursScale: number;
}

const num = (v: string | undefined, d: number) => (v ? Number(v) : d);

export default (): AppConfig => ({
  port: num(process.env.API_PORT, 3001),
  webOrigin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(','),
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  },
  quota: {
    send: num(process.env.QUOTA_DAILY_SEND, 1),
    fish: num(process.env.QUOTA_DAILY_FISH, 3),
    unseal: num(process.env.QUOTA_DAILY_UNSEAL, 1),
  },
  previewLockSeconds: num(process.env.PREVIEW_LOCK_SECONDS, 600),
  replyWindowDays: num(process.env.REPLY_WINDOW_DAYS, 7),
  letterMaxDriftDays: num(process.env.LETTER_MAX_DRIFT_DAYS, 30),
  letterMaxRecycle: num(process.env.LETTER_MAX_RECYCLE, 3),
  minAgeHardFloor: num(process.env.MIN_AGE_HARD_FLOOR, 13),
  guardianModeBelowAge: num(process.env.GUARDIAN_MODE_BELOW_AGE, 18),
  moderation: {
    provider: process.env.MODERATION_PROVIDER ?? 'local',
    remoteApiUrl: process.env.MODERATION_API_URL,
    remoteApiKey: process.env.MODERATION_API_KEY,
  },
  letterPoolDelaySeconds: num(process.env.LETTER_POOL_DELAY_SECONDS, 30),
  deliveryHoursScale: num(process.env.DELIVERY_HOURS_SCALE, 1),
});
