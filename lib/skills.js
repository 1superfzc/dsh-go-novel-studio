// lib/skills.js —— 技法卡：内置 + 自定义（写作包里勾选生效）
export const BUILTIN = [
  { id: 'cold-open', title: '冷开场', card: '前三句只写动作和声音，不出现人名；第四句才给身份。' },
  { id: 'five-sense', title: '五感两用', card: '每段至少一个听觉细节（频率、远近、金属或木头）。' },
  { id: 'dodge', title: '对话断口', card: '这一章至少一次答非所问；不许两个人都把话说完整。' },
  { id: 'object', title: '物件锚点', card: '选一件小物件贯穿全章，出现三次，每次状态不同。' },
  { id: 'hook-end', title: '悬念收尾', card: '最后一句停在一个没做完的动作上，不许解释动机。' },
  { id: 'anti-climax', title: '反高潮', card: '把爽点提前半章，结尾留一个代价，别让人痛快。' },
]

export function all(custom) {
  const list = (custom || []).filter((c) => c && c.title && c.card).map((c, i) => ({ id: 'c' + i, title: c.title, card: c.card }))
  return BUILTIN.concat(list)
}

export function byId(custom, id) {
  return all(custom).find((s) => s.id === id) || null
}
