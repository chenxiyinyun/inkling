import { PrismaClient, AgeTier, LetterStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// 运营种子信（署名"漂流邮局"，透明标注）——解决冷启动期"放漂无信可捞"。
// 详见 docs/产品设计文档.md §1.7 / §8.1。
const SEEDS = [
  { email: 'lin@inkling.dev', penName: '林间有风', mbti: 'INFP', tags: ['阅读', '独处', '诗'], geohash5: 'wecpk', oneLiner: '在异乡，靠一杯热茶过冬。',
    body: '亲爱的陌生人：最近我搬到了一座总在下雨的城市，窗台上的绿萝倒是越长越好。你那边，今天是什么天气？有没有一件最近让你慢下来的小事，想说给一个不认识的人听？' },
  { email: 'zhou@inkling.dev', penName: '昼夜不舍', mbti: 'INTJ', tags: ['哲学', '围棋', '徒步'], geohash5: 'wsqqq', oneLiner: '相信慢一点的字，装得下真心。',
    body: '你好呀。我习惯把想不通的事写下来，等几天再看，常常就有了答案。所以我喜欢写信——它逼人慢下来。想问你一个问题：你上一次「等待」一件事，是什么时候？等待的滋味，是甜的还是涩的？' },
  { email: 'qing@inkling.dev', penName: '青梅煮酒', mbti: 'ENFP', tags: ['旅行', '音乐', '手作'], geohash5: 'wtw3s', oneLiner: '把每一次相遇都当成一段旅程。',
    body: '嘿！我刚从一座海边小城回来，带回了一罐装着海风的玻璃瓶（其实是空的，但我说它装着海风）。如果可以寄给你一样路上的小东西，你希望是什么？说说你心里那个想去却还没去的地方吧。' },
  { email: 'mu@inkling.dev', penName: '木卯', mbti: 'ISFJ', tags: ['烘焙', '园艺', '猫'], geohash5: 'w3gvz', oneLiner: '厨房的灯，是我最爱的光。',
    body: '见信好。我养了两只猫，一只爱睡，一只爱闹。今早烤了肉桂卷，香味把它们都引来了。你呢，有没有什么气味，一闻到就觉得安心？写信给我，让我也认识认识你的日常。' },
  { email: 'yan@inkling.dev', penName: '燕归来', mbti: 'ESTP', tags: ['篮球', '摄影', '美食'], geohash5: 'wx4g0', oneLiner: '生活要么冒险，要么什么都不是。',
    body: '你好！我是个闲不住的人，背着相机到处跑。最近拍到一张很满意的照片：黄昏里一个人在天桥上拉小提琴。那一刻我突然想，要是能把这个画面寄给某个人就好了。所以——你最近，有没有遇见过让你心头一动的瞬间？' },
  { email: 'su@inkling.dev', penName: '素笺淡墨', mbti: 'UNKNOWN', tags: ['书法', '茶道', '古琴'], geohash5: 'wmkq5', oneLiner: '我还没想好自己是什么型号的人。',
    body: '展信舒颜。说来惭愧，那些性格测试我总也测不准，干脆不测了。我只知道自己喜欢安静，喜欢一笔一画地写字。也许你能帮我看看，从这封信里，我像个怎样的人？也说说你自己吧。' },
];

async function main() {
  const passwordHash = await bcrypt.hash('inkling123', 10);
  const now = Date.now();

  for (const s of SEEDS) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        passwordHash,
        ageTier: AgeTier.ADULT,
        birthDate: new Date('1998-01-01'),
        profile: {
          create: {
            penName: s.penName,
            mbti: s.mbti,
            interestTags: s.tags,
            oneLiner: s.oneLiner,
            geohash5: s.geohash5,
          },
        },
      },
      include: { profile: true },
    });

    // 每位种子用户投一封"在池"的信
    const existing = await prisma.letter.findFirst({ where: { authorId: user.id } });
    if (existing) continue;

    const excerpt = s.body.slice(0, 60) + (s.body.length > 60 ? '…' : '');
    await prisma.letter.create({
      data: {
        authorId: user.id,
        body: s.body,
        theme: '写给同样在路上的人',
        status: LetterStatus.FLOATING,
        geohash5: s.geohash5,
        poolVisibleAt: new Date(now - 60_000),
        expireAt: new Date(now + 30 * 86400_000),
        previewSnapshot: {
          create: {
            partialTags: [s.mbti === 'UNKNOWN' ? '型号待解' : s.mbti, ...s.tags.slice(0, 2)],
            bodyExcerpt: excerpt,
          },
        },
      },
    });
  }

  console.log(`✓ 已注入 ${SEEDS.length} 位种子写信人与漂流信（默认密码 inkling123）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
