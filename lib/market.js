// lib/market.js —— 抓 novelcatch 分类行情并打分（供给 vs 需求 vs 头部集中度）

const DEFAULT_URL = 'https://novelcatch.com/market'

function strip(html) {
  const noScript = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  const text = noScript.replace(/<[^>]+>/g, '\n')
  return text
    .split('\n')
    .map((s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim())
    .filter(Boolean)
}

/** 从页面文本里解析分类行情表：[{name,count,delta,median,p75,conc}] */
export function parseMarket(html) {
  const lines = strip(html)
  const rows = []
  const isNum = (s) => /^\d+$/.test(s)
  const isDelta = (s) => /^[+-]?\d+$/.test(s)
  const isPeople = (s) => /^\d[\d,]*\s*人$/.test(s)
  const isPct = (s) => /^\d+(\.\d+)?%$/.test(s)
  const num = (s) => Number(String(s).replace(/[^\d]/g, ''))
  for (let i = 0; i < lines.length - 4; i++) {
    const name = lines[i]
    if (!/^[\u4e00-\u9fa5A-Za-z]{2,10}$/.test(name)) continue
    if (!isNum(lines[i + 1])) continue
    // 较前期可能是 “+4” / “-41” 一行，也可能是 “+”“4” 两行
    let j = i + 2
    let delta = 0
    if (/^[+-]$/.test(lines[j])) {
      delta = (lines[j] === '+' ? 1 : -1) * Number(lines[j + 1] || 0)
      j += 2
    } else if (isDelta(lines[j])) {
      delta = Number(lines[j])
      j += 1
    } else {
      continue
    }
    if (!isPeople(lines[j]) || !isPeople(lines[j + 1]) || !isPct(lines[j + 2])) continue
    rows.push({
      name,
      count: num(lines[i + 1]),
      delta,
      median: num(lines[j]),
      p75: num(lines[j + 1]),
      conc: Number(lines[j + 2].replace('%', '')),
    })
    i = j + 2
  }
  return rows
}

/** 机会分：单本需求越高、供给越少、趋势向上、头部越不垄断 → 分越高 */
export function scoreRows(rows) {
  return (rows || [])
    .filter((r) => r.count >= 30 && r.median > 0)
    .map((r) => {
      // 单本需求 ÷ 供给的 0.6 次方（避免只有几十本的极小分类被高估）
      const ratio = r.median / Math.pow(Math.max(r.count, 30), 0.6)
      const trend = 1 + Math.max(-0.4, Math.min(0.4, r.delta / 50))
      const fair = 1 - Math.min(0.35, r.conc / 120)
      return { ...r, score: Math.round(ratio * trend * fair * 10) / 10 }
    })
    .sort((a, b) => b.score - a.score)
}

const HINT = {
  '男频衍生': '现实职业 + 圈子内幕 + 一单生意把人拖进去',
  '科幻末世': '规则怪谈：一条能钻的空子',
  '东方仙侠': '不打，用身份/账本/钥匙卡住所有人',
  '历史脑洞': '考据 + 一页对不上号的记载',
  '都市脑洞': '夜市/跑腿/小店，单元剧结构起量',
  '玄幻脑洞': '本土神话体系 + 现代身份错位',
  '都市高武': '武力通胀下的普通人视角',
  '都市日常': '低烈度冲突，靠细节和关系撑',
  '悬疑脑洞': '一件小事反复出现，越查越不对',
  '西方奇幻': '契约/教廷/雇佣兵，冷硬派口吻',
  '都市种田': '手艺 + 物价 + 邻里',
  '游戏体育': '赛制即结构，一场一场打',
  '历史古代': '县衙/漕运/边关，制度里找缝',
  '动漫衍生': '同人向，二设要立得住',
}

export function hintFor(name) {
  return HINT[name] || '现实职业 + 一个不该被知道的信息'
}

export async function fetchMarket(url, timeoutMs) {
  const target = url || DEFAULT_URL
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || 2500)
  try {
    const res = await fetch(target, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        Accept: 'text/html',
      },
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const html = await res.text()
    const rows = parseMarket(html)
    if (!rows.length) throw new Error('解析不到分类表')
    return { at: new Date().toISOString(), url: target, rows: scoreRows(rows) }
  } finally {
    clearTimeout(timer)
  }
}

export { DEFAULT_URL }
