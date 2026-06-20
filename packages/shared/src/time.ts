/**
 * 粗档时间文案——慢社交世界观刻意不暴露精确时间。
 * 纯函数，注入 now 便于测试；前后端共用（通知 createdBand、在途 etaBand 等）。
 */
export function timeBand(date: Date | string | number, now: Date = new Date()): string {
  const t = typeof date === 'number' ? date : new Date(date).getTime();
  if (Number.isNaN(t)) return '很久前';
  const diffMs = now.getTime() - t;
  if (diffMs < 60_000) return '刚刚'; // 含未来时间（时钟漂移）一并归为"刚刚"
  const min = Math.floor(diffMs / 60_000);
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}天前`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon}个月前`;
  return '很久前';
}
