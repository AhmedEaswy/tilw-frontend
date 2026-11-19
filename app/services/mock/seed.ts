/** Seed data for the in-browser mock. Copy comes from the Figma prototype so screens match the designs. */
import { DEFAULT_READING, type Script, type User } from '../types'

export const SEED_PASSWORD = 'password123'

export function seedUser(now: string): User & { password: string } {
  return {
    id: 'u_layan',
    name: 'ليان سالم',
    email: 'layan@example.com',
    password: SEED_PASSWORD,
    locale: 'ar',
    theme: 'system',
    reading: { ...DEFAULT_READING },
    createdAt: now,
  }
}

const day = 86_400_000

function script(id: string, title: string, body: string, updatedAgoMs: number, now: number, extra: Partial<Script> = {}): Script {
  const at = new Date(now - updatedAgoMs).toISOString()
  return {
    id,
    title,
    body,
    marks: [],
    direction: 'auto',
    pinned: false,
    archivedAt: null,
    version: 1,
    createdAt: at,
    updatedAt: at,
    lastOpenedAt: null,
    lastPosition: null,
    ...extra,
  }
}

export function seedScripts(now: number): Script[] {
  return [
    script(
      's_opening',
      'افتتاحية الحلقة',
      [
        'كل حكاية تبدأ بسؤال صغير.',
        'قبل أن أفتح الكاميرا، كتبت على الورق سؤالاً واحداً: ماذا أريد أن يبقى معكم بعد أن تنتهي الحلقة؟ لم أبحث عن جواب كامل، بل عن جملة أستطيع أن أقولها وأنا أنظر إليكم.',
        'سؤال واحد يكفي لنبدأ منه معاً. في هدوء الغرفة، نفتح الميكروفون، ونترك للكلمات أن تأخذ وقتها.',
      ].join('\n\n'),
      2 * 3_600_000,
      now,
      { lastOpenedAt: new Date(now - 3_600_000).toISOString(), lastPosition: { paragraph: 0, offset: 0 } },
    ),
    script(
      's_backstage',
      'وراء الكواليس',
      [
        'قبل أن نفتح الكاميرا، لنتوقف لحظة ونختار ما نريد قوله.',
        'وراء كل دقيقة على الشاشة ساعات من التحضير: نص يُكتب ويُعاد، إضاءة تُضبط، ومحاولات لا يراها أحد. اليوم أريد أن أريكم جزءاً من هذا الطريق، لأن الطريق نفسه جزء من الحكاية.',
        'سنبدأ من المكتب، حيث يولد السؤال الأول، ثم ننتقل إلى الزاوية التي نسجل فيها، وننتهي بالمحاولة التي اخترناها من بين كثيرات.',
        'هنا تبدأ الحكاية.',
      ].join('\n\n'),
      day + 5 * 3_600_000,
      now,
    ),
    script(
      's_letter',
      'رسالة إلى المستمع',
      [
        'إلى من يسمعنا الآن، أينما كنت.',
        'شكراً لأنك منحتنا هذا الوقت. نعرف أن الدقائق ثمينة، ولهذا نحاول أن نجعل كل واحدة منها تستحق.',
        'إن كان لديك سؤال تريد أن نبدأ منه الحلقة القادمة، فاكتبه لنا. ربما يكون سؤالك هو الحكاية التالية.',
      ].join('\n\n'),
      10 * day,
      now,
    ),
  ]
}

/** Scripts an older version of the app left in this browser (legacy recovery, 6:68–6:71). */
export const LEGACY_SCRIPTS = [
  { key: 'tilw:legacy:1', title: 'الافتتاحية الأولى', kind: 'draft' as const, body: 'كانت البداية سؤالاً بسيطاً.\n\nمن هنا بدأت الحكاية.' },
  { key: 'tilw:legacy:2', title: 'كواليس التصوير', kind: 'saved' as const, body: 'خذ نفساً هادئاً، وانظر إلى الكاميرا.\n\nثم اقرأ بإيقاعك.' },
]
