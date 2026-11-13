// lib/store.js —— 磁盘：书／章／块、设定、每日字数、导出
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
export const ROOT = path.join(HOME, 'dsh-go', 'novel')
const INDEX_FILE = path.join(ROOT, 'novel.json')
export const DEFAULT_CORPUS = path.join(ROOT, '母本')

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

export function writeJson(file, data) {
  ensureDir(path.dirname(file))
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1), 'utf8')
  fs.renameSync(tmp, file)
}

export function byteLength(value) {
  return Buffer.byteLength(JSON.stringify(value === undefined ? null : value), 'utf8')
}

export function countWords(text) {
  return String(text === null || text === undefined ? '' : text).replace(/\s+/g, '').length
}

export function index() {
  const raw = readJson(INDEX_FILE, null)
  const base = {
    v: 1,
    books: [],
    ui: { mode: 'shelf', bookId: null, chapterId: null, chunk: 0 },
    corpusDir: DEFAULT_CORPUS,
    dailyGoal: 2000,
    modelNote: '',
    webdav: { url: '', user: '', pass: '' },
    skills: [],
    skillId: '',
    trends: { at: '', titles: [], hot: [] },
    lastTool: { kind: '', at: '', items: [] },
    lastDecon: null,
    lastCheck: null,
  }
  if (!raw || raw.v !== 1) return base
  return {
    ...base,
    ...raw,
    ui: { ...base.ui, ...(raw.ui || {}) },
    books: Array.isArray(raw.books) ? raw.books : [],
  }
}

export function saveIndex(idx) {
  try {
    if (fs.existsSync(INDEX_FILE)) fs.copyFileSync(INDEX_FILE, INDEX_FILE + '.bak')
  } catch {}
  writeJson(INDEX_FILE, idx)
}

/** 从磁盘上的 <bookId>/book.json 重建索引（索引丢了也能把书找回来） */
export function rebuildIndex() {
  const idx = index()
  const known = new Set((idx.books || []).map((b) => b.id))
  let added = 0
  let dirs = []
  try {
    dirs = fs.readdirSync(ROOT).filter((d) => /^b[a-z0-9]+$/.test(d))
  } catch {
    return { added: 0, scanned: 0 }
  }
  for (const id of dirs) {
    const book = readJson(path.join(bookDir(id), 'book.json'), null)
    if (!book || !book.id) continue
    const row = {
      id: book.id,
      title: book.title || '未命名',
      genre: book.genre || '',
      words: (book.chapters || []).reduce((n, c) => n + (c.words || 0), 0),
      chapters: (book.chapters || []).length,
      updatedAt: book.updatedAt || new Date().toISOString(),
    }
    if (!known.has(book.id)) {
      idx.books.push(row)
      known.add(book.id)
      added += 1
    } else {
      const target = idx.books.find((b) => b.id === book.id)
      Object.assign(target, row)
    }
  }
  idx.books.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
  saveIndex(idx)
  return { added, scanned: dirs.length }
}

export function bookDir(id) {
  return path.join(ROOT, id)
}

export function styleFile(bookId) {
  return path.join(bookDir(bookId), 'style.json')
}

export function loadBook(id) {
  if (!id) return null
  const raw = readJson(path.join(bookDir(id), 'book.json'), null)
  if (!raw) return null
  return {
    outline: '',
    characters: [],
    foreshadows: [],
    materials: [],
    world: [],
    timeline: [],
    corpusDir: '',
    target: 100000,
    ...raw,
  }
}

export function saveBook(book) {
  writeJson(path.join(bookDir(book.id), 'book.json'), book)
}

export function chapterFile(bookId, chapterId) {
  return path.join(bookDir(bookId), chapterId + '.json')
}

export function loadChapter(bookId, chapterId) {
  if (!bookId || !chapterId) return null
  return readJson(chapterFile(bookId, chapterId), null)
}

export function saveChapter(bookId, chapter) {
  const data = {
    id: chapter.id,
    title: chapter.title,
    chunks: Array.isArray(chapter.chunks) && chapter.chunks.length ? chapter.chunks : [''],
    updatedAt: new Date().toISOString(),
  }
  data.words = data.chunks.reduce((n, c) => n + countWords(c), 0)
  writeJson(chapterFile(bookId, data.id), data)
  const book = loadBook(bookId)
  if (book) {
    const row = book.chapters.find((c) => c.id === data.id)
    if (row) {
      row.words = data.words
      row.chunks = data.chunks.length
      row.updatedAt = data.updatedAt
    }
    book.words = book.chapters.reduce((n, c) => n + (c.words || 0), 0)
    book.updatedAt = data.updatedAt
    saveBook(book)
  }
  return data
}

export function newId(prefix) {
  return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36)
}

export function createBook(input) {
  const idx = index()
  const book = {
    id: newId('b'),
    title: String(input.title || '').trim() || '新书 ' + (idx.books.length + 1),
    genre: String(input.genre || '').trim() || '都市',
    audience: String(input.audience || '').trim() || '男频',
    premise: String(input.premise || '').trim(),
    outline: '',
    characters: [],
    foreshadows: [],
    materials: [],
    world: [],
    timeline: [],
    corpusDir: '',
    target: Number(input.target) > 0 ? Number(input.target) : 100000,
    chapters: [],
    words: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  ensureDir(bookDir(book.id))
  saveBook(book)
  idx.books.unshift({
    id: book.id,
    title: book.title,
    genre: book.genre,
    words: 0,
    chapters: 0,
    updatedAt: book.updatedAt,
  })
  idx.ui = { mode: 'book', bookId: book.id, chapterId: null, chunk: 0 }
  saveIndex(idx)
  return book
}

export function deleteBook(bookId) {
  const idx = index()
  const row = (idx.books || []).find((b) => b.id === bookId)
  if (!row) return null
  try {
    fs.rmSync(bookDir(bookId), { recursive: true, force: true })
  } catch {}
  idx.books = idx.books.filter((b) => b.id !== bookId)
  if (idx.ui && idx.ui.bookId === bookId) {
    idx.ui = { mode: 'shelf', bookId: null, chapterId: null, chunk: 0 }
  }
  delete idx.pendingDelete
  saveIndex(idx)
  return row
}

export function createChapter(bookId, title) {
  const book = loadBook(bookId)
  if (!book) return null
  const n = book.chapters.length + 1
  const chapter = {
    id: 'c' + String(n).padStart(4, '0'),
    title: String(title || '').trim() || '第 ' + n + ' 章',
    chunks: [''],
    words: 0,
    updatedAt: new Date().toISOString(),
  }
  book.chapters.push({ id: chapter.id, title: chapter.title, words: 0, chunks: 1, updatedAt: chapter.updatedAt })
  book.updatedAt = chapter.updatedAt
  saveBook(book)
  saveChapter(bookId, chapter)
  const idx = index()
  const row = idx.books.find((b) => b.id === bookId)
  if (row) {
    row.chapters = book.chapters.length
    row.updatedAt = chapter.updatedAt
  }
  idx.ui = { mode: 'write', bookId, chapterId: chapter.id, chunk: 0 }
  saveIndex(idx)
  return chapter
}

export function logFile(date) {
  return path.join(ROOT, 'log', date + '.json')
}

export function addWords(n) {
  if (!n) return todayWords()
  const date = new Date().toISOString().slice(0, 10)
  const file = logFile(date)
  const cur = readJson(file, { date, added: 0 })
  const next = { date, added: Math.max(0, (cur.added || 0) + n) }
  writeJson(file, next)
  return next.added
}

export function todayWords() {
  const date = new Date().toISOString().slice(0, 10)
  return readJson(logFile(date), { date, added: 0 }).added || 0
}

/** 最近 n 天的日字数，最旧在前（给 metric 的小折线用） */
export function recent(days) {
  const n = days || 7
  const out = []
  const day = 24 * 3600 * 1000
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * day).toISOString().slice(0, 10)
    const row = readJson(logFile(d), null)
    out.push(row ? row.acted || row.added || 0 : 0)
  }
  return out
}

/** 连续写作天数：从今天往前数，日志里 added>0 的连续天数 */
export function streak() {
  let n = 0
  const day = 24 * 3600 * 1000
  for (let i = 0; i < 400; i++) {
    const d = new Date(Date.now() - i * day).toISOString().slice(0, 10)
    const row = readJson(logFile(d), null)
    if (row && (row.added || 0) > 0) n += 1
    else if (i > 0) break
    else if (i === 0) continue
  }
  return n
}

export function exportDir() {
  if (process.env.NOVEL_EXPORT_DIR) return process.env.NOVEL_EXPORT_DIR
  return fs.existsSync('/sdcard') ? '/sdcard/Download/DSH-Go' : path.join(ROOT, 'export')
}

export function bookText(bookId, onlyChapterId) {
  const book = loadBook(bookId)
  if (!book) return null
  const lines = []
  if (!onlyChapterId) lines.push('《' + book.title + '》', '')
  for (const row of book.chapters) {
    if (onlyChapterId && row.id !== onlyChapterId) continue
    const ch = loadChapter(bookId, row.id)
    if (!ch) continue
    lines.push(ch.title, '')
    for (const chunk of ch.chunks) if (chunk.trim()) lines.push(chunk.trim(), '')
  }
  return lines.join('\n')
}

export function writeExport(name, text) {
  const dir = exportDir()
  ensureDir(dir)
  const safe = String(name).replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) || 'novel'
  const file = path.join(dir, safe + '.txt')
  fs.writeFileSync(file, text, 'utf8')
  return file
}

export function exportBook(bookId, onlyChapterId) {
  const book = loadBook(bookId)
  if (!book) return null
  const text = bookText(bookId, onlyChapterId)
  const ch = onlyChapterId ? book.chapters.find((c) => c.id === onlyChapterId) : null
  const name = ch ? book.title + '-' + ch.title : book.title
  return writeExport(name, text)
}

const BAD_LINE = ['www.', 'http', '请收藏', '本站', '手机版', '章节报错', '百度搜索', '一秒记住',
  '笔趣阁', 'txt下载', '全文阅读', '无弹窗', '更新最快', '加入书签', '投推荐票', '求月票',
  '本章未完', '点击下一页', '首发', '转载', '版权归', '如有雷同', '域名']

export function decodeBuffer(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    return new TextDecoder('gb18030').decode(buf)
  }
}

/** 扫描母本目录：返回 [{name, chars, paras}]，文件不存在时返回 [] */
export function scanCorpus(dir, limit) {
  const out = []
  if (!dir) return out
  let files = []
  try {
    files = fs.readdirSync(dir).filter((f) => /\.(txt|md)$/i.test(f)).sort()
  } catch {
    return out
  }
  for (const name of files) {
    let text
    try {
      text = decodeBuffer(fs.readFileSync(path.join(dir, name)))
    } catch {
      continue
    }
    const paras = []
    for (const line of text.split(/\r?\n/)) {
      const s = line.trim()
      if (!s) continue
      if (BAD_LINE.some((b) => s.includes(b)) && s.length < 80) continue
      if (/^[=\-*~·—_\s]{3,}$/.test(s)) continue
      paras.push(s)
    }
    const joined = paras.join('\n')
    out.push({ name, chars: joined.replace(/\s+/g, '').length, text: joined, paras })
    if (out.length >= (limit || 8)) break
  }
  return out
}

export function readCorpus(dir, limit) {
  return scanCorpus(dir, limit)
}
