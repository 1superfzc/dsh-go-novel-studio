// lib/sync.js —— WebDAV 备份/恢复（node fetch，超时 15s）
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, index, saveIndex, loadBook, saveBook, loadChapter, saveChapter, ensureDir } from './store.js'

export function buildBackup() {
  const idx = index()
  const books = []
  for (const row of idx.books || []) {
    const book = loadBook(row.id)
    if (!book) continue
    const chapters = {}
    for (const c of book.chapters || []) {
      const ch = loadChapter(book.id, c.id)
      if (ch) chapters[c.id] = ch
    }
    let style = null
    try {
      style = JSON.parse(fs.readFileSync(path.join(ROOT, book.id, 'style.json'), 'utf8'))
    } catch {}
    books.push({ book, chapters, style })
  }
  return { format: 'local-novel-backup', v: 1, at: new Date().toISOString(), index: { ...idx, ui: undefined }, books }
}

export function restoreBackup(data) {
  if (!data || data.format !== 'local-novel-backup') throw new Error('不是本插件的备份文件')
  const idx = index()
  idx.books = data.index && Array.isArray(data.index.books) ? data.index.books : idx.books
  if (data.index && data.index.corpusDir) idx.corpusDir = data.index.corpusDir
  saveIndex(idx)
  for (const row of data.books || []) {
    if (!row || !row.book || !row.book.id) continue
    ensureDir(path.join(ROOT, row.book.id))
    saveBook(row.book)
    for (const [cid, ch] of Object.entries(row.chapters || {})) {
      saveChapter(row.book.id, { id: ch.id || cid, title: ch.title, chunks: ch.chunks })
    }
    if (row.style) fs.writeFileSync(path.join(ROOT, row.book.id, 'style.json'), JSON.stringify(row.style, null, 1), 'utf8')
  }
  return { books: (data.books || []).length }
}

function authHeader(user, pass) {
  return 'Basic ' + Buffer.from(String(user || '') + ':' + String(pass || '')).toString('base64')
}

async function withTimeout(promise, ms) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await promise(ctrl.signal)
  } finally {
    clearTimeout(timer)
  }
}

export async function push(cfg) {
  if (!cfg || !cfg.url) throw new Error('没配 WebDAV 地址')
  const body = JSON.stringify(buildBackup())
  if (body.length > 4 * 1024 * 1024) throw new Error('备份超过 4 MB，先精简')
  const res = await withTimeout((signal) => fetch(cfg.url, {
    method: 'PUT',
    headers: { Authorization: authHeader(cfg.user, cfg.pass), 'Content-Type': 'application/json' },
    body,
    signal,
  }), 15000)
  if (!res.ok && res.status !== 201 && res.status !== 204) throw new Error('WebDAV 返回 ' + res.status)
  return { bytes: body.length, status: res.status }
}

export async function pull(cfg) {
  if (!cfg || !cfg.url) throw new Error('没配 WebDAV 地址')
  const res = await withTimeout((signal) => fetch(cfg.url, {
    headers: { Authorization: authHeader(cfg.user, cfg.pass) },
    signal,
  }), 15000)
  if (!res.ok) throw new Error('WebDAV 返回 ' + res.status)
  const text = await res.text()
  const data = JSON.parse(text)
  return restoreBackup(data)
}
