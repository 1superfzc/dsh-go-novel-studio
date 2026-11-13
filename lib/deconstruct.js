// lib/deconstruct.js —— 本地 txt 拆解：切章 + 统计（不联网）
const CHAP = /^\s*(第[0-9一二三四五六七八九十百千零〇两]{1,8}[章节回]|Chapter\s*\d+).{0,30}$/

function stats(text) {
  const chars = String(text).replace(/\s+/g, '').length
  const sents = String(text).split(/(?<=[。！？…])/).map((s) => s.trim()).filter(Boolean)
  const lens = sents.map((s) => s.replace(/\s+/g, '').length).filter((n) => n > 0)
  const avg = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0
  const short = lens.length ? (lens.filter((x) => x <= 8).length * 100) / lens.length : 0
  const dia = sents.length ? (sents.filter((s) => /[“「"]/.test(s)).length * 100) / sents.length : 0
  return { chars, avg: Math.round(avg * 10) / 10, short: Math.round(short), dialogue: Math.round(dia) }
}

/** 切章：返回 [{ title, text, ...stats }]；没有章节标题时按 3000 字硬切 */
export function splitChapters(raw, fallbackSize) {
  const text = String(raw || '')
  const lines = text.split(/\r?\n/)
  const out = []
  let cur = { title: '开头', lines: [] }
  let sawChapter = false
  for (const line of lines) {
    if (CHAP.test(line) && line.trim().length <= 40) {
      sawChapter = true
      if (cur.lines.join('').trim()) out.push(cur)
      cur = { title: line.trim(), lines: [] }
      continue
    }
    cur.lines.push(line)
  }
  if (cur.lines.join('').trim()) out.push(cur)
  if (!sawChapter) {
    const flat = text.replace(/\s+/g, ' ').trim()
    const size = fallbackSize || 3000
    const parts = []
    for (let i = 0; i < flat.length; i += size) parts.push(flat.slice(i, i + size))
    return parts.map((p, i) => ({ title: '第 ' + (i + 1) + ' 段', text: p, ...stats(p) })).filter((c) => c.chars > 50)
  }
  return out
    .map((c) => ({ title: c.title, text: c.lines.join('\n').trim() }))
    .map((c) => ({ ...c, ...stats(c.text) }))
    .filter((c) => c.chars > 50)
}

export function summarize(chapters) {
  const chars = chapters.reduce((n, c) => n + c.chars, 0)
  const avg = chapters.length ? chars / chapters.length : 0
  const lengths = chapters.map((c) => c.chars).slice().sort((a, b) => a - b)
  return {
    chapters: chapters.length,
    chars,
    avgChapter: Math.round(avg),
    medianChapter: lengths.length ? lengths[lengths.length >> 1] : 0,
    longest: lengths.length ? lengths[lengths.length - 1] : 0,
  }
}

const STOP = ['的', '了', '是', '在', '和', '他', '她', '我', '你', '们', '这', '那', '就', '都', '也', '不', '有', '人', '一', '个']

/** 榜单/标题热词：2–3 字词频 */
export function hotWords(titles, n) {
  const counts = new Map()
  for (const t of titles || []) {
    for (const run of String(t).match(/[\u4e00-\u9fa5]+/g) || []) {
      for (const size of [2, 3]) {
        for (let i = 0; i + size <= run.length; i++) {
          const g = run.slice(i, i + size)
          if (STOP.includes(g[0]) || STOP.includes(g[g.length - 1])) continue
          counts.set(g, (counts.get(g) || 0) + 1)
        }
      }
    }
  }
  return [...counts.entries()].filter(([w, c]) => c > 1 || w.length === 3).sort((a, b) => b[1] - a[1]).slice(0, n || 20)
}
