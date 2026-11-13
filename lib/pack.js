// lib/pack.js —— 写作包：母本检索（bigram BM25）+ 指纹 + 人物/伏笔/大纲 + 硬约束

function tokens(s) {
  const out = []
  const runs = String(s || '').toLowerCase().match(/[\u4e00-\u9fa5]+|[a-z0-9]+/g) || []
  for (const run of runs) {
    if (/^[a-z0-9]+$/.test(run)) {
      out.push(run)
      continue
    }
    for (let i = 0; i + 1 < run.length; i++) out.push(run.slice(i, i + 2))
  }
  return out
}

/** 从母本段落里挑最贴近梗概的 k 段（≤400 段，手机上够快） */
export function retrieve(paras, query, k) {
  const docs = (paras || []).slice(0, 400)
  if (docs.length === 0) return []
  const n = docs.length
  const dtoks = docs.map(tokens)
  const df = new Map()
  for (const t of dtoks) for (const w of new Set(t)) df.set(w, (df.get(w) || 0) + 1)
  const avgdl = dtoks.reduce((a, t) => a + t.length, 0) / n || 1
  const k1 = 1.4
  const b = 0.72
  const q = tokens(query)
  return docs
    .map((text, i) => {
      const tf = new Map()
      for (const w of dtoks[i]) tf.set(w, (tf.get(w) || 0) + 1)
      let score = 0
      for (const w of q) {
        const f = tf.get(w)
        if (!f) continue
        const idf = Math.log(1 + (n - (df.get(w) || 0) + 0.5) / ((df.get(w) || 0) + 0.5))
        score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * dtoks[i].length) / avgdl))
      }
      return { score, text }
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, k || 3)
    .map((x) => x.text)
}

const FORM_RULES = {
  长篇: [
    '形态：长篇（单章 2000–4000 字）',
    '本章必须推进主线一步，并埋/接一个钩子；可以有一条支线，但不能抢主线。',
    '结尾停在钩子上，不要在本章解决读者最想知道的问题。',
  ],
  中篇: [
    '形态：中篇（全文 1–3 万字，3–6 章）',
    '每章必须完成一个小目标并改变一次关系；支线不超过一条。',
    '章末给一个明确的转折，不要留到下一章再解释。',
  ],
  短篇: [
    '形态：短篇（全文 3000–8000 字，一次成型）',
    '只写一条主线，不铺支线，不写世界观说明，出场人物不超过 4 个。',
    '开头 200 字内必须出现冲突；最后一段必须反转或留一个不好受的余味。',
    '本章就是全文，写到冲突解决即停，不要写"下一章"。',
  ],
}

const RULES = [
  '1 第一句必须是动作、声音或对话，不许写景、不许写情绪。',
  '2 禁用：仿佛 似乎 不禁 缓缓 微微 一丝 莫名 涌起 心中一震 思绪万千 若有所思。',
  '3 不写心理旁白，情绪只走动作、身体反应、对话、物件。',
  '4 每段至少一个不超过 6 字的短句。',
  '5 对话允许答非所问、被打断、说半个字就走人。',
  '6 段尾不许升华、不许总结、不许点题。',
  '7 每 500 字至少两处可核验细节：几点、多少钱、什么声音、什么牌子。',
  '8 直接给正文，不要解释、不要目录。',
]

/** 生成一段可直接粘进输入框的写作包（≤1980 字，insert 上限 2000） */
export function buildPrompt(input) {
  const style = input.style || null
  const head = ['【母本语感指纹 · 强制对齐】']
  if (style && style.avg) {
    head.push('- 平均句长 ' + style.avg + ' 字，波动 ' + style.sd + '；8 字以内短句 ' + style.short + '%，35 字以上长句 ' + style.long + '%')
    head.push('- 对话句占 ' + style.dialogue + '%，「的」每千字 ' + style.de + ' 个')
  } else {
    head.push('- 尚未蒸馏母本：按 平均句长 14 字、短句 30%、对话 40% 执行')
  }

  const cast = (input.characters || []).slice(0, 6).filter((c) => c && c.name)
  if (cast.length) {
    head.push('')
    head.push('【本章人物】')
    for (const c of cast) head.push('- ' + c.name + (c.role ? '（' + c.role + '）' : '') + (c.note ? '：' + String(c.note).slice(0, 30) : ''))
  }
  const open = (input.foreshadows || []).filter((f) => f && f.text && !f.paid).slice(0, 5)
  if (open.length) {
    head.push('')
    head.push('【未回收伏笔 · 别忘了接】')
    for (const f of open) head.push('- ' + String(f.text).slice(0, 40))
  }
  if (input.outline && String(input.outline).trim()) {
    head.push('')
    head.push('【卷纲摘要】')
    head.push(String(input.outline).trim().slice(0, 260))
  }

  if (input.materials && input.materials.length) {
    head.push('')
    head.push('【资料夹 · 事实别编错】')
    for (const m of input.materials.slice(0, 4)) head.push('- ' + String(m.title || '').slice(0, 20) + '：' + String(m.text || '').slice(0, 90))
  }
  if (input.skillCard) {
    head.push('')
    head.push('【本章技法】' + String(input.skillCard).slice(0, 120))
  }
  if (input.lastChars) {
    head.push('')
    head.push('【上一章结尾 · 衔接用，不要重复】')
    head.push(String(input.lastChars).slice(0, 600))
  }

  const samples = (input.samples || []).slice()
  const tail = ['']
  tail.push('【本章任务】')
  tail.push(input.task || '（没写梗概，就顺着上一章的最后一个动作往下写 800 字）')
  tail.push('')
  tail.push('【硬约束】')
  tail.push(...(FORM_RULES[input.form] || FORM_RULES['长篇']))
  tail.push(...RULES)
  if (input.modelNote && String(input.modelNote).trim()) {
    tail.push('')
    tail.push('【输出偏好】' + String(input.modelNote).trim().slice(0, 80))
  }

  const render = (withSamples, outlineText) => {
    const parts = head.slice()
    if (outlineText === false) {
      const i = parts.indexOf('【卷纲摘要】')
      if (i > 0) parts.splice(i - 1, 2)
    }
    if (withSamples && samples.length) {
      parts.push('')
      parts.push('【母本语感片段 · 学节奏不抄内容】')
      samples.forEach((s, i) => {
        parts.push('--- 参考 ' + (i + 1) + ' ---')
        parts.push(String(s).slice(0, 200))
      })
    }
    parts.push(...tail)
    return parts.join('\n')
  }

  let text = render(true, true)
  if (text.length > 1980) text = render(false, true)
  if (text.length > 1980) text = render(false, false)
  return text.slice(0, 1980)
}
