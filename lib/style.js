// lib/style.js —— 语感度量与 AI 味体检（口径与 openwrite/check.py 一致，纯函数无依赖）

const AI_WORDS = ['仿佛', '似乎', '不禁', '缓缓', '微微', '一丝', '莫名', '涌起',
  '五味杂陈', '心中暗道', '这一刻', '终于明白', '若有所思', '意味深长',
  '不易察觉', '心中一震', '复杂的神色', '思绪万千', '百感交集']
const CLICHE = ['倒吸一口凉气', '嘴角勾起', '眼神一凝', '瞳孔骤缩', '嘴角微微上扬',
  '深吸一口气', '目光深邃', '眼底闪过']
const TAIL = ['终于明白', '原来', '这一刻', '注定', '再也回不去', '一切才刚刚开始',
  '命运的齿轮', '都是真的']
const PUNCT = '，。！？…—、；：“”‘’（）'
const FUNC = '的了着过是在有和与把被给要会能就都也还又很再才只没不吗呢吧啊嗯哦么这那他她它我你们个上下里来去得地之而'

export function clean(text) {
  return String(text === null || text === undefined ? '' : text).replace(/\s+/g, '')
}

export function splitSentences(text) {
  return String(text === null || text === undefined ? '' : text)
    .split(/(?<=[。！？…])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function mean(list) {
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0
}

function pstdev(list) {
  if (list.length < 2) return 0
  const m = mean(list)
  return Math.sqrt(mean(list.map((x) => (x - m) * (x - m))))
}

function count(text, word) {
  let n = 0
  let i = text.indexOf(word)
  while (i !== -1) {
    n += 1
    i = text.indexOf(word, i + word.length)
  }
  return n
}

/** 体检一份正文。baseline 为母本指纹（distill 的产物），缺省时用绝对阈值。 */
export function analyze(text, baseline) {
  const t = String(text === null || text === undefined ? '' : text)
  const chars = clean(t).length || 1
  const sents = splitSentences(t)
  const lens = sents.map((s) => clean(s).length).filter((n) => n > 0)
  const avg = mean(lens)
  const sd = pstdev(lens)
  const short = lens.length ? (lens.filter((x) => x <= 8).length * 100) / lens.length : 0
  const long = lens.length ? (lens.filter((x) => x >= 35).length * 100) / lens.length : 0
  const dialogue = sents.length ? (sents.filter((s) => /[“「"]/.test(s)).length * 100) / sents.length : 0
  const de = (count(t, '的') * 1000) / chars
  const details = (t.match(/[0-9０-９一二三四五六七八九十百千][点时块元毛分秒年月日号度层个人]/g) || []).length
  const issues = []
  let score = 100

  const hits = {}
  let hitWords = 0
  for (const w of AI_WORDS.concat(CLICHE)) {
    const n = count(t, w)
    if (n > 0) {
      hits[w] = n
      hitWords += n
    }
  }
  for (const w of Object.keys(hits)) {
    const at = t.indexOf(w)
    const line = t.slice(0, at).split('\n').length
    issues.push('第 ' + line + ' 行「' + w + '」润滑词／烂梗，删掉换动作')
  }
  score -= Math.min(40, hitWords * 6)

  const paras = t.split('\n').map((p) => p.trim()).filter(Boolean)
  for (let i = 0; i < paras.length; i++) {
    const parts = splitSentences(paras[i])
    const last = parts.length ? parts[parts.length - 1] : paras[i]
    const hit = TAIL.find((w) => last.includes(w))
    if (hit) {
      issues.push('第 ' + (i + 1) + ' 段段尾升华「' + last.slice(0, 18) + '」，整句砍掉')
      score -= 8
    }
  }

  const sdRef = baseline && baseline.sd ? baseline.sd : 10
  if (sd < sdRef * 0.6) {
    issues.push('句长波动 ' + sd.toFixed(1) + '，母本 ' + sdRef.toFixed(1) + '，句子太齐像打字机')
    score -= 12
  }
  const shortRef = baseline && baseline.short ? baseline.short : 15
  if (short < shortRef * 0.8) {
    issues.push('8 字以内短句只占 ' + short.toFixed(1) + '%，参考 ' + shortRef.toFixed(0) + '%，缺喘息')
    score -= 10
  }
  const longRef = baseline && baseline.long ? baseline.long : 6
  if (long < longRef * 0.5) {
    issues.push('35 字以上长句只占 ' + long.toFixed(1) + '%，全是中短句也假')
    score -= 5
  }
  const diaRef = baseline && baseline.dialogue ? baseline.dialogue : 10
  if (dialogue < diaRef * 0.5) {
    issues.push('对话句占 ' + dialogue.toFixed(1) + '%，通篇叙述是 AI 最典型的形态')
    score -= 10
  }
  if (de > 45) {
    issues.push('「的」每千字 ' + de.toFixed(0) + ' 个，定语堆叠，压成名词短语')
    score -= 8
  }
  if ((details * 1000) / chars < 2) {
    issues.push('可核验细节（几点／多少钱／什么声音）每千字不到 2 处，场景是飘的')
    score -= 8
  }
  if (baseline && baseline.avg) {
    const d = avg - baseline.avg
    if (Math.abs(d) > 4) {
      issues.push('平均句长 ' + avg.toFixed(1) + '，母本 ' + baseline.avg.toFixed(1) + '，偏离 ' + d.toFixed(1))
      score -= 6
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)))
  const verdict = score >= 85 ? '可以直接发' : score >= 70 ? '再改一轮' : 'AI 味超标，重写'
  return {
    score,
    verdict,
    issues,
    hits,
    metrics: { avg, sd, short, long, dialogue, de, details, chars: chars },
  }
}

function grams(text, n, top) {
  const counts = new Map()
  const runs = String(text).match(/[\u4e00-\u9fa5]+/g) || []
  for (const run of runs) {
    for (let i = 0; i + n <= run.length; i++) {
      const g = run.slice(i, i + n)
      if ('的了着过吗呢吧啊'.includes(g[0])) continue
      if ([...g].every((c) => FUNC.includes(c))) continue
      counts.set(g, (counts.get(g) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top || 30)
    .map(([g, c]) => [g, c])
}

/** 蒸馏母本：entries = [{ name, text }] → 指纹对象 */
export function distill(entries) {
  const texts = entries.map((e) => e.text)
  const all = texts.join('\n')
  const a = analyze(all, null)
  const sents = splitSentences(all)
  const lens = sents.map((s) => clean(s).length).filter((n) => n > 0)
  const punct = {}
  for (const ch of PUNCT) {
    const n = count(all, ch)
    if (n) punct[ch] = Math.round((n * 1000) / (a.metrics.chars || 1))
  }
  const files = entries.map((e) => {
    const p = analyze(e.text, null)
    return {
      name: e.name,
      chars: p.metrics.chars,
      avg: Number(p.metrics.avg.toFixed(1)),
      sd: Number(p.metrics.sd.toFixed(1)),
      dialogue: Number(p.metrics.dialogue.toFixed(0)),
      short: Number(p.metrics.short.toFixed(0)),
    }
  })
  const spread = files.length > 1
    ? Math.max(...files.map((f) => f.avg)) - Math.min(...files.map((f) => f.avg))
    : 0
  const dspread = files.length > 1
    ? Math.max(...files.map((f) => f.dialogue)) - Math.min(...files.map((f) => f.dialogue))
    : 0
  return {
    at: new Date().toISOString(),
    chars: a.metrics.chars,
    sentences: lens.length,
    avg: Number(a.metrics.avg.toFixed(1)),
    median: lens.length ? lens.sort((x, y) => x - y)[lens.length >> 1] : 0,
    sd: Number(a.metrics.sd.toFixed(1)),
    short: Number(a.metrics.short.toFixed(0)),
    long: Number(a.metrics.long.toFixed(0)),
    dialogue: Number(a.metrics.dialogue.toFixed(0)),
    de: Number(a.metrics.de.toFixed(0)),
    punct,
    files,
    spread: Number(spread.toFixed(1)),
    dspread: Number(dspread.toFixed(0)),
    grams: grams(all, 4, 24),
    warn: spread > 3 || dspread > 15
      ? '母本风格不一致：平均句长跨度 ' + spread.toFixed(1) + ' 字、对话占比跨度 ' + dspread.toFixed(0) + '%，混了不同调性的书'
      : '',
  }
}

/** 投稿前自检用的敏感词表（可按平台继续加）。命中只提示，不改写正文。 */
export const SENSITIVE = ['赌博', '毒品', '自杀', '血腥', '肢解', '强奸', '制造炸弹',
  '枪支买卖', '洗钱', '诈骗', '拐卖', '虐杀', '器官买卖', '邪教', '传销']

export function scanSensitive(text) {
  const t = String(text || '')
  const hits = []
  for (const w of SENSITIVE) {
    const n = count(t, w)
    if (n) hits.push({ word: w, n })
  }
  return hits
}

