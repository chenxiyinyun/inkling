/**
 * 假后端路由表（见 db.ts）。每条 handler 返回的就是 useApi 解包后的 data；
 * 失败抛 MockError，由 dispatch 包成 ofetch 风格错误（带 response.status 与 data.error）。
 */
import { LetterStatus, RelationStatus } from '@inkling/shared';
import type { LetterPreview, MeProfile, MyLetter, PenPalSummary, PublicProfile, QuotaToday } from '@inkling/shared';
import { db, save, nextId, resetsAtUtc, findProfile, type PoolLetter } from './db';

export class MockError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'MockError';
  }
}

export interface HandlerCtx {
  params: Record<string, string>;
  body: any;
}

interface Route {
  method: string;
  pattern: RegExp;
  run: (ctx: HandlerCtx) => unknown;
}

function excerpt(body: string): string {
  const i = body.search(/[。！？!?\n]/);
  if (i > 0 && i <= 60) return body.slice(0, i + 1);
  return body.length > 60 ? body.slice(0, 60) + '…' : body;
}

function previewOf(letter: PoolLetter): LetterPreview {
  return {
    fishingId: letter.fishingId!,
    lockUntil: letter.lockUntil!,
    penName: letter.author.penName,
    mbti: letter.author.mbti,
    partialTags: letter.partialTags,
    bodyExcerpt: letter.bodyExcerpt,
    theme: letter.theme,
    distanceLabel: letter.distanceLabel,
    vehicleLabel: letter.vehicleLabel,
  };
}

function summaryOf(rel: { relationId: string; partner: PublicProfile; status: RelationStatus; exchangeCount: number; lastLetterAt: string }): PenPalSummary {
  return {
    relationId: rel.relationId,
    partner: rel.partner,
    status: rel.status,
    exchangeCount: rel.exchangeCount,
    lastLetterAt: rel.lastLetterAt,
  };
}

const routes: Route[] = [
  // ---- 认证 / 账号 ----
  {
    method: 'POST',
    pattern: /^\/auth\/register$/,
    run: ({ body }) => {
      const s = db();
      s.me.penName = body?.penName || s.me.penName;
      s.me.mbti = 'UNKNOWN';
      s.me.interestTags = [];
      s.me.oneLiner = undefined;
      save();
      return { accessToken: 'mock-access', refreshToken: 'mock-refresh', publicId: s.me.publicId };
    },
  },
  {
    method: 'POST',
    pattern: /^\/auth\/login$/,
    run: () => ({ accessToken: 'mock-access', refreshToken: 'mock-refresh', publicId: db().me.publicId }),
  },
  { method: 'GET', pattern: /^\/me$/, run: () => db().me },
  {
    method: 'PATCH',
    pattern: /^\/me\/profile$/,
    run: ({ body }) => {
      const s = db();
      const me: MeProfile = s.me;
      if (body?.penName != null) me.penName = body.penName;
      if (body?.mbti != null) me.mbti = body.mbti;
      if (Array.isArray(body?.interestTags)) me.interestTags = body.interestTags;
      me.oneLiner = body?.oneLiner || undefined;
      if (body?.lat != null && body?.lng != null) me.region = '已记录大致海域';
      save();
      return me;
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/me\/settings$/,
    run: ({ body }) => {
      const s = db();
      if (typeof body?.invisible === 'boolean') s.me.invisible = body.invisible;
      // 未成年（TEEN）不可关闭守护模式
      if (typeof body?.guardianMode === 'boolean') s.me.guardianMode = s.me.ageTier === 'TEEN' ? true : body.guardianMode;
      save();
      return s.me;
    },
  },
  {
    method: 'POST',
    pattern: /^\/me\/export$/,
    run: () => {
      const s = db();
      return { account: { publicId: s.me.publicId }, profile: s.me, lettersCount: s.myLetters.length, penpalsCount: s.relations.length, note: '（mock）完整导出在生产期提供异步打包下载' };
    },
  },
  { method: 'DELETE', pattern: /^\/me$/, run: () => ({ message: '已登记注销请求，将在 30 天内处理（mock）' }) },
  {
    method: 'GET',
    pattern: /^\/profiles\/(?<publicId>[^/]+)$/,
    run: ({ params }) => {
      const p = findProfile(params.publicId);
      if (!p) throw new MockError(404, 'PROFILE_NOT_FOUND', '找不到这张名片');
      return p;
    },
  },

  // ---- 配额 ----
  {
    method: 'GET',
    pattern: /^\/quota\/today$/,
    run: (): QuotaToday => {
      const s = db();
      return { send: s.quota.send, fish: s.quota.fish, unseal: s.quota.unseal, resetsAt: resetsAtUtc() };
    },
  },

  // ---- 我的信件 ----
  { method: 'GET', pattern: /^\/letters$/, run: () => db().myLetters },
  {
    method: 'POST',
    pattern: /^\/letters\/compose$/,
    run: ({ body }) => {
      const s = db();
      if (s.quota.send <= 0) throw new MockError(403, 'QUOTA_EXHAUSTED', '今日漂流瓶已用尽，明日潮汐再启');
      const text = String(body?.body ?? '');
      if (text.trim().length < 50) throw new MockError(400, 'LETTER_TOO_SHORT', '再多写几句吧（至少 50 字）');
      s.quota.send -= 1;
      const letter: MyLetter = {
        letterId: nextId('L'),
        status: LetterStatus.DELIVERING,
        bodyExcerpt: excerpt(text),
        driftLabel: '信鸽在途',
        createdAt: new Date().toISOString(),
      };
      s.myLetters.unshift(letter);
      save();
      return { letterId: letter.letterId, status: letter.status };
    },
  },

  // ---- 漂流海 ----
  {
    method: 'POST',
    pattern: /^\/ocean\/fish$/,
    run: () => {
      const s = db();
      if (s.quota.fish <= 0) throw new MockError(403, 'QUOTA_EXHAUSTED', '今日打捞次数已用尽');
      const letter = s.pool.find((p) => p.status === 'FLOATING');
      if (!letter) throw new MockError(404, 'OCEAN_EMPTY', '此刻海面很平静，没有打捞到信。换个时段，也许会遇见。');
      s.quota.fish -= 1;
      letter.status = 'HOOKED';
      letter.fishingId = nextId('f');
      letter.lockUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      save();
      return previewOf(letter);
    },
  },
  {
    method: 'POST',
    pattern: /^\/fishing\/(?<id>[^/]+)\/release$/,
    run: ({ params }) => {
      const s = db();
      const letter = s.pool.find((p) => p.fishingId === params.id);
      if (letter) {
        letter.status = 'FLOATING';
        letter.fishingId = undefined;
        letter.lockUntil = undefined;
        save();
      }
      return { released: true };
    },
  },
  {
    method: 'POST',
    pattern: /^\/fishing\/(?<id>[^/]+)\/unseal$/,
    run: ({ params }) => {
      const s = db();
      if (s.quota.unseal <= 0) throw new MockError(403, 'QUOTA_EXHAUSTED', '今日只能拆一封信，明天再来');
      const letter = s.pool.find((p) => p.fishingId === params.id && p.status === 'HOOKED');
      if (!letter) throw new MockError(400, 'UNSEAL_FAILED', '这封信刚被取走了，再打捞看看');
      s.quota.unseal -= 1;
      letter.status = 'SEALED';
      const replyDeadline = new Date(Date.now() + 7 * 86400000).toISOString();
      s.unseals.push({ unsealId: nextId('uns'), letterId: letter.letterId, authorPublicId: letter.author.publicId, body: letter.body, replyDeadline });
      save();
      return {
        unsealId: s.unseals[s.unseals.length - 1].unsealId,
        letterId: letter.letterId,
        author: {
          publicId: letter.author.publicId,
          penName: letter.author.penName,
          mbti: letter.author.mbti,
          interestTags: letter.author.interestTags,
          oneLiner: letter.author.oneLiner,
        },
        body: letter.body,
        theme: letter.theme,
        replyDeadline,
      };
    },
  },
  {
    method: 'POST',
    pattern: /^\/unseals\/(?<id>[^/]+)\/reply$/,
    run: ({ params, body }) => {
      const s = db();
      const unseal = s.unseals.find((u) => u.unsealId === params.id);
      if (!unseal) throw new MockError(404, 'UNSEAL_NOT_FOUND', '找不到这封待回的信');
      if (new Date(unseal.replyDeadline) < new Date()) throw new MockError(400, 'WINDOW_CLOSED', '回信潮汐已过，信重新漂回了海面');
      const partner = findProfile(unseal.authorPublicId)!;
      const now = Date.now();
      const relationId = nextId('rel');
      s.relations.unshift({ relationId, partner, status: RelationStatus.ACTIVE, exchangeCount: 1, lastLetterAt: new Date(now).toISOString() });
      // 原信作为对方寄来（已送达）+ 我的回信（已送达）
      s.correspondences.push({ id: nextId('c'), relationId, mine: false, body: unseal.body, deliverAt: now - 1000, createdAt: new Date(now - 2000).toISOString() });
      s.correspondences.push({ id: nextId('c'), relationId, mine: true, body: String(body?.body ?? ''), deliverAt: now - 500, createdAt: new Date(now).toISOString() });
      // 信已结缘，移出漂流池
      s.pool = s.pool.filter((p) => p.letterId !== unseal.letterId);
      save();
      return { relationId, status: RelationStatus.ACTIVE, message: '你们结缘了，成为彼此的笔友' };
    },
  },

  // ---- 笔友 ----
  { method: 'GET', pattern: /^\/penpals$/, run: () => db().relations.map(summaryOf) },
  {
    method: 'GET',
    pattern: /^\/penpals\/(?<id>[^/]+)\/letters$/,
    run: ({ params }) => {
      const s = db();
      const now = Date.now();
      return s.correspondences
        .filter((c) => c.relationId === params.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((c) => {
          const inTransit = c.deliverAt > now;
          if (!c.mine && inTransit) return { id: c.id, mine: false, inTransit: true };
          return { id: c.id, mine: c.mine, inTransit, body: c.body, createdAt: c.createdAt, deliveredAt: inTransit ? undefined : new Date(c.deliverAt).toISOString() };
        });
    },
  },
  {
    method: 'POST',
    pattern: /^\/penpals\/(?<id>[^/]+)\/letters$/,
    run: ({ params, body }) => {
      const s = db();
      const rel = s.relations.find((r) => r.relationId === params.id);
      if (!rel) throw new MockError(404, 'RELATION_NOT_FOUND', '找不到这段信缘');
      const now = Date.now();
      const deliverAt = now + 8000; // 8 秒在途，便于看到"信鸽在路上"
      s.correspondences.push({ id: nextId('c'), relationId: rel.relationId, mine: true, body: String(body?.body ?? ''), deliverAt, createdAt: new Date(now).toISOString() });
      rel.exchangeCount += 1;
      rel.lastLetterAt = new Date(now).toISOString();
      save();
      return { sent: true, vehicleLabel: '信鸽', deliverAt: new Date(deliverAt).toISOString() };
    },
  },
  {
    method: 'GET',
    pattern: /^\/penpals\/(?<id>[^/]+)$/,
    run: ({ params }) => {
      const s = db();
      const rel = s.relations.find((r) => r.relationId === params.id);
      if (!rel) throw new MockError(404, 'RELATION_NOT_FOUND', '找不到这段信缘');
      return summaryOf(rel);
    },
  },
];

/** 按 method + path 匹配路由；命中返回 {route, params}，未命中返回 null（交回真实 fetch）。 */
export function matchRoute(method: string, path: string): { route: Route; params: Record<string, string> } | null {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.pattern.exec(path);
    if (m) return { route: r, params: (m.groups ?? {}) as Record<string, string> };
  }
  return null;
}
