/**
 * 前端无后端联调用的「内存假后端」状态（详见 docs/代码审计与迭代计划.md 阶段1）。
 * 有状态：配额随操作递减、打捞→预览→拆封→回信→笔友 全链路可走通。
 * 持久化到 sessionStorage（按标签页），刷新不丢档；换标签页/关闭即清。
 */
import { AgeTier, LetterStatus, RelationStatus, QUOTA_DEFAULTS } from '@inkling/shared';
import type { MeProfile, MyLetter, PublicProfile } from '@inkling/shared';

const STORAGE_KEY = 'inkling_mock_db_v1';

export interface PoolLetter {
  letterId: string;
  status: 'FLOATING' | 'HOOKED' | 'SEALED';
  fishingId?: string;
  lockUntil?: string;
  author: PublicProfile;
  partialTags: string[];
  bodyExcerpt: string;
  body: string;
  theme?: string;
  distanceLabel: string;
  vehicleLabel: string;
}

export interface UnsealRec {
  unsealId: string;
  letterId: string;
  authorPublicId: string;
  body: string;
  replyDeadline: string;
}

export interface Relation {
  relationId: string;
  partner: PublicProfile;
  status: RelationStatus;
  exchangeCount: number;
  lastLetterAt: string;
}

export interface Correspondence {
  id: string;
  relationId: string;
  mine: boolean;
  body: string;
  deliverAt: number; // 时间戳；> now 表示在途
  createdAt: string;
}

export interface MockState {
  seq: number;
  quotaDate: string;
  quota: { send: number; fish: number; unseal: number };
  me: MeProfile;
  myLetters: MyLetter[];
  pool: PoolLetter[];
  unseals: UnsealRec[];
  relations: Relation[];
  correspondences: Correspondence[];
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function seed(): MockState {
  const me: MeProfile = {
    publicId: 'me',
    penName: '旅人',
    mbti: 'INFP',
    interestTags: ['阅读', '旅行', '咖啡'],
    oneLiner: '在路上，也在找同路人',
    region: '远方',
    ageTier: AgeTier.ADULT,
    guardianMode: false,
    invisible: false,
    matchPreference: 0.5,
  };

  const pool: PoolLetter[] = [
    {
      letterId: 'L-seed-1',
      status: 'FLOATING',
      author: { publicId: 'u-lin', penName: '林深', mbti: 'INFJ', interestTags: ['阅读', '哲学', '茶', '独处'], oneLiner: '夜里写信的人', region: '约 1200 公里外' },
      partialTags: ['提倡者', '阅读'],
      bodyExcerpt: '亲爱的陌生人，最近我重新读了《小王子》。',
      body: '亲爱的陌生人，最近我重新读了《小王子》。\n\n小时候只觉得是童话，如今才读懂那只狐狸说的——重要的东西用眼睛是看不见的。不知此刻翻到我这封信的你，最近在为什么事认真着？愿你被温柔以待。',
      theme: '你书架上最旧的那本书',
      distanceLabel: '约 1200 公里外',
      vehicleLabel: '由加急驿马送达',
    },
    {
      letterId: 'L-seed-2',
      status: 'FLOATING',
      author: { publicId: 'u-ah', penName: '阿禾', mbti: 'ENFP', interestTags: ['音乐', '旅行', '电影', '猫'], oneLiner: '想去看一次极光', region: '约 80 公里外' },
      partialTags: ['竞选者', '音乐'],
      bodyExcerpt: '嗨！今天降温了，我躲进一家小咖啡馆。',
      body: '嗨！今天降温了，我躲进一家小咖啡馆，点了杯热可可，看窗外的人来人往。\n\n忽然很想给一个不认识的人写信，告诉ta：再忙也记得给自己留一点发呆的时间。你呢，今天有没有为自己慢下来一会儿？',
      theme: '最近一件让你慢下来的小事',
      distanceLabel: '约 80 公里外',
      vehicleLabel: '由马车送达',
    },
    {
      letterId: 'L-seed-3',
      status: 'FLOATING',
      author: { publicId: 'u-zhou', penName: '周屿', mbti: 'INTP', interestTags: ['哲学', '写作', '徒步', '咖啡'], oneLiner: '在异乡的第三年', region: '天涯之遥' },
      partialTags: ['逻辑学家', '写作'],
      bodyExcerpt: '写给同样在异乡的你：今晚的月亮很亮。',
      body: '写给同样在异乡的你：\n\n今晚的月亮很亮，亮到让我想起家乡屋后那片田。在外面久了，越来越能体会“此心安处是吾乡”。如果你也在远方漂着，希望这封信能让你觉得，至少此刻有人和你看着同一个月亮。',
      theme: '写给同样在异乡的人',
      distanceLabel: '天涯之遥',
      vehicleLabel: '由天涯专递送达',
    },
    {
      letterId: 'L-seed-4',
      status: 'FLOATING',
      author: { publicId: 'u-mu', penName: '木木', mbti: 'ISFP', interestTags: ['手作', '摄影', '猫', '诗'], oneLiner: '用胶片记录慢生活', region: '约 300 公里外' },
      partialTags: ['探险家', '手作'],
      bodyExcerpt: '我有一个一直想去却还没去的地方——青海。',
      body: '我有一个一直想去却还没去的地方——青海。\n\n总在等一个“合适的时机”，可后来发现合适的时机从不会自己到来。所以我决定明年春天就去。你呢，有没有一个搁置了很久的小小心愿？也许我们可以互相催促一下。',
      theme: '一个想去却还没去的地方',
      distanceLabel: '约 300 公里外',
      vehicleLabel: '由信鸽送达',
    },
  ];

  return {
    seq: 1,
    quotaDate: todayUtc(),
    quota: { send: QUOTA_DEFAULTS.dailySend, fish: QUOTA_DEFAULTS.dailyFish, unseal: QUOTA_DEFAULTS.dailyUnseal },
    me,
    myLetters: [],
    pool,
    unseals: [],
    relations: [],
    correspondences: [],
  };
}

let state: MockState = load();

function load(): MockState {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as MockState;
    }
  } catch {
    /* ignore */
  }
  return seed();
}

export function save() {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function resetDb() {
  state = seed();
  save();
}

export function db(): MockState {
  ensureQuotaFresh();
  return state;
}

/** 跨自然日（UTC）重置配额，复刻后端潮汐。 */
function ensureQuotaFresh() {
  const today = todayUtc();
  if (state.quotaDate !== today) {
    state.quotaDate = today;
    state.quota = { send: QUOTA_DEFAULTS.dailySend, fish: QUOTA_DEFAULTS.dailyFish, unseal: QUOTA_DEFAULTS.dailyUnseal };
    save();
  }
}

export function nextId(prefix: string): string {
  state.seq += 1;
  return `${prefix}-${state.seq}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function resetsAtUtc(): string {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

/** 公开名片查找：池中作者 + 笔友 + 自己。 */
export function findProfile(publicId: string): PublicProfile | undefined {
  if (publicId === state.me.publicId) return state.me;
  const inPool = state.pool.find((p) => p.author.publicId === publicId);
  if (inPool) return inPool.author;
  const rel = state.relations.find((r) => r.partner.publicId === publicId);
  return rel?.partner;
}

export { LetterStatus, RelationStatus };
