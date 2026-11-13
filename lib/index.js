// lib/index.js —— 注册与处理（local-novel）
import fs from 'node:fs'
import path from 'node:path'
import {
  logDiag, readDiag, clearDiag,
  ROOT, index, saveIndex, loadBook, saveBook, loadChapter, saveChapter,
  createBook, createChapter, deleteBook, rebuildIndex, restoreTrash, addWords, todayWords, streak, recent, exportBook,
  scanCorpus, bookDir, styleFile, readJson, writeJson, exportDir, countWords,
  ensureDir, DEFAULT_CORPUS, decodeBuffer,
} from './store.js'
import { names, ideas, blurbs, drawPrompt } from './idea.js'
import { splitChapters, summarize, hotWords } from './deconstruct.js'
import { all as allSkills, byId as skillById } from './skills.js'
import { push as cloudPush, pull as cloudPull } from './sync.js'
import { analyze, distill, scanSensitive } from './style.js'
import { buildPrompt, retrieve } from './pack.js'
import { viewFor, studioView, aiView, libraryView, settingsView } from './views.js'

export const name = 'dsh-go-novel-studio'

const zh = (caps) => !String((caps && caps.locale) || '').startsWith('en')

let draftCache = ''
let saveState = { at: 0, error: '', pending: false }
let saveTimer = null
let corpusCache = { dir: '', at: 0, files: [] }

function ui() {
  return index().ui
}

function setUi(patch) {
  const idx = index()
  idx.ui = { ...idx.ui, ...patch }
  saveIndex(idx)
  return idx.ui
}

function corpusFiles(dir) {
  const now = Date.now()
  if (corpusCache.dir === dir && now - corpusCache.at < 5000) return corpusCache.files
  const files = scanCorpus(dir, 12, 4000).map((f) => ({ name: f.name, chars: f.fullChars || f.chars, sampled: !!f.sampled }))
  corpusCache = { dir, at: now, files }
  return files
}

function corpusDirOf(book) {
  const idx = index()
  return (book && book.corpusDir) || idx.corpusDir
}

/** 真机表单回传是 { values: { 'data.xxx': 值 } }，这里统一拍平：保留原 key，同时去掉 data. 前缀 */
function flatten(value, out) {
  const acc = out || {}
  if (value === undefined || value === null) return acc
  if (typeof value !== 'object') return acc
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      acc[k] = v
      if (k.startsWith('data.')) acc[k.slice(5)] = v
    } else if (v && typeof v === 'object') {
      flatten(v, acc)
    }
  }
  return acc
}

function fieldText(value, keys) {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  const flat = flatten(value)
  for (const k of keys || []) {
    const v = flat[k]
    if (typeof v === 'string') return v
    if (typeof v === 'number') return String(v)
  }
  let best = ''
  for (const v of Object.values(flat)) {
    if (typeof v === 'string' && v.length > best.length) best = v
  }
  return best
}

function currentBook() {
  return loadBook(ui().bookId)
}

function ensureChapter() {
  const state = ui()
  let book = bookOf(state.bookId)
  // 没有当前书：自动落到最近一本书，别让 AI 按钮点了没反应
  if (!book) {
    const idx = index()
    const first = (idx.books || [])[0]
    if (first) {
      book = bookOf(first.id)
      if (book) setUi({ bookId: book.id, chapterId: null, chunk: 0 })
    }
  }
  if (!book) return { book: null, chapter: null }
  let chapter = state.chapterId ? loadChapter(book.id, state.chapterId) : null
  if (!chapter && (book.chapters || []).length) {
    const last = book.chapters[book.chapters.length - 1]
    chapter = loadChapter(book.id, last.id)
    if (chapter) setUi({ bookId: book.id, chapterId: chapter.id, chunk: 0 })
  }
  return { book, chapter }
}

function bookOf(id) {
  return id ? loadBook(id) : null
}

function styleOf(book) {
  if (!book) return null
  return readJson(styleFile(book.id), null)
}

function fullText(chapter) {
  return ((chapter && chapter.chunks) || []).join('\n')
}

function snapshot() {
  const idx = index()
  const state = idx.ui || {}
  const book = bookOf(state.bookId)
  const s = {
    mode: state.mode || 'shelf',
    glStyle: idx.style || null,
    today: todayWords(),
    dailyGoal: idx.dailyGoal || 2000,
    streak: streak(),
    recent: recent(7),
    formTitle: '',
    formGenre: '',
    formChapter: '',
    formName: '',
    formRole: '',
    formNote: '',
    formForeshadow: '',
    matTitle: '',
    matText: '',
    trendText: '',
    skillTitle: '',
    skillCard: '',
    deconPath: '',
    books: idx.books || [],
    book: null,
    hasStyle: false,
    style: null,
    check: idx.lastCheck || null,
    sensitive: [],
    chunk: state.chunk || 0,
    chunkCount: 1,
    chapterWords: 0,
    chapterTitle: '',
    body: '',
    outline: '',
    materials: [],
    skillCards: allSkills(idx.skills),
    skillId: idx.skillId || '',
    activeSkill: (() => {
      const s = skillById(idx.skills, idx.skillId)
      return s ? s.title : ''
    })(),
    lastTool: idx.lastTool || { kind: '', items: [] },
    decon: idx.lastDecon || null,
    deconPath: '',
    trends: idx.trends || { hot: [] },
    pendingDelete: idx.pendingDelete || null,
    moreOpen: !!idx.moreOpen,
    saveState: saveState,
    lastAi: idx.lastAi || null,
    formWorldTitle: '',
    formWorldText: '',
    formEvent: '',
    formEventChapter: '',
    aiResult: idx.aiResult || '',
  }
  if (book) {
    s.book = {
      id: book.id,
      title: book.title,
      genre: book.genre,
      words: book.words || 0,
      target: book.target || 100000,
      chapters: (book.chapters || []).map((c) => ({ ...c })),
      characters: book.characters || [],
      foreshadows: book.foreshadows || [],
      outline: book.outline || '',
      world: book.world || [],
      timeline: book.timeline || [],
    }
    s.materials = book.materials || []
    const style = styleOf(book) || idx.style || null
    if (style) {
      s.hasStyle = true
      s.style = style
    }
    if (state.chapterId) {
      const ch = loadChapter(book.id, state.chapterId)
      if (ch) {
        const chunks = ch.chunks && ch.chunks.length ? ch.chunks : ['']
        const c = Math.min(Math.max(0, state.chunk || 0), chunks.length - 1)
        s.chunk = c
        s.chunkCount = chunks.length
        s.body = chunks[c] || ''
        s.chapterTitle = ch.title
        s.chapterWords = ch.words || 0
      }
    }
  }
  if (s.check && s.check.sensitive) s.sensitive = s.check.sensitive
  return s
}

function settingsSnapshot() {
  const idx = index()
  const book = bookOf(idx.ui && idx.ui.bookId)
  const dir = corpusDirOf(book)
  const files = corpusFiles(dir)
  const style = book ? styleOf(book) : idx.style || null
  return {
    corpusDir: dir,
    corpus: { exists: fs.existsSync(dir), files, chars: files.reduce((n, f) => n + (f.chars || 0), 0) },
    style,
    dailyGoal: idx.dailyGoal || 2000,
    modelNote: idx.modelNote || '',
    webdav: idx.webdav || { url: '', user: '', pass: '' },
    diag: readDiag(12).map((d) => ({ ...d })),
    skillCount: (idx.skills || []).length,
    scope: book && book.corpusDir ? '本书覆盖' : '全局',
    paths: {
      data: ROOT,
      export: exportDir(),
      style: book && book.corpusDir ? styleFile(book.id) : (idx.style ? ROOT + '/style.json（全局）' : (book ? styleFile(book.id) : '')),
    },
  }
}

function analyzeChapter(book, chapter) {
  const text = fullText(chapter)
  const res = analyze(text, styleOf(book))
  const sensitive = scanSensitive(text)
  const idx = index()
  idx.lastCheck = {
    score: res.score,
    verdict: res.verdict,
    issues: res.issues,
    sensitive,
    at: new Date().toISOString(),
    chapter: chapter ? chapter.title : '',
  }
  saveIndex(idx)
  return res
}

function saveCurrentChunk(event) {
  const { book, chapter } = ensureChapter()
  if (!book || !chapter) return { toast: '先打开一章再保存' }
  const body = fieldText(event && event.value, ['body', 'data.body', '正文']) || draftCache
  if (!body || !body.trim()) return { toast: '这块还是空的' }
  const state = ui()
  const c = Math.min(Math.max(0, state.chunk || 0), chapter.chunks.length - 1)
  const before = (book.chapters.find((x) => x.id === chapter.id) || {}).words || 0
  chapter.chunks[c] = body
  const saved = saveChapter(book.id, chapter)
  addWords(saved.words - before)
  draftCache = ''
  saveState = { at: Date.now(), error: '', pending: false }
  return { saved, toast: '已保存 · 本章 ' + saved.words + ' 字' }
}

function makePack(taskOverride) {
  const { book, chapter } = ensureChapter()
  if (!book || !chapter) return { toast: '先打开一章' }
  const style = styleOf(book)
  const paras = []
  for (const doc of scanCorpus(corpusDirOf(book), 6)) {
    for (const p of doc.paras) if (p.length >= 60) paras.push(p)
    if (paras.length >= 240) break
  }
  const task = taskOverride || ((book.premise ? book.premise + '；' : '') + '接着上一章的最后一个动作往下写一章，本章：' + (chapter.title || '未定'))
  const rows = book.chapters || []
  const at = rows.findIndex((r) => r.id === chapter.id)
  let lastChars = ''
  if (at > 0) {
    const prev = loadChapter(book.id, rows[at - 1].id)
    const t = fullText(prev)
    lastChars = t.length > 600 ? t.slice(-600) : t
  }
  const idx2 = index()
  const skill = skillById(idx2.skills, idx2.skillId)
  const text = buildPrompt({
    task,
    style,
    samples: retrieve(paras, task, 3),
    characters: book.characters || [],
    foreshadows: book.foreshadows || [],
    outline: book.outline || '',
    materials: book.materials || [],
    skillCard: skill ? skill.card : '',
    lastChars,
    modelNote: idx2.modelNote || '',
  })
  return { insert: text, toast: '写作包已放进输入框' }
}


function recordAi(kind, text) {
  const idx = index()
  idx.lastAi = { kind, at: new Date().toISOString(), chars: String(text || '').length }
  saveIndex(idx)
  return idx.lastAi
}

function brief(value) {
  try {
    const s = JSON.stringify(value === undefined ? null : value)
    return s.length > 260 ? s.slice(0, 260) + '…' : s
  } catch {
    return '[(不可序列化)]'
  }
}

/** 给面板的所有动作套一层诊断日志：谁点了、带了什么参数、返回了什么 */
function traced(panelId, actions) {
  const out = {}
  for (const [name, fn] of Object.entries(actions)) {
    out[name] = async (scope, event) => {
      const started = Date.now()
      let result
      let err = ''
      try {
        result = await fn(scope, event)
      } catch (error) {
        err = String((error && error.message) || error)
        logDiag({ at: new Date().toISOString(), panel: panelId, action: name, value: brief(event && event.value), keys: event && event.value && typeof event.value === 'object' ? Object.keys(event.value) : [], ms: Date.now() - started, error: err.slice(0, 120) })
        throw error
      }
      const effs = Array.isArray(result) ? result : result ? [result] : []
      logDiag({
        at: new Date().toISOString(),
        panel: panelId,
        action: name,
        value: brief(event && event.value),
        keys: event && event.value && typeof event.value === 'object' ? Object.keys(event.value) : [],
        effect: effs.map((e) => e && (e.type || Object.keys(e)[0])).join('+') || '(none)',
        ms: Date.now() - started,
      })
      return result
    }
  }
  return out
}

function setTool(kind, items) {
  const idx = index()
  idx.lastTool = { kind, at: new Date().toISOString(), items: (items || []).slice(0, 12) }
  saveIndex(idx)
}

export function apply(ctx) {
  ctx.inject(['dshGo'], (ctx) => {
    try {
      ensureDir(DEFAULT_CORPUS)
    } catch {}
    ctx.dshGo.panel('studio', {
      view: () => studioView(snapshot()),
      data: (scope, emit) => {
        emit(snapshot())
        return () => {}
      },
      actions: traced('studio', {
        draft(scope, event) {
          const t = fieldText(event && event.value, ['body', '正文'])
          if (!t) return {}
          draftCache = t
          saveState = { ...saveState, pending: true, error: '' }
          if (saveTimer) clearTimeout(saveTimer)
          saveTimer = setTimeout(() => {
            saveTimer = null
            try {
              const { book, chapter } = ensureChapter()
              if (!book || !chapter) {
                saveState = { at: Date.now(), error: '', pending: false }
                return
              }
              const c = Math.min(Math.max(0, ui().chunk || 0), chapter.chunks.length - 1)
              chapter.chunks[c] = draftCache
              saveChapter(book.id, chapter)
              saveState = { at: Date.now(), error: '', pending: false }
            } catch (error) {
              saveState = { at: Date.now(), error: String((error && error.message) || error).slice(0, 40), pending: false }
            }
          }, 1200)
          if (saveTimer.unref) saveTimer.unref()
          return {}
        },

        newBook(scope, event) {
          const v = (event && event.value) || {}
          const title = fieldText(v, ['formTitle', 'data.formTitle', 'title'])
          if (!title.trim()) return { toast: '先起个书名' }
          const genre = fieldText(v, ['formGenre']) || '都市'
          createBook({ title, genre })
          return { toast: '建好了：' + title.trim().slice(0, 12), refresh: true }
        },

        openBook(scope, event) {
          const v = (event && event.value) || {}
          const id = typeof v === 'string' ? v : v.id
          if (!bookOf(id)) return { toast: '这本书打不开了' }
          setUi({ mode: 'book', bookId: id, chapterId: null, chunk: 0 })
          return { refresh: true }
        },

        newChapter(scope, event) {
          const v = (event && event.value) || {}
          const state = ui()
          if (!state.bookId) return { toast: '先打开一本书' }
          createChapter(state.bookId, fieldText(v, ['formChapter', 'data.formChapter', 'title']))
          return { toast: '新章开好了', refresh: true }
        },

        openChapter(scope, event) {
          const v = (event && event.value) || {}
          const id = typeof v === 'string' ? v : v.id
          if (!id) return { toast: '没找到这一章' }
          setUi({ mode: 'write', chapterId: id, chunk: 0 })
          return { refresh: true }
        },

        saveChunk(scope, event) {
          const r = saveCurrentChunk(event)
          return { toast: r.toast, refresh: !!(r.saved) }
        },

        saveBack(scope, event) {
          const r = saveCurrentChunk(event)
          setUi({ mode: 'book', chunk: 0 })
          return { toast: r.toast, refresh: true }
        },

        prevChunk() {
          const state = ui()
          setUi({ chunk: Math.max(0, (state.chunk || 0) - 1) })
          return { refresh: true }
        },

        nextChunk() {
          const { book, chapter } = ensureChapter()
          if (!book || !chapter) return { toast: '先打开一章' }
          const c = ui().chunk || 0
          if (c + 1 >= chapter.chunks.length) {
            chapter.chunks.push('')
            saveChapter(book.id, chapter)
          }
          setUi({ chunk: c + 1 })
          return { refresh: true }
        },

        check() {
          const { book, chapter } = ensureChapter()
          if (!book || !chapter) return { toast: '先打开一章' }
          const res = analyzeChapter(book, chapter)
          setUi({ mode: 'check' })
          return { toast: '体检 ' + res.score + ' 分 · ' + res.verdict, refresh: true }
        },

        back() {
          const state = ui()
          if (state.mode === 'shelf') return { refresh: true }
          if (state.mode === 'shelfManage') {
            const idx = index()
            delete idx.pendingDelete
            saveIndex(idx)
            setUi({ mode: 'shelf' })
            return { refresh: true }
          }
          if (state.mode === 'book') setUi({ mode: 'shelf', bookId: null, chapterId: null, chunk: 0 })
          else if (state.mode === 'check') setUi({ mode: 'write' })
          else setUi(state.bookId ? { mode: 'book', chunk: 0 } : { mode: 'shelf', chunk: 0 })
          return { refresh: true }
        },

        backWrite() {
          setUi({ mode: 'write' })
          return { refresh: true }
        },

        outline() {
          setUi({ mode: 'outline' })
          return { refresh: true }
        },

        saveOutline(scope, event) {
          const book = currentBook()
          if (!book) return { toast: '先打开一本书' }
          const v = (event && event.value) || {}
          book.outline = fieldText(v, ['outline', 'data.outline', '卷纲']).slice(0, 4000)
          saveBook(book)
          return { toast: '卷纲已存（' + book.outline.length + ' 字）', refresh: true }
        },

        packOutline() {
          const book = currentBook()
          if (!book) return { toast: '先打开一本书' }
          if (!book.outline || !book.outline.trim()) return { toast: '卷纲还是空的' }
          const r = makePack(book.outline.trim().slice(0, 400))
          return r
        },

        pack() {
          return makePack(null)
        },

        roster() {
          setUi({ mode: 'roster' })
          return { refresh: true }
        },

        stats() {
          setUi({ mode: 'stats' })
          return { refresh: true }
        },

        addCharacter(scope, event) {
          const book = currentBook()
          if (!book) return { toast: '先打开一本书' }
          const v = (event && event.value) || {}
          const name = fieldText(v, ['formName']).trim()
          if (!name) return { toast: '先写个名字' }
          book.characters = book.characters || []
          if (book.characters.length >= 40) return { toast: '人物太多，先删几个' }
          book.characters.push({ name: name.slice(0, 12), role: fieldText(v, ['formRole']).slice(0, 12), note: fieldText(v, ['formNote']).slice(0, 60) })
          saveBook(book)
          return { toast: '加上了 ' + name, refresh: true }
        },

        delCharacter(scope, event) {
          const book = currentBook()
          if (!book) return { toast: '先打开一本书' }
          const v = (event && event.value) || {}
          const i = Number(v.i)
          if (!Number.isInteger(i) || !book.characters || !book.characters[i]) return { toast: '没找到这个人物' }
          const [gone] = book.characters.splice(i, 1)
          saveBook(book)
          return { toast: '删掉了 ' + gone.name, refresh: true }
        },

        addForeshadow(scope, event) {
          const book = currentBook()
          if (!book) return { toast: '先打开一本书' }
          const v = (event && event.value) || {}
          const text = fieldText(v, ['formForeshadow']).trim()
          if (!text) return { toast: '伏笔还是空的' }
          book.foreshadows = book.foreshadows || []
          book.foreshadows.push({ text: text.slice(0, 60), paid: false, at: new Date().toISOString() })
          saveBook(book)
          return { toast: '伏笔记下了', refresh: true }
        },

        payForeshadow(scope, event) {
          const book = currentBook()
          if (!book) return { toast: '先打开一本书' }
          const v = (event && event.value) || {}
          const row = (book.foreshadows || []).find((f) => f.text === v.text)
          if (!row) return { toast: '没找到这条伏笔' }
          row.paid = true
          saveBook(book)
          return { toast: '标为已回收', refresh: true }
        },

        copyCheck() {
          const c = index().lastCheck
          if (!c) return { toast: '还没有体检结果' }
          const sens = (c.sensitive || []).map((x) => x.word + '×' + x.n).join('、')
          const text = 'AI 味复检 ' + c.score + '/100 · ' + c.verdict + '\n' + (c.issues || []).join('\n') + (sens ? '\n敏感词：' + sens : '')
          return { copy: text.slice(0, 6000), toast: '报告已复制' }
        },

        toggleMore() {
          const idx = index()
          idx.moreOpen = !idx.moreOpen
          saveIndex(idx)
          return { refresh: true }
        },

        switchTab(scope, event) {
          const v = (event && event.value) || {}
          const to = typeof v === 'string' ? v : v.to
          const map = {
            home: 'shelf',
            works: 'book',
            shelf: 'shelf',
            chapters: 'book',
            shelfManage: 'shelfManage',
            write: 'write',
            outline: 'outline',
            roster: 'roster',
            material: 'material',
            check: 'check',
            stats: 'stats',
            skills: 'skills',
            tools: 'tools',
            decon: 'decon',
          }
          const mode = map[to]
          if (!mode) return { toast: '这个按钮没带模块参数（' + String(to || '空') + '）' }
          setUi({ mode })
          return { refresh: true }
        },

        restoreTrash() {
          const r = restoreTrash()
          return { toast: r.restored ? '从回收站找回 ' + r.restored + ' 本' : '回收站是空的', refresh: true }
        },

        rebuild() {
          const r = rebuildIndex()
          return { toast: '重建完成 · 新找回 ' + r.added + ' 本 / 扫描 ' + r.scanned + ' 个目录', refresh: true }
        },

        shelfManage() {
          setUi({ mode: 'shelfManage' })
          return { refresh: true }
        },

        deleteThisBook() {
          const idx = index()
          const row = (idx.books || []).find((b) => b.id === (idx.ui && idx.ui.bookId))
          if (!row) return { toast: '先打开一本书' }
          idx.pendingDelete = { id: row.id, title: row.title }
          saveIndex(idx)
          setUi({ mode: 'shelfManage' })
          return { refresh: true }
        },

        askDelete(scope, event) {
          const v = (event && event.value) || {}
          const id = typeof v === 'string' ? v : v.id
          const idx = index()
          const row = (idx.books || []).find((b) => b.id === id)
          if (!row) return { toast: '这本书已经不在了' }
          idx.pendingDelete = { id: row.id, title: row.title }
          saveIndex(idx)
          setUi({ mode: 'shelfManage' })
          return { refresh: true }
        },

        confirmDelete(scope, event) {
          const v = (event && event.value) || {}
          const idx = index()
          const pending = idx.pendingDelete
          if (!v.confirmed) {
            delete idx.pendingDelete
            saveIndex(idx)
            return { toast: '没删', refresh: true }
          }
          if (!pending) return { toast: '没有待删的书', refresh: true }
          const gone = deleteBook(pending.id)
          return { toast: gone ? '删掉了《' + String(gone.title).slice(0, 10) + '》' : '没找到这本书', refresh: true }
        },

        tools() {
          return { open: 'panel:tools' }
        },

        decon() {
          return { open: 'panel:decon' }
        },

        material() {
          setUi({ mode: 'material' })
          return { refresh: true }
        },

        skills() {
          setUi({ mode: 'skills' })
          return { refresh: true }
        },

        toolName() { setTool('人名', names('name', 8)); return { toast: '摇了 8 个名字', refresh: true } },
        toolPlace() { setTool('地名', names('place', 8)); return { toast: '摇了 8 个地名', refresh: true } },
        toolSect() { setTool('门派', names('sect', 8)); return { toast: '摇了 8 个门派', refresh: true } },
        toolArt() { setTool('功法', names('art', 8)); return { toast: '摇了 8 门功法', refresh: true } },
        toolWeapon() { setTool('法宝', names('weapon', 8)); return { toast: '摇了 8 件兵器', refresh: true } },
        toolIdea() { setTool('脑洞', ideas(5)); return { toast: '摇了 5 个脑洞', refresh: true } },

        toolBlurb() {
          const book = currentBook()
          setTool('简介', blurbs(book || {}))
          return { toast: '三个简介骨架', refresh: true }
        },

        toolDraw() {
          return { insert: drawPrompt(), toast: '抽卡提示已放进输入框' }
        },

        useToolItem(scope, event) {
          const v = (event && event.value) || {}
          const items = (index().lastTool || {}).items || []
          const item = items[Number(v.i)]
          if (!item) return { toast: '这一条没了，再摇一次' }
          return { insert: String(item).slice(0, 1900), toast: '已放进输入框' }
        },

        deconstruct(scope, event) {
          const v = (event && event.value) || {}
          const file = fieldText(v, ['deconPath']).trim()
          if (!file) return { toast: '填个 txt 路径' }
          let raw
          try {
            raw = decodeBuffer(fs.readFileSync(file))
          } catch {
            return { toast: '打不开这个文件' }
          }
          const chapters = splitChapters(raw, 3000)
          if (!chapters.length) return { toast: '没切出章节来' }
          const idx = index()
          idx.lastDecon = {
            at: new Date().toISOString(),
            file,
            summary: summarize(chapters),
            chapters: chapters.slice(0, 60).map((c) => ({ title: c.title, chars: c.chars, avg: c.avg, short: c.short, dialogue: c.dialogue })),
          }
          saveIndex(idx)
          return { toast: '拆出 ' + chapters.length + ' 章 · ' + summarize(chapters).chars + ' 字', refresh: true }
        },

        deconToCorpus() {
          const idx = index()
          const d = idx.lastDecon
          if (!d) return { toast: '先拆一本' }
          const book = bookOf(idx.ui && idx.ui.bookId)
          const dir = corpusDirOf(book)
          try {
            ensureDir(dir)
            const raw = decodeBuffer(fs.readFileSync(d.file))
            const name = path.basename(d.file).replace(/\.txt$/i, '') + '.txt'
            fs.writeFileSync(path.join(dir, name), raw, 'utf8')
            corpusCache = { dir: '', at: 0, files: [] }
            return { toast: '已存成母本：' + name.slice(0, 16) }
          } catch {
            return { toast: '存母本失败（目录能不能写？）' }
          }
        },

        addMaterial(scope, event) {
          const book = currentBook()
          if (!book) return { toast: '先打开一本书' }
          const v = (event && event.value) || {}
          const title = fieldText(v, ['matTitle']).trim()
          const text = fieldText(v, ['matText']).trim()
          if (!title) return { toast: '给资料起个标题' }
          book.materials = book.materials || []
          if (book.materials.length >= 20) return { toast: '资料夹满了，先删几条' }
          book.materials.push({ title: title.slice(0, 20), text: text.slice(0, 300) })
          saveBook(book)
          return { toast: '存进资料夹', refresh: true }
        },

        delMaterial(scope, event) {
          const book = currentBook()
          if (!book) return { toast: '先打开一本书' }
          const v = (event && event.value) || {}
          const i = Number(v.i)
          if (!Number.isInteger(i) || !book.materials || !book.materials[i]) return { toast: '没找到这条' }
          book.materials.splice(i, 1)
          saveBook(book)
          return { toast: '删掉了', refresh: true }
        },

        addTrend(scope, event) {
          const v = (event && event.value) || {}
          const raw = String(v.trendText || v['data.trendText'] || '').trim()
          if (!raw) return { toast: '先粘贴书名列表' }
          const titles = raw.split(/\n|、|,|，/).map((s) => s.trim()).filter(Boolean).slice(0, 60)
          const idx = index()
          idx.trends = { at: new Date().toISOString(), titles, hot: hotWords(titles, 20) }
          saveIndex(idx)
          return { toast: '分析了 ' + titles.length + ' 个书名', refresh: true }
        },

        setSkill(scope, event) {
          const v = (event && event.value) || {}
          const idx = index()
          idx.skillId = idx.skillId === v.id ? '' : v.id
          saveIndex(idx)
          return { toast: idx.skillId ? '本章技法已选' : '技法已取消', refresh: true }
        },

        addSkill(scope, event) {
          const v = (event && event.value) || {}
          const title = fieldText(v, ['skillTitle']).trim()
          const card = fieldText(v, ['skillCard']).trim()
          if (!title || !card) return { toast: '名字和规则都要填' }
          const idx = index()
          idx.skills = (idx.skills || []).concat([{ title: title.slice(0, 12), card: card.slice(0, 200) }]).slice(0, 20)
          saveIndex(idx)
          return { toast: '加了一张卡', refresh: true }
        },

        openSettings() {
          return { open: 'panel:settings' }
        },

        openAi() {
          return { open: 'panel:ai' }
        },

        openLibrary() {
          return { open: 'panel:library' }
        },

        distill() {
          const state = ui()
          const book = bookOf(state.bookId)
          const dir = corpusDirOf(book)
          const docs = scanCorpus(dir, 8, 150000)
          if (!docs.length) return { toast: '母本目录是空的：' + String(dir).slice(-14) }
          const prof = distill(docs.map((d) => ({ name: d.name, text: d.text })))
          if (book) writeJson(styleFile(book.id), prof)
          else {
            const idx = index()
            idx.style = prof
            saveIndex(idx)
          }
          corpusCache.at = 0
          const msg = '蒸馏完：' + prof.files.length + ' 本 / ' + prof.chars + ' 字'
          return { toast: msg.slice(0, 40), refresh: true }
        },

        export() {
          const state = ui()
          if (!state.bookId) return { toast: '先打开一本书' }
          try {
            const file = exportBook(state.bookId)
            if (!file) return { toast: '导出失败' }
            return { toast: '已导出 ' + path.basename(file).slice(0, 24) }
          } catch (error) {
            return { toast: '导出失败：' + String((error && error.message) || error).slice(0, 20) }
          }
        },

        exportChapter() {
          const state = ui()
          if (!state.bookId || !state.chapterId) return { toast: '先打开一章' }
          try {
            const file = exportBook(state.bookId, state.chapterId)
            if (!file) return { toast: '导出失败' }
            return { toast: '已导出 ' + path.basename(file).slice(0, 22) }
          } catch (error) {
            return { toast: '导出失败：' + String((error && error.message) || error).slice(0, 20) }
          }
        },
      }),
    })



    ctx.dshGo.panel('ai', {
      view: () => aiView(snapshot()),
      data: (scope, emit) => {
        emit(snapshot())
        return () => {}
      },
      actions: traced('ai', {
        aiPackage() {
          return makePack(null)
        },
        aiContinue() {
          const { book, chapter } = ensureChapter()
          if (!book || !chapter) return { toast: '先打开一章' }
          const rows = book.chapters || []
          const at = rows.findIndex((r) => r.id === chapter.id)
          let tail = fullText(chapter)
          if (at > 0) {
            const prev = loadChapter(book.id, rows[at - 1].id)
            tail = (fullText(prev) + '\n' + tail).slice(-600)
          }
          const text = ['接着下面这段往下写 400 字，只续写，不总结、不评价、不要小标题。', '保持同一人称、同一时态；第一句必须承接最后一个动作。', '', '【原文结尾】', tail.slice(-400)].join('\n')
          recordAi('续写', text)
          return { insert: text.slice(0, 1980), toast: '续写提示已放进输入框' }
        },
        aiPolish() {
          const { chapter } = ensureChapter()
          if (!chapter) return { toast: '先打开一章' }
          const body = fullText(chapter).slice(0, 1200)
          if (!body.trim()) return { toast: '这一章还没有正文' }
          const text = ['润色下面的正文：不改剧情、不改人物关系、不增删情节。', '只调整句序、句长和用词，删掉形容词堆叠。直接输出润色后的正文，不要解释。', '', '【正文】', body].join('\n')
          recordAi('润色', text)
          return { insert: text.slice(0, 1980), toast: '润色提示已放进输入框' }
        },
        aiRewrite() {
          const { chapter } = ensureChapter()
          if (!chapter) return { toast: '先打开一章' }
          const body = fullText(chapter).slice(0, 1000)
          if (!body.trim()) return { toast: '这一章还没有正文' }
          const text = ['把下面这段换一个开场方式重写：信息点必须全保留，只换切入角度和顺序。', '输出重写后的正文，不要解释。', '', '【原文】', body].join('\n')
          recordAi('改写', text)
          return { insert: text.slice(0, 1980), toast: '改写提示已放进输入框' }
        },
        aiPlot() {
          const { book, chapter } = ensureChapter()
          if (!book || !chapter) return { toast: '先打开一章' }
          const body = fullText(chapter).slice(0, 1000)
          const cast = (book.characters || []).slice(0, 5).map((c) => c.name + (c.role ? '(' + c.role + ')' : '')).join('、')
          const open = (book.foreshadows || []).filter((f) => !f.paid).slice(0, 5).map((f) => f.text).join('；')
          const text = ['检查这一章的剧情问题：时间线、人物动机、伏笔是否自洽、爽点落点。', '只列具体问题，最多 5 条，每条指出位置并给一句改法。不要复述剧情。', '', '【人物】' + (cast || '未设置'), '【未回收伏笔】' + (open || '无'), '【本章】', body].join('\n')
          recordAi('剧情检查', text)
          return { insert: text.slice(0, 1980), toast: '剧情检查提示已放进输入框' }
        },
        aiChars() {
          const { book, chapter } = ensureChapter()
          if (!book || !chapter) return { toast: '先打开一章' }
          const cast = (book.characters || []).slice(0, 6).map((c) => '- ' + c.name + (c.role ? '（' + c.role + '）' : '') + (c.note ? '：' + c.note : '')).join('\n')
          if (!cast) return { toast: '先在资料库加几个人物' }
          const text = ['根据人物设定，检查这一章每个人的言行是否跑偏，最多 4 条，每条给一句改法。', '', '【人物设定】', cast, '', '【本章】', fullText(chapter).slice(0, 900)].join('\n')
          recordAi('人物分析', text)
          return { insert: text.slice(0, 1980), toast: '人物分析提示已放进输入框' }
        },
        applyAi(scope, event) {
          const idx = index()
          const pasted = fieldText(event && event.value, ['aiResult']) || String(idx.aiResult || '').trim()
          const { book, chapter } = ensureChapter()
          if (!book || !chapter) return { toast: '先打开一章' }
          if (!pasted) return { toast: '先把模型结果粘贴到结果框' }
          if (pasted.length > 1200) return { toast: '结果超过 1200 字，分两次贴' }
          const c = chapter.chunks.length - 1
          chapter.chunks[c] = (chapter.chunks[c] ? chapter.chunks[c] + '\n\n' : '') + pasted
          const saved = saveChapter(book.id, chapter)
          saveState = { at: Date.now(), error: '', pending: false }
          idx.aiResult = ''
          saveIndex(idx)
          return { toast: '已写进本章 · ' + saved.words + ' 字', refresh: true }
        },
        check() {
          const { book, chapter } = ensureChapter()
          if (!book || !chapter) return { toast: '先打开一章' }
          const res = analyzeChapter(book, chapter)
          return { toast: '体检 ' + res.score + ' 分 · ' + res.verdict, refresh: true }
        },
        copyCheck() {
          const c = index().lastCheck
          if (!c) return { toast: '还没有体检结果' }
          const sens = (c.sensitive || []).map((x) => x.word + '×' + x.n).join('、')
          const lines = ['AI 味复检 ' + c.score + '/100 · ' + c.verdict].concat(c.issues || [])
          if (sens) lines.push('敏感词：' + sens)
          const text = lines.join(String.fromCharCode(10))
          return { copy: text.slice(0, 6000), toast: '报告已复制' }
        },
        aiResultInput(scope, event) {
          const v = (event && event.value) || {}
          const text = fieldText(v, ['aiResult', 'data.aiResult'])
          const idx = index()
          idx.aiResult = String(text || '').slice(0, 1400)
          saveIndex(idx)
          return {}
        },
        toolName() { setTool('人名', names('name', 8)); return { toast: '摇了 8 个名字', refresh: true } },
        toolPlace() { setTool('地名', names('place', 8)); return { toast: '摇了 8 个地名', refresh: true } },
        toolSect() { setTool('门派', names('sect', 8)); return { toast: '摇了 8 个门派', refresh: true } },
        toolArt() { setTool('功法', names('art', 8)); return { toast: '摇了 8 门功法', refresh: true } },
        toolWeapon() { setTool('法宝', names('weapon', 8)); return { toast: '摇了 8 件兵器', refresh: true } },
        toolIdea() { setTool('脑洞', ideas(5)); return { toast: '摇了 5 个脑洞', refresh: true } },
        toolBlurb() { const b = currentBook(); setTool('简介', blurbs(b || {})); return { toast: '三个简介骨架', refresh: true } },
        toolDraw() { return { insert: drawPrompt(), toast: '抽卡提示已放进输入框' } },
        useToolItem(scope, event) {
          const v = (event && event.value) || {}
          const items = (index().lastTool || {}).items || []
          const item = items[Number(v.i)]
          if (!item) return { toast: '这一条没了，再摇一次' }
          return { insert: String(item).slice(0, 1900), toast: '已放进输入框' }
        },
        deconstruct(scope, event) {
          const v = (event && event.value) || {}
          const file = fieldText(v, ['deconPath']).trim()
          if (!file) return { toast: '填个 txt 路径' }
          let raw
          try {
            raw = decodeBuffer(fs.readFileSync(file))
          } catch {
            return { toast: '打不开这个文件' }
          }
          const chapters = splitChapters(raw, 3000)
          if (!chapters.length) return { toast: '没切出章节来' }
          const idx = index()
          idx.lastDecon = {
            at: new Date().toISOString(),
            file,
            summary: summarize(chapters),
            chapters: chapters.slice(0, 60).map((c) => ({ title: c.title, chars: c.chars, avg: c.avg, short: c.short, dialogue: c.dialogue })),
          }
          saveIndex(idx)
          return { toast: '拆出 ' + chapters.length + ' 章 · ' + summarize(chapters).chars + ' 字', refresh: true }
        },
        deconToCorpus() {
          const idx = index()
          const d = idx.lastDecon
          if (!d) return { toast: '先拆一本' }
          const book = bookOf(idx.ui && idx.ui.bookId)
          const dir = corpusDirOf(book)
          try {
            ensureDir(dir)
            const raw = decodeBuffer(fs.readFileSync(d.file))
            const name = path.basename(d.file).replace(/\.txt$/i, '') + '.txt'
            fs.writeFileSync(path.join(dir, name), raw, 'utf8')
            corpusCache = { dir: '', at: 0, files: [] }
            return { toast: '已存成母本：' + name.slice(0, 16) }
          } catch {
            return { toast: '存母本失败（目录能不能写？）' }
          }
        },
        openStudio() { return { open: 'panel:studio' } },
        openLibrary() { return { open: 'panel:library' } },
      }),
    })


    ctx.dshGo.panel('library', {
      view: () => libraryView(snapshot()),
      data: (scope, emit) => {
        emit(snapshot())
        return () => {}
      },
      actions: traced('library', {
        addWorld(scope, event) {
          const book = currentBook()
          if (!book) return { toast: '先打开一本书' }
          const v = (event && event.value) || {}
          const title = fieldText(v, ['formWorldTitle']).trim()
          const text = fieldText(v, ['formWorldText']).trim()
          if (!title) return { toast: '给设定起个名字' }
          book.world = (book.world || []).concat([{ title: title.slice(0, 20), text: text.slice(0, 300) }]).slice(0, 30)
          saveBook(book)
          return { toast: '设定已存', refresh: true }
        },
        delWorld(scope, event) {
          const book = currentBook()
          if (!book) return { toast: '先打开一本书' }
          const v = (event && event.value) || {}
          const i = Number(v.i)
          if (!Number.isInteger(i) || !(book.world || [])[i]) return { toast: '没找到这条' }
          book.world.splice(i, 1)
          saveBook(book)
          return { toast: '删掉了', refresh: true }
        },
        addEvent(scope, event) {
          const book = currentBook()
          if (!book) return { toast: '先打开一本书' }
          const v = (event && event.value) || {}
          const text = fieldText(v, ['formEvent']).trim()
          if (!text) return { toast: '事件还是空的' }
          const ch = fieldText(v, ['formEventChapter']).trim()
          book.timeline = (book.timeline || []).concat([{ at: ch.slice(0, 16), text: text.slice(0, 80) }]).slice(0, 60)
          saveBook(book)
          return { toast: '时间线加了一条', refresh: true }
        },
        delEvent(scope, event) {
          const book = currentBook()
          if (!book) return { toast: '先打开一本书' }
          const v = (event && event.value) || {}
          const i = Number(v.i)
          if (!Number.isInteger(i) || !(book.timeline || [])[i]) return { toast: '没找到这条' }
          book.timeline.splice(i, 1)
          saveBook(book)
          return { toast: '删掉了', refresh: true }
        },
        saveOutline(scope, event) {
          const book = currentBook()
          if (!book) return { toast: '先打开一本书' }
          const v = (event && event.value) || {}
          book.outline = fieldText(v, ['outline', 'data.outline', '卷纲']).slice(0, 4000)
          saveBook(book)
          return { toast: '卷纲已存（' + book.outline.length + ' 字）', refresh: true }
        },
        addCharacter(scope, event) {
          const book = currentBook()
          if (!book) return { toast: '先打开一本书' }
          const v = (event && event.value) || {}
          const name = fieldText(v, ['formName']).trim()
          if (!name) return { toast: '先写个名字' }
          book.characters = book.characters || []
          if (book.characters.length >= 40) return { toast: '人物太多，先删几个' }
          book.characters.push({ name: name.slice(0, 12), role: fieldText(v, ['formRole']).slice(0, 12), note: fieldText(v, ['formNote']).slice(0, 60) })
          saveBook(book)
          return { toast: '加上了 ' + name, refresh: true }
        },
        delCharacter(scope, event) {
          const book = currentBook()
          if (!book) return { toast: '先打开一本书' }
          const v = (event && event.value) || {}
          const i = Number(v.i)
          if (!Number.isInteger(i) || !book.characters || !book.characters[i]) return { toast: '没找到这个人物' }
          const [gone] = book.characters.splice(i, 1)
          saveBook(book)
          return { toast: '删掉了 ' + gone.name, refresh: true }
        },
        addForeshadow(scope, event) {
          const book = currentBook()
          if (!book) return { toast: '先打开一本书' }
          const v = (event && event.value) || {}
          const text = fieldText(v, ['formForeshadow']).trim()
          if (!text) return { toast: '伏笔还是空的' }
          book.foreshadows = (book.foreshadows || []).concat([{ text: text.slice(0, 60), paid: false, at: new Date().toISOString() }])
          saveBook(book)
          return { toast: '伏笔记下了', refresh: true }
        },
        payForeshadow(scope, event) {
          const book = currentBook()
          if (!book) return { toast: '先打开一本书' }
          const v = (event && event.value) || {}
          const row = (book.foreshadows || []).find((f) => f.text === v.text)
          if (!row) return { toast: '没找到这条伏笔' }
          row.paid = true
          saveBook(book)
          return { toast: '标为已回收', refresh: true }
        },
        addMaterial(scope, event) {
          const book = currentBook()
          if (!book) return { toast: '先打开一本书' }
          const v = (event && event.value) || {}
          const title = fieldText(v, ['matTitle']).trim()
          if (!title) return { toast: '给资料起个标题' }
          const text = fieldText(v, ['matText']).trim()
          book.materials = (book.materials || []).concat([{ title: title.slice(0, 20), text: text.slice(0, 300) }]).slice(0, 20)
          saveBook(book)
          return { toast: '存进资料', refresh: true }
        },
        delMaterial(scope, event) {
          const book = currentBook()
          if (!book) return { toast: '先打开一本书' }
          const v = (event && event.value) || {}
          const i = Number(v.i)
          if (!Number.isInteger(i) || !(book.materials || [])[i]) return { toast: '没找到这条' }
          book.materials.splice(i, 1)
          saveBook(book)
          return { toast: '删掉了', refresh: true }
        },
        addSkill(scope, event) {
          const v = (event && event.value) || {}
          const title = fieldText(v, ['skillTitle']).trim()
          const card = fieldText(v, ['skillCard']).trim()
          if (!title || !card) return { toast: '名字和规则都要填' }
          const idx = index()
          idx.skills = (idx.skills || []).concat([{ title: title.slice(0, 12), card: card.slice(0, 200) }]).slice(0, 20)
          saveIndex(idx)
          return { toast: '加了一张卡', refresh: true }
        },
        setSkill(scope, event) {
          const v = (event && event.value) || {}
          const idx = index()
          idx.skillId = idx.skillId === v.id ? '' : v.id
          saveIndex(idx)
          return { toast: idx.skillId ? '本章技法已选' : '技法已取消', refresh: true }
        },
        openStudio() { return { open: 'panel:studio' } },
        openAi() { return { open: 'panel:ai' } },
      }),
    })

    ctx.dshGo.panel('settings', {
      view: () => settingsView(settingsSnapshot()),
      data: (scope, emit) => {
        emit(settingsSnapshot())
        return () => {}
      },
      actions: traced('settings', {
        openStudio() {
          return { open: 'panel:studio' }
        },
        openAi() {
          return { open: 'panel:ai' }
        },
        openLibrary() {
          return { open: 'panel:library' }
        },
        saveCorpus(scope, event) {
          const v = (event && event.value) || {}
          const dir = fieldText(v, ['corpusDir']).trim()
          if (!dir) return { toast: '先把路径填上' }
          const idx = index()
          idx.corpusDir = dir
          saveIndex(idx)
          const book = bookOf(idx.ui && idx.ui.bookId)
          if (book && book.corpusDir) {
            book.corpusDir = ''
            saveBook(book)
          }
          corpusCache = { dir: '', at: 0, files: [] }
          const n = corpusFiles(dir).length
          return { toast: n ? '目录记住了：' + n + ' 个文件' : '目录记住了，但里面没有 txt', refresh: true }
        },

        saveGoal(scope, event) {
          const v = (event && event.value) || {}
          const n = parseInt(fieldText(v, ['dailyGoal']), 10)
          if (!n || n < 100 || n > 50000) return { toast: '目标填 100–50000 之间' }
          const idx = index()
          idx.dailyGoal = n
          saveIndex(idx)
          return { toast: '日更目标 ' + n + ' 字', refresh: true }
        },

        saveModelNote(scope, event) {
          const v = (event && event.value) || {}
          const note = fieldText(v, ['modelNote']).trim()
          const idx = index()
          idx.modelNote = note.slice(0, 80)
          saveIndex(idx)
          return { toast: idx.modelNote ? '输出偏好已存' : '已清空', refresh: true }
        },

        saveWebdav(scope, event) {
          const v = (event && event.value) || {}
          const idx = index()
          const url = fieldText(v, ['webdavUrl']).trim()
          const user = fieldText(v, ['webdavUser']).trim()
          const pass = fieldText(v, ['webdavPass'])
          idx.webdav = { url: url.slice(0, 300), user: user.slice(0, 80), pass: pass.slice(0, 120) }
          saveIndex(idx)
          return { toast: idx.webdav.url ? 'WebDAV 记下了（明文存在本机）' : '已清空', refresh: true }
        },

        pushCloud() {
          const cfg = index().webdav || {}
          if (!cfg.url) return { toast: '先填 WebDAV 地址' }
          return {
            pending: { id: 'novel-push', label: '正在备份', timeoutMs: 45000 },
            result: async () => {
              try {
                const r = await cloudPush(cfg)
                return { toast: '已备份 ' + Math.round(r.bytes / 1024) + ' KB' }
              } catch (error) {
                return { toast: '备份失败：' + String((error && error.message) || error).slice(0, 22) }
              }
            },
          }
        },

        pullCloud() {
          const cfg = index().webdav || {}
          if (!cfg.url) return { toast: '先填 WebDAV 地址' }
          return {
            pending: { id: 'novel-pull', label: '正在恢复', timeoutMs: 45000 },
            result: async () => {
              try {
                const r = await cloudPull(cfg)
                return { toast: '恢复了 ' + r.books + ' 本，返回看看' }
              } catch (error) {
                return { toast: '恢复失败：' + String((error && error.message) || error).slice(0, 22) }
              }
            },
          }
        },

        clearDiag() {
          clearDiag()
          return { toast: '诊断日志已清空', refresh: true }
        },

        scan() {
          corpusCache = { dir: '', at: 0, files: [] }
          const idx2 = index()
          const book = bookOf(idx2.ui && idx2.ui.bookId)
          const dir = corpusDirOf(book)
          const files = corpusFiles(dir)
          const chars = files.reduce((n, f) => n + (f.chars || 0), 0)
          return { toast: '扫到 ' + files.length + ' 个文件 · ' + chars + ' 字', refresh: true }
        },

        distill() {
          const idx = index()
          const book = bookOf(idx.ui && idx.ui.bookId)
          const dir = corpusDirOf(book)
          const docs = scanCorpus(dir, 8, 150000)
          if (!docs.length) return { toast: '目录里没有 txt' }
          const prof = distill(docs.map((d) => ({ name: d.name, text: d.text })))
          if (book) writeJson(styleFile(book.id), prof)
          else {
            idx.style = prof
            saveIndex(idx)
          }
          corpusCache = { dir: '', at: 0, files: [] }
          return { toast: '蒸馏完：' + prof.files.length + ' 本', refresh: true }
        },
      }),
    })

    ctx.dshGo.on('save-chapter', (scope) => {
      const { book, chapter } = ensureChapter()
      if (!book || !chapter) return { toast: '先在写作台打开一章' }
      const text = String((scope && scope.message) || '').trim()
      if (!text) return { toast: '这条回复是空的' }
      const before = (book.chapters.find((x) => x.id === chapter.id) || {}).words || 0
      const c = chapter.chunks.length - 1
      const head = chapter.chunks[c] ? chapter.chunks[c] + '\n\n' : ''
      chapter.chunks[c] = head + text
      const saved = saveChapter(book.id, chapter)
      addWords(saved.words - before)
      return { toast: '已存进本章 · ' + saved.words + ' 字' }
    })

    ctx.dshGo.on('check-reply', (scope) => {
      const { book, chapter } = ensureChapter()
      if (!book || !chapter) {
        const res = analyze(String((scope && scope.message) || ''), null)
        return { toast: '这条 ' + res.score + ' 分 · ' + res.verdict }
      }
      const res = analyzeChapter(book, chapter)
      return { toast: '体检 ' + res.score + ' 分 · ' + res.verdict }
    })

    ctx.dshGo.strip('today', (scope, emit, caps) => {
      const tick = () => {
        const n = todayWords()
        emit({ text: (zh(caps) ? '今日 ' : 'Today ') + n + (zh(caps) ? ' 字' : ' chars') })
      }
      tick()
      const timer = setInterval(tick, 60000)
      return () => clearInterval(timer)
    })
  })
}
