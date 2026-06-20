import { ReviewResult, reviewText } from './moderation.rules';

/** DI 注入令牌：可插拔的内容审核 Provider。 */
export const MODERATION_PROVIDER = Symbol('MODERATION_PROVIDER');

/**
 * 内容审核 Provider 抽象。env `MODERATION_PROVIDER` 切换实现：
 *   local  → LocalRulesProvider（默认，本地规则，零依赖）
 *   remote → RemoteApiProvider（第三方多语种内容安全 API，C 档接入）
 */
export interface ModerationProvider {
  review(text: string): Promise<ReviewResult>;
}

/** 本地规则 Provider（默认）。委托纯函数 reviewText。 */
export class LocalRulesProvider implements ModerationProvider {
  async review(text: string): Promise<ReviewResult> {
    return reviewText(text);
  }
}

/**
 * 远程内容安全 API Provider（预留，C 档需公网/密钥）。
 * fail-safe 原则——绝不因为远程不可用而静默放行高危内容：
 *  - 未配置 endpoint/key：降级到本地规则（标记 unconfigured）。
 *  - 已配置但调用失败：fail-closed，沿用本地规则结果（标记 fallback），绝不返回 PASS 兜底。
 * 真正接入第三方 API 的 fetch/解析留待 C 档（见 docs/安全与未成年人保护.md）。
 */
export class RemoteApiProvider implements ModerationProvider {
  constructor(
    private readonly endpoint?: string,
    private readonly apiKey?: string,
  ) {}

  async review(text: string): Promise<ReviewResult> {
    const local = reviewText(text);
    if (!this.endpoint || !this.apiKey) {
      return { ...local, hits: [...local.hits, 'remote:unconfigured-fallback-local'] };
    }
    // TODO(C 档): fetch(this.endpoint, ...) → 解析风险 → 与本地结果取较严者；任何异常 fail-closed。
    return { ...local, hits: [...local.hits, 'remote:stub-not-implemented'] };
  }
}
