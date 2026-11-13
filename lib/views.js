// lib/views.js —— 移动端四面板：写小说 / AI创作 / 资料库 / 设置
import { readFileSync } from 'node:fs'

const VERSION = (() => {
  try {
    return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
  } catch {
    return '0.0.0'
  }
})()

const page = (title, accent, children) => ({ v: 2, type: 'stack', title, accent, children: children.filter(Boolean) })
const card = (children, opts) => ({
  type: 'stack',
  style: { card: (opts && opts.card) || 'surface', padding: (opts && opts.padding) || 'M', gap: (opts && opts.gap) || 'M' },
  children: (Array.isArray(children) ? children : [children]).filter(Boolean),
})
const plain = (children) => card(children, { card: 'plain', padding: 'S', gap: 'S' })
const h = (text) => ({ type: 'text', text, style: { size: 'subtitle', weight: 'semibold' } })
const mono = (text) => ({ type: 'text', text, tone: 'muted', style: { size: 'mono' } })
const mute = (text) => ({ type: 'text', text, tone: 'muted', style: { size: 'caption' } })
const tag = (text, tone) => ({ type: 'badge', text, ...(tone ? { tone } : {}) })
const kchars = (n) => {
  const v = Number(n) || 0
  if (v >= 10000) return (v / 10000).toFixed(1) + ' 万字'
  return String(v) + ' 字'
}
const when = (iso) => {
  if (!iso) return '未知'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '未知'
  return d.toLocaleString('zh-CN', { hour12: false })
}
const acts = (items) => ({ type: 'actions', items })
const form = (submit, label, fields) => ({ type: 'form', submit, submitLabel: label, children: fields })
const tf = (label, bind, opts) => ({ type: 'textField', label, bind, ...(opts || {}) })
const empty = (title, message, icon) => ({ type: 'emptyState', title, message, icon })
const callout = (text, tone) => ({ type: 'callout', text, tone })
const row = (children) => ({ type: 'row', style: { gap: 'S' }, children: children.filter(Boolean) })
const sections = (items) => ({
  type: 'accordion',
  expanded: true,
  items: (items || []).map((it) => ({ ...it, children: (it.children || []).filter(Boolean) })),
})
const hr = () => ({ type: 'divider', style: { size: 'S' } })

function head(title, subtitle, tags, color, actions) {
  const kids = [{ type: 'text', text: title, style: { size: 'display', weight: 'bold', color: color || 'violet' } }]
  if (subtitle) kids.push(mute(subtitle))
  if (tags && tags.length) kids.push(row(tags))
  if (actions && actions.length) kids.push(acts(actions))
  return { type: 'stack', style: { card: 'outlined', padding: 'M', gap: 'S' }, children: kids }
}

function clock(ts) {
  if (!ts) return '未保存'
  const d = new Date(ts)
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

function saveLine(s) {
  if (s.saveState && s.saveState.error) return '保存失败：' + s.saveState.error
  if (s.saveState && s.saveState.pending) return '正在保存…'
  return s.saveState && s.saveState.at ? '已保存 ' + clock(s.saveState.at) : '未保存'
}

/* ═══ 面板① 写小说 ═══════════════════════════ */

const STUDIO_TABS = [
  { to: 'home', label: '首页', icon: 'home' },
  { to: 'works', label: '作品', icon: 'book' },
  { to: 'write', label: '编辑器', icon: 'edit' },
  { to: 'stats', label: '统计', icon: 'chart' },
]

function studioTabBar(current) {
  return plain([acts(STUDIO_TABS.map((t) => ({
    label: t.label,
    icon: t.icon,
    action: { id: 'switchTab', args: { to: t.to } },
    ...(t.to === current ? { style: 'primary' } : {}),
  })))])
}

function studioTabOf(s) {
  if (s.mode === 'write') return 'write'
  if (s.mode === 'stats') return 'stats'
  if (s.mode === 'book' || s.mode === 'shelfManage') return 'works'
  return 'home'
}

function bodyHome(s) {
  const books = s.books || []
  const today = s.today || 0
  const total = books.reduce((n, b) => n + (b.words || 0), 0)
  const out = []
  if (s.book) {
    out.push(card([
      h('最近在写'),
      {
        type: 'list',
        items: [{
          title: s.book.title,
          subtitle: s.book.words + ' 字 · ' + s.book.chapters.length + ' 章 · ' + (s.hasStyle ? '已蒸馏' : '未蒸馏'),
          icon: 'book',
          action: { id: 'switchTab', args: { to: 'write' } },
        }],
      },
    ]))
  } else if (books.length) {
    out.push(card([h('最近在写'), {
      type: 'list',
      items: [{
        title: books[0].title,
        subtitle: books[0].words + ' 字 · ' + books[0].chapters + ' 章',
        icon: 'book',
        action: { id: 'openBook', args: { id: books[0].id } },
      }],
    }]))
  } else {
    out.push(empty('还没有作品', '先在下面起个书名 → 点「快速新建」，再去「作品」建第 1 章。', 'book'))
  }
  out.push({
    type: 'grid',
    columns: 2,
    children: [
      { type: 'metric', label: '今日', value: String(today), tone: today > 0 ? 'good' : 'warn', trend: s.recent },
      { type: 'metric', label: '累计', value: String(total), tone: 'info' },
      { type: 'metric', label: '作品', value: String(books.length) },
      { type: 'metric', label: '连更', value: String(s.streak || 0) + ' 天' },
    ],
  })
  out.push(plain([
    acts([
      { label: 'AI 创作', action: 'openAi', icon: 'sparkle' },
      { label: '资料库', action: 'openLibrary', icon: 'folder' },
    ]),
    acts([
      { label: '体检', action: 'check', icon: 'check' },
      { label: '导出全书', action: 'export', icon: 'download' },
    ]),
  ]))
  out.push(card([form('newBook', '快速新建', [
    tf('书名', 'data.formTitle', { value: s.formTitle || '', maxLength: 40, placeholder: '新书的名字' }),
    tf('题材', 'data.formGenre', { value: s.formGenre || '', maxLength: 12, placeholder: '都市悬疑' }),
    tf('形态', 'data.formForm', { value: s.formForm || '长篇', maxLength: 4, placeholder: '长篇 / 中篇 / 短篇' }),
  ])]))
  return out
}

function bodyWorks(s) {
  const books = s.books || []
  const out = []
  if (!books.length) {
    out.push(empty('书架是空的', '先建一本。', 'book'))
  }
  if (s.book) {
    out.push(card([
      h(s.book.title),
      { type: 'progress', value: s.book.words, max: s.book.target || 100000, label: '目标 ' + (s.book.target || 100000) + ' 字', caption: Math.round((s.book.words * 100) / (s.book.target || 100000)) + '%', tone: 'good' },
      {
        type: 'list',
        items: (s.book.chapters || []).slice(0, 50).map((c) => ({
          title: c.title,
          subtitle: (c.words || 0) + ' 字' + (c.chunks > 1 ? ' · ' + c.chunks + ' 块' : ''),
          icon: 'document',
          action: { id: 'openChapter', args: { id: c.id } },
        })),
      },
      form('newChapter', '新建章节', [
        tf('章名', 'data.formChapter', { value: s.formChapter || '', maxLength: 30, placeholder: '第 1 章 借来的名字' }),
      ]),
    ]))
  }
  out.push(card([h('全部作品'), {
    type: 'list',
    items: books.slice(0, 50).map((b) => ({
      title: b.title,
      subtitle: b.genre + ' · ' + b.words + ' 字 · ' + b.chapters + ' 章',
      icon: 'book',
      action: { id: 'openBook', args: { id: b.id } },
    })),
  }]))
  out.push(card([form('newBook', '新建作品', [
    tf('书名', 'data.formTitle', { value: s.formTitle || '', maxLength: 40, placeholder: '再来一本' }),
    tf('题材', 'data.formGenre', { value: s.formGenre || '', maxLength: 12, placeholder: '都市悬疑' }),
    tf('形态', 'data.formForm', { value: s.formForm || '长篇', maxLength: 4, placeholder: '长篇 / 中篇 / 短篇' }),
  ])]))
  out.push(sections([{
    label: '作品操作',
    children: [
      acts([
        { label: '管理/删除', action: 'shelfManage', icon: 'delete' },
        { label: '导出全书', action: 'export', icon: 'download' },
      ]),
      acts([
        { label: '重建索引', action: 'rebuild', icon: 'refresh' },
        { label: '从回收站恢复', action: 'restoreTrash', icon: 'archive' },
      ]),
      h('形态 · 当前 ' + ((s.book && s.book.form) || '长篇')),
      acts([
        { label: '长篇', action: { id: 'setForm', args: { form: '长篇' } }, icon: 'book' },
        { label: '中篇', action: { id: 'setForm', args: { form: '中篇' } }, icon: 'document' },
        { label: '短篇', action: { id: 'setForm', args: { form: '短篇' } }, icon: 'article' },
      ]),
      mute('长篇：单章 2000–4000 字、留钩子；中篇：3–6 章、章末转折；短篇：一次成型、结尾反转。'),
      s.pendingDelete
        ? callout('确认删除《' + String(s.pendingDelete.title).slice(0, 18) + '》？章节和指纹一起删。', 'bad')
        : null,
      s.pendingDelete ? { type: 'confirm', id: 'confirmDelete', confirmLabel: '删除它', cancelLabel: '算了' } : null,
      s.mode === 'shelfManage'
        ? card([{
          type: 'list',
          items: (s.books || []).slice(0, 50).map((b) => ({
            title: b.title,
            subtitle: '点一下准备删除',
            icon: 'delete',
            tone: 'bad',
            action: { id: 'askDelete', args: { id: b.id } },
          })),
        }], { padding: 'S' })
        : null,
    ].filter(Boolean),
  }]))
  return out
}

function bodyWrite(s) {
  if (!s.chapterTitle) return [empty('还没打开章', '去「作品」里选一章。', 'edit')]
  return [
    card([
      { type: 'text', text: '第 ' + (s.chunk + 1) + '/' + s.chunkCount + ' 块 · ' + s.chapterWords + ' 字 · ' + saveLine(s), tone: (s.saveState && s.saveState.error) ? 'muted' : 'muted', style: { size: 'mono' } },
      form('saveChunk', '保存这块', [
        tf('正文', 'data.body', {
          multiline: true,
          maxLines: 8,
          maxLength: 1200,
          value: s.body || '',
          placeholder: '从他手里那串钥匙开始写……（自动保存开启）',
          onChange: 'draft',
        }),
      ]),
    ]),
    plain([
      acts([
        { label: '上一块', action: 'prevChunk', icon: 'back' },
        { label: '下一块', action: 'nextChunk', icon: 'expand' },
      ]),
      acts([
        { label: '目录', action: { id: 'switchTab', args: { to: 'works' } }, icon: 'list' },
        { label: '保存', action: 'saveBack', icon: 'save', style: 'primary' },
      ]),
    ]),
    callout('正文区固定 8 行高；超 1200 字请用「下一块」分段，AI 操作在「AI 创作」面板。', 'info'),
    acts([
      { label: '续写', action: 'aiContinue', icon: 'sparkle' },
      { label: '润色', action: 'aiPolish', icon: 'edit' },
    ]),
    acts([
      { label: '改写', action: 'aiRewrite', icon: 'refresh' },
      { label: '体检', action: 'check', icon: 'check' },
    ]),
  ]
}

function bodyStats(s) {
  const b = s.book
  if (!b) return [empty('还没有作品', '统计是作品级数据。', 'chart')]
  const goal = s.dailyGoal || 2000
  const today = s.today || 0
  const pct = Math.min(100, Math.round((today * 100) / goal))
  return [
    {
      type: 'grid',
      columns: 2,
      children: [
        { type: 'metric', label: '今日', value: String(today), tone: today >= goal ? 'good' : 'warn', trend: s.recent },
        { type: 'metric', label: '累计', value: String(b.words), tone: 'info' },
        { type: 'metric', label: '章数', value: String(b.chapters.length) },
        { type: 'metric', label: '均章', value: String(b.chapters.length ? Math.round(b.words / b.chapters.length) : 0) },
      ],
    },
    { type: 'progress', value: pct, max: 100, label: '今日进度', caption: pct + '%', tone: pct >= 100 ? 'good' : 'warn' },
    {
      type: 'steps',
      items: [
        { label: '建书', status: 'done' },
        { label: '第一章', status: b.chapters.length ? 'done' : 'current' },
        { label: '蒸馏母本', status: s.hasStyle ? 'done' : 'todo' },
        { label: '体检', status: b.chapters.length ? 'done' : 'todo' },
      ],
    },
  ]
}

export function studioView(s) {
  const tab = studioTabOf(s)
  const body = tab === 'write' ? bodyWrite(s) : tab === 'works' ? bodyWorks(s) : tab === 'stats' ? bodyStats(s) : bodyHome(s)
  const title = tab === 'write' && s.chapterTitle ? s.chapterTitle : s.book ? s.book.title : '写小说'
  const tags = [
    tag('v' + VERSION, 'info'),
    s.book ? tag(s.book.form || '长篇', 'info') : null,
    tag(s.hasStyle ? '已蒸馏' : (s.glStyle ? '已蒸馏（全局）' : '未蒸馏'), s.hasStyle || s.glStyle ? 'good' : 'warn'),
    tab === 'write' ? tag(saveLine(s), s.saveState && s.saveState.error ? 'bad' : s.saveState && s.saveState.pending ? 'warn' : 'good') : null,
  ].filter(Boolean)
  return page(title, 'violet', [
    head(title, s.book ? s.book.genre + ' · ' + s.book.words + ' 字' : '蒸馏母本 → 分块写作 → 体检 → 导出', tags, 'violet', [
      { label: 'AI', action: 'openAi', icon: 'sparkle' },
      { label: '设置', action: 'openSettings', icon: 'settings' },
    ]),
    mono('今日 ' + (s.today || 0) + ' 字 · 连更 ' + (s.streak || 0) + ' 天' + (s.book ? ' · ' + s.book.title : '')),
    studioTabBar(tab),
    ...body,
    mute('底部导航：首页 / 作品 / 编辑器 / 统计 —— 触摸区在上方一行。'),
  ])
}

/* ═══ 面板② AI 创作 ═══════════════════════════ */

export function aiView(s) {
  const items = (s.lastTool && s.lastTool.items) || []
  const lastAi = s.lastAi
  return page('AI 创作', 'violet', [
    head('AI 创作', s.book ? s.book.title + ' · ' + (s.chapterTitle || '未选章') : '先选一本书', [
      tag(lastAi ? '上次 ' + lastAi.kind : '还没用', lastAi ? 'good' : 'muted'),
      tag(s.hasStyle ? '带母本' : '无母本', s.hasStyle ? 'good' : 'warn'),
    ], 'violet', [
      { label: '写小说', action: 'openStudio', icon: 'edit' },
      { label: '资料库', action: 'openLibrary', icon: 'folder' },
    ]),
    (() => {
      const mk = s.market
      if (!mk || !Array.isArray(mk.rows) || !mk.rows.length) {
        return card([
          h('题材行情 · 未抓取'),
          mute('抓一次 novelcatch 分类表，脑洞就会按热门分类加权。'),
          acts([{ label: '抓取行情', action: 'marketRefresh', icon: 'cloud', style: 'primary' }]),
        ])
      }
      return card([
        h('题材行情 · ' + new Date(mk.at).toLocaleDateString('zh-CN')),
        {
          type: 'list',
          items: mk.rows.slice(0, 5).map((r) => ({
            title: r.name,
            subtitle: '首秀 ' + r.count + ' 本 · 较前期 ' + (r.delta > 0 ? '+' : '') + r.delta + ' · 在读中位 ' + r.median + ' · 头部 ' + r.conc + '%',
            trailing: String(r.score),
            icon: 'chart',
          })),
        },
        mute('右侧是机会分：单本需求越高、供给越少、头部越不垄断，分越高。'),
        acts([
          { label: '刷新行情', action: 'marketRefresh', icon: 'refresh' },
          { label: '按行情摇脑洞', action: 'toolIdea', icon: 'lightbulb', style: 'primary' },
        ]),
      ])
    })(),
    sections([
      {
        label: '生成 · 写作包',
        children: [
          callout('写作包含：母本指纹 + 人物 + 未回收伏笔 + 卷纲 + 资料 + 上一章结尾 + 8 条硬约束。生成后进输入框，不自动发送。', 'info'),
          acts([{ label: '生成写作包', action: 'aiPackage', icon: 'sparkle', style: 'primary' }]),
        ],
      },
      {
        label: '续写 / 润色 / 改写',
        children: [
          acts([
            { label: '续写 400 字', action: 'aiContinue', icon: 'sparkle' },
            { label: '润色本章', action: 'aiPolish', icon: 'edit' },
          ]),
          acts([{ label: '换开场重写', action: 'aiRewrite', icon: 'refresh' }]),
          mute('都会把提示词放进输入框；模型答完粘贴到下面结果区点「写进本章」。'),
        ],
      },
      {
        label: '剧情检查 / 人物分析',
        children: [
          acts([
            { label: '剧情检查', action: 'aiPlot', icon: 'check' },
            { label: '人物分析', action: 'aiChars', icon: 'team' },
          ]),
        ],
      },
      {
        label: '体检 · AI 味' + (s.check && s.check.score ? ' · ' + s.check.score + ' 分' : ''),
        children: (() => {
          const c = s.check || { score: 0, verdict: '还没有体检过', issues: [] }
          const tone = c.score >= 85 ? 'good' : c.score >= 70 ? 'warn' : 'bad'
          return [
            { type: 'progress', shape: 'ring', value: c.score, max: 100, label: 'AI 味', caption: c.verdict, tone },
            c.issues && c.issues.length
              ? card([{ type: 'list', items: c.issues.slice(0, 10).map((t) => ({ title: String(t), icon: 'warning', tone: 'warn' })) }], { padding: 'S' })
              : callout('没抓到明显 AI 痕迹。', 'good'),
            (s.sensitive || []).length
              ? callout('敏感词 ' + s.sensitive.length + ' 个：' + s.sensitive.slice(0, 5).map((x) => x.word).join('、'), 'warn')
              : null,
            acts([
              { label: '重新体检', action: 'check', icon: 'refresh', style: 'primary' },
              { label: '复制报告', action: 'copyCheck', icon: 'copy' },
            ]),
          ].filter(Boolean)
        })(),
      },
      {
        label: '结果回写',
        children: [
          card([form('applyAi', '写进本章', [
            tf('模型结果粘贴处', 'data.aiResult', {
              multiline: true,
              maxLines: 6,
              maxLength: 1400,
              value: s.aiResult || '',
              placeholder: '把模型的回答粘贴到这里，点下面按钮写进当前章',
              onChange: 'aiResultInput',
            }),
          ])]),
          lastAi ? mono('上次 ' + lastAi.kind + ' · ' + lastAi.chars + ' 字 · ' + clock(new Date(lastAi.at).getTime())) : mute('还没生成过'),
        ],
      },
      {
        label: '起名 / 脑洞 / 简介 / 抽卡',
        children: [
          items.length
            ? card([{
              type: 'list',
              items: items.slice(0, 12).map((t, i) => ({ title: String(t).slice(0, 60), icon: 'sparkle', action: { id: 'useToolItem', args: { i } } })),
            }], { padding: 'S' })
            : mute('点下面任意一个摇一次'),
          acts([
            { label: '人名', action: 'toolName', icon: 'user' },
            { label: '地名', action: 'toolPlace', icon: 'pin' },
          ]),
          acts([
            { label: '门派', action: 'toolSect', icon: 'team' },
            { label: '功法', action: 'toolArt', icon: 'book' },
          ]),
          acts([
            { label: '法宝', action: 'toolWeapon', icon: 'star' },
            { label: '脑洞', action: 'toolIdea', icon: 'lightbulb' },
          ]),
          acts([
            { label: '简介', action: 'toolBlurb', icon: 'article' },
            { label: '三版抽卡', action: 'toolDraw', icon: 'sparkle', style: 'primary' },
          ]),
        ],
      },
      {
        label: '小说拆解',
        children: [
          card([form('deconstruct', '拆解', [
            tf('txt 路径', 'data.deconPath', { value: s.deconPath || '/sdcard/Download/', maxLength: 200, placeholder: '/sdcard/Download/书.txt' }),
          ])]),
          s.decon && s.decon.chapters && s.decon.chapters.length
            ? card([{
              type: 'list',
              items: s.decon.chapters.slice(0, 12).map((c) => ({ title: c.title.slice(0, 24), subtitle: c.chars + ' 字 · 句长 ' + c.avg + ' · 对话 ' + c.dialogue + '%', icon: 'document' })),
            }], { padding: 'S' })
            : mute('拆完可存为母本'),
          acts([{ label: '存为母本', action: 'deconToCorpus', icon: 'save' }]),
        ],
      },
    ]),
  ])
}

/* ═══ 面板③ 资料库 ═══════════════════════════ */

export function libraryView(s) {
  const b = s.book
  if (!b) {
    return page('资料库', 'violet', [
      head('资料库', '人物 · 世界观 · 大纲 · 伏笔 · 时间线', [tag('需要作品', 'warn')], 'violet'),
      empty('还没有作品', '先在「写小说 → 作品」里建一本。', 'folder'),
      acts([{ label: '去建书', action: 'openStudio', icon: 'edit', style: 'primary' }]),
    ])
  }
  const chars = b.characters || []
  const openF = (b.foreshadows || []).filter((f) => !f.paid)
  const paidF = (b.foreshadows || []).filter((f) => f.paid)
  const world = b.world || []
  const line = b.timeline || []
  const mats = b.materials || []
  return page('资料库', 'violet', [
    head('资料库 · ' + b.title, '人物 ' + chars.length + ' · 设定 ' + world.length + ' · 时间线 ' + line.length, [
      tag('未回收伏笔 ' + openF.length, openF.length ? 'bad' : 'good'),
      tag('素材 ' + mats.length, 'info'),
    ], 'violet', [
      { label: '写小说', action: 'openStudio', icon: 'edit' },
      { label: 'AI', action: 'openAi', icon: 'sparkle' },
    ]),
    sections([
      {
        label: '人物（' + chars.length + '）',
        children: [
          chars.length
            ? card([{
              type: 'list',
              items: chars.slice(0, 20).map((c, i) => ({
                title: c.name + (c.role ? ' · ' + c.role : ''),
                subtitle: c.note ? String(c.note).slice(0, 40) : '点一下删掉',
                icon: 'user',
                action: { id: 'delCharacter', args: { i } },
              })),
            }], { padding: 'S' })
            : empty('还没有人物', '加三五个就够写作包用。', 'team'),
          card([form('addCharacter', '加人物', [
            tf('姓名', 'data.formName', { maxLength: 12, placeholder: '林晚' }),
            tf('身份', 'data.formRole', { maxLength: 12, placeholder: '女主 / 债主' }),
            tf('一句话设定', 'data.formNote', { maxLength: 40, placeholder: '左手小指有旧伤' }),
          ])]),
        ],
      },
      {
        label: '世界观（' + world.length + '）',
        children: [
          world.length
            ? card([{
              type: 'list',
              items: world.slice(0, 20).map((w, i) => ({
                title: String(w.title || '').slice(0, 20),
                subtitle: String(w.text || '').slice(0, 44) + '（点一下删掉）',
                icon: 'globe',
                action: { id: 'delWorld', args: { i } },
              })),
            }], { padding: 'S' })
            : empty('还没有设定', '地理、规则、势力都放这。', 'globe'),
          card([form('addWorld', '加设定', [
            tf('名称', 'data.formWorldTitle', { maxLength: 20, placeholder: '城中村拆迁规则' }),
            tf('内容', 'data.formWorldText', { multiline: true, maxLines: 3, maxLength: 300, placeholder: '2011 年拆的，补偿每平 3400' }),
          ])]),
        ],
      },
      {
        label: '大纲（' + (b.outline || '').length + ' 字）',
        children: [
          card([form('saveOutline', '保存大纲', [
            tf('卷纲', 'data.outline', { multiline: true, maxLines: 8, maxLength: 1200, value: b.outline || '', placeholder: '第一卷：他替人顶了三年牢……' }),
          ])]),
        ],
      },
      {
        label: '伏笔（未回收 ' + openF.length + '）',
        children: [
          openF.length
            ? card([{
              type: 'list',
              items: openF.slice(0, 12).map((f) => ({
                title: String(f.text).slice(0, 24),
                subtitle: '点一下标为已回收',
                icon: 'flag',
                tone: 'warn',
                action: { id: 'payForeshadow', args: { text: f.text } },
              })),
            }], { padding: 'S' })
            : empty('没有未回收伏笔', '干得漂亮。', 'check'),
          paidF.length ? mute('已回收 ' + paidF.length + ' 条') : null,
          card([form('addForeshadow', '加伏笔', [
            tf('伏笔', 'data.formForeshadow', { maxLength: 40, placeholder: '门童认识他的鞋' }),
          ])]),
        ].filter(Boolean),
      },
      {
        label: '时间线（' + line.length + '）',
        children: [
          line.length
            ? card([{
              type: 'list',
              items: line.slice(0, 20).map((e, i) => ({
                title: String(e.text || '').slice(0, 30),
                subtitle: (e.at ? '第 ' + e.at + ' 章 · ' : '') + '点一下删掉',
                icon: 'clock',
                action: { id: 'delEvent', args: { i } },
              })),
            }], { padding: 'S' })
            : empty('时间线是空的', '按事件顺序记一条条。', 'clock'),
          card([form('addEvent', '加事件', [
            tf('事件', 'data.formEvent', { maxLength: 80, placeholder: '他把欠条烧了' }),
            tf('第几章', 'data.formEventChapter', { maxLength: 16, placeholder: '3' }),
          ])]),
        ],
      },
      {
        label: '素材（' + mats.length + '）',
        children: [
          mats.length
            ? card([{
              type: 'list',
              items: mats.slice(0, 12).map((m, i) => ({
                title: String(m.title || '').slice(0, 20),
                subtitle: String(m.text || '').slice(0, 40) + '（点一下删掉）',
                icon: 'document',
                action: { id: 'delMaterial', args: { i } },
              })),
            }], { padding: 'S' })
            : empty('没有素材', '查到的资料放这里。', 'document'),
          card([form('addMaterial', '加素材', [
            tf('标题', 'data.matTitle', { maxLength: 20, placeholder: '拆迁时间' }),
            tf('内容', 'data.matText', { multiline: true, maxLines: 3, maxLength: 300, placeholder: '2011 年拆的' }),
          ])]),
        ],
      },
      {
        label: '技法卡 / 提示词（' + (s.skillCards || []).length + '）',
        children: [
          card([{
            type: 'list',
            items: (s.skillCards || []).slice(0, 16).map((c) => ({
              title: c.title,
              subtitle: String(c.card).slice(0, 44),
              icon: c.id === s.skillId ? 'check' : 'book',
              tone: c.id === s.skillId ? 'good' : undefined,
              action: { id: 'setSkill', args: { id: c.id } },
            })),
          }], { padding: 'S' }),
          card([form('addSkill', '加一张卡', [
            tf('名字', 'data.skillTitle', { maxLength: 12, placeholder: '三句一断' }),
            tf('规则', 'data.skillCard', { multiline: true, maxLines: 3, maxLength: 200, placeholder: '每三句必须一个短句。' }),
          ])]),
        ],
      },
    ]),
  ])
}

/* ═══ 面板④ 设置 ═══════════════════════════ */

export function settingsView(s) {
  return page('设置', 'violet', [
    head('设置', '母本 · 指纹 · 偏好 · 云同步', [
      tag(s.corpus.exists ? s.corpus.files.length + ' 个 txt' : '目录不存在', s.corpus.exists ? 'info' : 'bad'),
      tag(s.style && s.style.avg
        ? '已蒸馏 ' + (s.styleSamples || []).length + ' 本 · ' + (s.styleScope || '全局')
        : '未蒸馏', s.style && s.style.avg ? 'good' : 'warn'),
    ], 'violet', [{ label: '写小说', action: 'openStudio', icon: 'edit' }]),
    sections([
      {
        label: '母本目录',
        children: [
          card([{
            type: 'keyValue',
            items: [
              ['目录', s.corpusDir || '（未设置）'],
              ['状态', s.corpus.exists
                ? s.corpus.files.length + ' 个 txt · ' + kchars(s.corpus.chars) + (s.corpus.sampled ? ' · 大文件抽样' : '')
                : '目录不存在'],
              ['数据目录', s.paths.data],
              ['导出目录', s.paths.export],
            ],
          }], { padding: 'S' }),
          s.corpus.files.length
            ? card([{
              type: 'list',
              items: s.corpus.files.slice(0, 10).map((f) => ({
                title: f.name,
                subtitle: kchars(f.chars) + (f.sampled ? ' · 抽样' : '') + ' · 点一下删除',
                icon: 'delete',
                tone: 'bad',
                action: { id: 'askDelCorpus', args: { name: f.name } },
              })),
            }], { padding: 'S' })
            : callout('目录里还没有 txt。把同题材母本放进去，再点「蒸馏母本」。', 'warn'),
          s.pendingCorpus ? callout('确认删除母本《' + String(s.pendingCorpus.name).slice(0, 20) + '》？会移进目录里的 .trash，可手动找回。', 'bad') : null,
          s.pendingCorpus ? { type: 'confirm', id: 'confirmDelCorpus', confirmLabel: '删除它', cancelLabel: '算了' } : null,
          card([form('saveCorpus', '保存目录', [
            tf('母本目录（绝对路径）', 'data.corpusDir', { value: s.corpusDir, maxLength: 200, placeholder: '/root/.dsh/dsh-go/novel/母本' }),
          ])]),
          acts([
            { label: '重新扫描', action: 'scan', icon: 'refresh' },
            { label: '蒸馏母本', action: 'distill', icon: 'sparkle', style: 'primary' },
          ]),
        ],
      },
      {
        label: '指纹 · ' + (s.style && s.style.avg ? (s.styleSamples || []).length + ' 本' : '未蒸馏'),
        children: (() => {
          const st = s.style
          if (!st || !st.avg) {
            return [
              callout('还没有指纹。点「蒸馏母本」：读母本目录的 txt，算句长 / 波动 / 短句率 / 对话率 /「的」密度，写成 style.json。', 'info'),
              acts([{ label: '蒸馏母本', action: 'distill', icon: 'sparkle', style: 'primary' }]),
            ]
          }
          return [
            {
              type: 'grid',
              columns: 2,
              children: [
                { type: 'metric', label: '母本', value: String((s.styleSamples || []).length) + ' 本', caption: kchars(st.chars || 0) },
                { type: 'metric', label: '平均句长', value: String(st.avg) },
                { type: 'metric', label: '短句占比', value: st.short + '%', tone: st.short >= 30 ? 'good' : 'info' },
                { type: 'metric', label: '对话占比', value: st.dialogue + '%' },
              ],
            },
            card([{
              type: 'keyValue',
              items: [
                ['作用范围', s.styleScope || '全局'],
                ['指纹文件', (s.stylePath || '') + (s.styleExists ? '' : '（磁盘上没有，点蒸馏重建）')],
                ['写入时间', when(s.styleAt)],
                ['句长波动', String(st.sd) + (st.long != null ? ' · 长句 ' + st.long + '%' : '')],
                ['「的」密度', String(st.de) + '/千字'],
                ['样本', (s.styleSamples || []).map((x) => x.name + '（' + Math.round((x.chars || 0) / 1000) + 'k）').join('、').slice(0, 90) || '无'],
              ],
            }], { padding: 'S' }),
            s.styleStale ? callout('索引里有旧指纹，磁盘上却没有 style.json —— 点「重新蒸馏」会补写。', 'warn') : null,
            st.warn ? callout(String(st.warn), 'bad') : null,
            acts([
              { label: '重新蒸馏', action: 'distill', icon: 'refresh', style: 'primary' },
              { label: '清掉指纹', action: 'clearStyle', icon: 'delete' },
            ]),
          ].filter(Boolean)
        })(),
      },
      {
        label: '模型与输出偏好',
        children: [
          callout('模型在 App/引擎里选，插件不保存任何 API Key。这里只保存写作包的输出偏好。', 'info'),
          card([form('saveModelNote', '保存偏好', [
            tf('输出偏好', 'data.modelNote', { value: s.modelNote || '', maxLength: 80, placeholder: '短句优先，不要总结句' }),
          ])]),
          card([form('saveGoal', '保存目标', [
            tf('每日字数目标', 'data.dailyGoal', { value: String(s.dailyGoal), maxLength: 6 }),
          ])]),
        ],
      },
      {
        label: '脑洞源（可选联网）',
        children: [
          callout('填一个返回文本或 JSON 的地址（自己的笔记、GitHub raw、接口都行）。点「脑洞」时会先从这里取新条目，取不到用本地生成；已出现过的会避开。', 'info'),
          card([form('saveIdeaUrl', '保存地址', [
            tf('脑洞源 URL', 'data.ideaUrl', { value: s.ideaUrl || '', maxLength: 300, placeholder: 'https://example.com/ideas.json' }),
          ])]),
        ],
      },
      {
        label: '云同步 WebDAV',
        children: [
          card([form('saveWebdav', '保存地址', [
            tf('文件地址', 'data.webdavUrl', { value: (s.webdav && s.webdav.url) || '', maxLength: 300, placeholder: 'https://dav.example.com/novel.json' }),
            tf('用户名', 'data.webdavUser', { value: (s.webdav && s.webdav.user) || '', maxLength: 80, placeholder: 'me' }),
            tf('密码', 'data.webdavPass', { value: (s.webdav && s.webdav.pass) || '', maxLength: 120, placeholder: '应用专用密码' }),
          ])]),
          mute('账号明文存在本机 novel.json'),
          acts([
            { label: '备份到云端', action: 'pushCloud', icon: 'cloud' },
            { label: '从云端恢复', action: 'pullCloud', icon: 'download' },
          ]),
        ],
      },
      {
        label: '诊断 · 最近 ' + ((s.diag || []).length) + ' 次点按',
        children: [
          callout('点过的按钮都会记在这里：动作名、带了什么参数、返回了什么。有问题把这屏截图发我。', 'info'),
          (s.diag || []).length
            ? card([{
              type: 'list',
              items: (s.diag || []).slice().reverse().slice(0, 12).map((d) => ({
                title: (d.panel || '') + '.' + (d.action || '') + ' → ' + (d.error ? 'ERROR' : (d.effect || '')),
                subtitle: new Date(d.at).toLocaleTimeString('zh-CN', { hour12: false }) + ' · ' + (d.ms || 0) + 'ms · ' + String(d.value || '').slice(0, 60),
                icon: d.error ? 'warning' : 'check',
                tone: d.error ? 'bad' : undefined,
              })),
            }], { padding: 'S' })
            : mute('还没有记录。'),
          acts([{ label: '清空诊断', action: 'clearDiag', icon: 'delete' }]),
        ],
      },
      {
        label: '关于',
        children: [
          {
            type: 'keyValue',
            items: [
              ['版本', VERSION],
              ['数据', '~/.dsh/dsh-go/novel'],
              ['主题', '跟随 App 主题（插件不设定）'],
            ],
          },
        ],
      },
    ]),
  ])
}

export function viewFor(s) {
  return studioView(s)
}

export function toolPanelView(s) {
  return aiView(s)
}

export function deconPanelView(s) {
  return aiView(s)
}
