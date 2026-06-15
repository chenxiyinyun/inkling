import { PREVIEW_BODY_CHARS } from '@inkling/shared';

/**
 * 打捞预览的正文摘要（纯函数，便于单测）。
 * 遇到首个句末标点（。！？!?\n）且位置不超过 PREVIEW_BODY_CHARS 时截到该标点；
 * 否则超长截断加省略号，短文原样返回。
 */
export function excerpt(body: string): string {
  const firstStop = body.search(/[。！？!?\n]/);
  if (firstStop > 0 && firstStop <= PREVIEW_BODY_CHARS) return body.slice(0, firstStop + 1);
  return body.length > PREVIEW_BODY_CHARS ? body.slice(0, PREVIEW_BODY_CHARS) + '…' : body;
}
