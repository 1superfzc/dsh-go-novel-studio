// test/self-test.mjs —— v0.7 四面板全链路
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createTestHost } from '/root/.dsh/skills/dsh-go-plugin/kit/lib/testing.js'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-test-'))
process.env.DSH_HOME = tmp
process.env.NOVEL_EXPORT_DIR = path.join(tmp, 'out')

const plugin = await import('../lib/index.js')
const here = path.dirname(new URL(import.meta.url).pathname)
const root = path.resolve(here, '..')
const host = createTestHost({ dir: root })
plugin.apply(host.ctx)

let pass = 0
let fail = 0
const ok = (name, cond, extra) => {
  if (cond) { pass += 1; console.log('  ✓ ' + name) }
  else { fail += 1; console.log('  ✗ ' + name + (extra ? ' :: ' + extra : '')) }
}
const call = async (panel, action, value) => host.invoke(panel, { surface: 'panel', action, value })
const view = (panel) => host.view(panel, { sessionId: 's1' })
const findAll = (node, type) => {
  const out = []
  const walk = (n) => {
    if (!n || typeof n !== 'object') return
    if (n.type === type) out.push(n)
    for (const c of n.children || []) walk(c)
    for (const it of n.items || []) for (const c of (it && it.children) || []) walk(c)
  }
  walk(node)
  return out
}
const json = (v) => JSON.stringify(v)
const novel = () => JSON.parse(fs.readFileSync(path.join(tmp, 'dsh-go/novel/novel.json'), 'utf8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

console.log('1 四面板渲染')
for (const id of ['studio', 'ai', 'library', 'settings']) {
  const v = await view(id)
  ok(id + ' 能画', v.view && v.view.v === 2, json(v.issues || []).slice(0, 120))
}

console.log('2 建书 / 建章 / 保存')
await call('studio', 'newBook', { formTitle: '旧楼', formGenre: '都市悬疑' })
ok('书入库', novel().books.length === 1, '')
await call('studio', 'newChapter', { formChapter: '第 1 章 借来的名字' })
const body = '他把烟按在窗台上，火星子掉下去。楼下有人骂街，他探头看了一眼，缩回来，把窗户关上了。'.repeat(14).slice(0, 600)
await call('studio', 'saveChunk', { body })
const bookId = novel().books[0].id
const chFile = path.join(tmp, 'dsh-go/novel', bookId, 'c0001.json')
const ch = JSON.parse(fs.readFileSync(chFile, 'utf8'))
ok('正文落盘', ch.chunks[0].length > 500, String(ch.chunks[0].length))
ok('字数统计', ch.words > 500, String(ch.words))

console.log('3 自动保存（防抖 1.2s）')
await call('studio', 'draft', { body: '新写的一句。门童看他的鞋，看了两秒。' })
await sleep(1600)
const ch2 = JSON.parse(fs.readFileSync(chFile, 'utf8'))
ok('自动写盘', ch2.chunks[0].includes('门童看他的鞋'), ch2.chunks[0].slice(0, 20))
const vw = await view('studio')
ok('保存态可见', json(vw.view).includes('已保存'), '')

console.log('4 写作包')
let e = await call('studio', 'pack')
let ins = (e.effects || []).find((x) => x.type === 'insert')
ok('insert 有内容', !!ins && ins.text.length > 80, String(ins && ins.text.length))
ok('insert ≤2000', !!ins && ins.text.length <= 2000, String(ins && ins.text.length))
ok('含硬约束', !!ins && ins.text.includes('段尾不许升华'), '')

await call('library', 'addCharacter', { formName: '林晚', formRole: '女主', formNote: '左手小指有旧伤' })
console.log('5 AI 五种生成')
for (const [act, kw] of [['aiContinue', '续写'], ['aiPolish', '润色'], ['aiRewrite', '重写'], ['aiPlot', '剧情'], ['aiChars', '人物']]) {
  const r = await call('ai', act)
  const i2 = (r.effects || []).find((x) => x.type === 'insert')
  ok(act, !!i2 && i2.text.length > 40 && i2.text.length <= 2000, json(r.effects || []).slice(0, 100))
}

console.log('6 体检')
e = await call('ai', 'check')
const lc = novel().lastCheck
ok('有评分', lc && typeof lc.score === 'number', json(lc || {}).slice(0, 80))
const va = await view('ai')
ok('体检环可见', json(va.view).includes('"shape":"ring"'), '')

console.log('7 AI 结果回写')
await call('ai', 'aiResultInput', { aiResult: '门童笑了一下，笑得比刚才诚恳两分。' })
await call('ai', 'applyAi')
const ch3 = JSON.parse(fs.readFileSync(chFile, 'utf8'))
ok('写进本章', json(ch3.chunks).includes('门童笑了一下'), '')

console.log('8 资料库增删')
const L = 'library'
await call(L, 'addCharacter', { formName: '林晚', formRole: '女主', formNote: '左手小指有旧伤' })
await call(L, 'addWorld', { formWorldTitle: '拆迁规则', formWorldText: '2011 年拆的，每平 3400' })
await call(L, 'saveOutline', { outline: '第一卷：他替人顶了三年牢。' })
await call(L, 'addForeshadow', { formForeshadow: '门童认识他的鞋' })
await call(L, 'addEvent', { formEvent: '他把欠条烧了', formEventChapter: '3' })
await call(L, 'addMaterial', { matTitle: '拆迁时间', matText: '2011' })
await call(L, 'addSkill', { skillTitle: '三句一断', skillCard: '每三句一个短句。' })
let book = JSON.parse(fs.readFileSync(path.join(tmp, 'dsh-go/novel', bookId, 'book.json'), 'utf8'))
ok('人物', (book.characters || []).some((c) => c.name === '林晚'), json(book.characters || []))
ok('世界观', (book.world || []).length === 1, '')
ok('大纲', (book.outline || '').length > 5, '')
ok('伏笔', (book.foreshadows || []).length === 1, '')
ok('时间线', (book.timeline || []).length === 1, '')
ok('素材', (book.materials || []).length === 1, '')
ok('技法卡', (novel().skills || []).length === 1, '')
await call(L, 'delWorld', { i: 0 })
book = JSON.parse(fs.readFileSync(path.join(tmp, 'dsh-go/novel', bookId, 'book.json'), 'utf8'))
ok('删世界观', (book.world || []).length === 0, '')

console.log('9 拆解 + 存母本')
const src = path.join(tmp, 'src.txt')
fs.writeFileSync(src, '第一章 甲\n' + '他把烟按在窗台上。\n'.repeat(30) + '第二章 乙\n' + '门童看他的鞋。\n'.repeat(30), 'utf8')
e = await call('ai', 'deconstruct', { deconPath: src })
ok('拆出两章', json(e.effects).includes('拆出 2 章'), json(e.effects).slice(0, 100))
e = await call('ai', 'deconToCorpus')
ok('存为母本', json(e.effects).includes('已存成母本'), json(e.effects).slice(0, 100))

console.log('10 蒸馏 + 设置')
await call('settings', 'saveCorpus', { corpusDir: path.join(tmp, 'corpus') })
fs.mkdirSync(path.join(tmp, 'corpus'), { recursive: true })
fs.writeFileSync(path.join(tmp, 'corpus', 'a.txt'), '他把烟按在窗台上，火星子掉下去。\n'.repeat(20), 'utf8')
e = await call('settings', 'distill')
ok('蒸馏成功', json(e.effects).includes('蒸馏完'), json(e.effects).slice(0, 100))
ok('指纹落盘', fs.existsSync(path.join(tmp, 'dsh-go/novel', bookId, 'style.json')), '')

console.log('11 云同步')
const http = await import('node:http')
let stored = null
const srv = http.createServer((req, res) => {
  if (req.method === 'PUT') { let b = ''; req.on('data', (d) => { b += d }); req.on('end', () => { stored = b; res.statusCode = 201; res.end('ok') }); return }
  if (!stored) { res.statusCode = 404; res.end('no'); return }
  res.statusCode = 200
  res.end(stored)
})
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const port = srv.address().port
await call('settings', 'saveWebdav', { webdavUrl: 'http://127.0.0.1:' + port + '/n.json', webdavUser: 'u', webdavPass: 'p' })
let pr = await host.invoke('settings', { surface: 'panel', action: 'pushCloud' })
let done = await pr.settled
ok('备份成功', json(done.effects).includes('已备份'), json(done.effects).slice(0, 100))
pr = await host.invoke('settings', { surface: 'panel', action: 'pullCloud' })
done = await pr.settled
ok('恢复成功', json(done.effects).includes('恢复了'), json(done.effects).slice(0, 100))
await new Promise((r) => srv.close(r))

console.log('12 导出')
await call('studio', 'export')
ok('导出文件', fs.readdirSync(path.join(tmp, 'out')).length >= 1, '')

console.log('13 删除书')
await call('studio', 'newBook', { formTitle: '待删的书' })
const victim = novel().books.find((b) => b.title === '待删的书')
await call('studio', 'shelfManage')
await call('studio', 'askDelete', { id: victim.id })
ok('出现确认', findAll((await view('studio')).view, 'confirm').length >= 1, '')
await call('studio', 'confirmDelete', { confirmed: true })
ok('删掉一本', !fs.existsSync(path.join(tmp, 'dsh-go/novel', victim.id)), '')

console.log('14 全按钮冒烟')
const seen = new Map()
for (const [panel, actions] of [
  ['studio', ['home', 'works', 'write', 'stats']],
]) {
  for (const t of actions) {
    await call(panel, 'switchTab', { to: t })
    const v = await view(panel)
    const walk = (n) => {
      if (!n || typeof n !== 'object') return
      const collect = (a) => {
        const id = typeof a === 'string' ? a : a && a.id
        if (id) seen.set(panel + ':' + id, typeof a === 'string' ? undefined : a.args)
      }
      if (n.type === 'actions') for (const it of n.items || []) collect(it.action)
      if (n.type === 'form') collect(n.submit)
      for (const it of n.items || []) collect(it.action)
      for (const c of n.children || []) walk(c)
      for (const it of n.items || []) for (const c of (it && it.children) || []) walk(c)
    }
    walk(v.view)
  }
}
for (const panel of ['ai', 'library', 'settings']) {
  const v = await view(panel)
  const walk = (n) => {
    if (!n || typeof n !== 'object') return
    const collect = (a) => {
      const id = typeof a === 'string' ? a : a && a.id
      if (id) seen.set(panel + ':' + id, typeof a === 'string' ? undefined : a.args)
    }
    if (n.type === 'actions') for (const it of n.items || []) collect(it.action)
    if (n.type === 'form') collect(n.submit)
    for (const c of n.children || []) walk(c)
    for (const it of n.items || []) for (const c of (it && it.children) || []) walk(c)
  }
  walk(v.view)
}
const broken = []
for (const [key, args] of seen) {
  const [panel, id] = key.split(':')
  if (id === 'confirmDelete') continue
  try {
    await host.invoke(panel, { surface: 'panel', action: id, value: args })
  } catch (error) {
    broken.push(key)
  }
}
ok('所有按钮有 handler', broken.length === 0, broken.join(','))
ok('按钮覆盖 >= 30', seen.size >= 30, String(seen.size))

console.log('15 状态条')
const feed = host.subscribe('today', {})
await sleep(40)
ok('今日字数', /今日|Today/.test(String(feed.data && feed.data.text)), json(feed.data))
try { feed.stop() } catch {}

console.log('\n' + pass + ' 通过 / ' + fail + ' 失败')
fs.rmSync(tmp, { recursive: true, force: true })
process.exit(fail ? 1 : 0)
