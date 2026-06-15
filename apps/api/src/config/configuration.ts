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
  /** 投递后入池前的固定延时（秒）。MVP 用短延时演示"信鸽起飞→漂入海面"。 */
  letterPoolDelaySeconds: number;
  /** 笔友往来在途延时（秒）。MVP 简化；生产期按距离精算。 */
  correspondenceDeliverSeconds: number;
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
  letterPoolDelaySeconds: num(process.env.LETTER_POOL_DELAY_SECONDS, 30),
  correspondenceDeliverSeconds: num(process.env.CORRESPONDENCE_DELIVER_SECONDS, 60),
});
