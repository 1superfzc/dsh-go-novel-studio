// lib/idea.js —— 本地生成：起名 / 脑洞 / 简介骨架 / 三版抽卡（不调模型）

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const sample = (arr, n) => {
  const copy = arr.slice()
  const out = []
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0])
  return out
}

const XING = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣邓郁单杭洪包诸左石崔吉钮龚程嵇邢裴陆荣翁荀羊甄封芮储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾甘厉戎祖武符刘景詹束龙叶幸司韶郜黎蓟薄印宿白怀蒲邰从鄂索咸籍赖卓蔺屠蒙池乔阴胥能苍双闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍却璩桑桂濮牛寿通边扈燕冀郏浦尚农温别庄晏柴瞿阎充慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧殳沃利蔚越夔隆师巩厍聂晁勾敖融冷訾辛阚那简饶空曾毋沙乜养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公'
const FU_XING = ['欧阳', '司马', '上官', '慕容', '独孤', '南宫', '西门', '夏侯', '皇甫', '东方', '长孙', '宇文', '公孙', '令狐', '钟离', '闾丘']
const NAME_M = '峰衡野寒屿冽决临聿砚烬青肃戈策沉舟牧野'
const NAME_F = '晚棠梨昭宁宴笙絮窈眠茉妙稚宵笺沁汐梧栖槿妤'

const SUFFIX_PLACE = ['州', '城', '关', '谷', '渡', '岭', '原', '泽', '崖', '陵', '港', '湾', '口', '集', '道', '屯', '堡', '津']
const PREFIX_PLACE = ['青', '落', '云', '断', '寒', '赤', '黑', '长', '孤', '九', '白', '苍', '雪', '雾', '铁', '石', '灰', '旧']
const SECT_HEAD = ['玄', '太', '青', '血', '无', '九', '寒', '赤', '流', '天', '落', '孤', '万', '归', '照']
const SECT_KIND = ['门', '宗', '阁', '殿', '堂', '观', '寺', '山庄', '剑冢', '书院', '镖局', '帮', '盟', '会']
const ART_HEAD = ['九幽', '太虚', '血煞', '流云', '破军', '焚天', '寒渊', '碎星', '归元', '照夜', '问心', '斩春', '沉舟', '无相']
const ART_KIND = ['诀', '经', '剑典', '掌', '指', '心法', '真解', '秘录', '刀谱', '枪式', '图录']
const MAT = ['寒铁', '陨金', '白骨', '老玉', '槐木', '青铜', '玄冰', '赤铜', '阴沉木', '雷击木', '海沉沙']
const WEAPON = ['刀', '剑', '枪', '鞭', '印', '珠', '幡', '镜', '爪', '伞', '琴', '铃']

export function makeName(kind) {
  const k = kind || 'name'
  if (k === 'place') return pick(PREFIX_PLACE) + pick(SUFFIX_PLACE)
  if (k === 'sect') return pick(SECT_HEAD) + pick(SECT_KIND)
  if (k === 'art') return pick(ART_HEAD) + pick(ART_KIND)
  if (k === 'weapon') return Math.random() < 0.5 ? pick(MAT) + pick(WEAPON) : pick(PREFIX_PLACE) + pick(WEAPON)
  const xing = Math.random() < 0.15 ? pick(FU_XING) : XING[Math.floor(Math.random() * XING.length)]
  const pool = Math.random() < 0.5 ? NAME_M : NAME_F
  const len = Math.random() < 0.55 ? 1 : 2
  let ming = ''
  for (let i = 0; i < len; i++) ming += pool[Math.floor(Math.random() * pool.length)]
  return xing + ming
}

export function names(kind, n) {
  const out = new Set()
  let guard = 0
  while (out.size < (n || 8) && guard < 400) {
    out.add(makeName(kind))
    guard += 1
  }
  return [...out]
}

/* ── 脑洞：6 组角色 × 8 组场景 × 8 组异常 × 6 组目标 × 4 组代价 + 5 套句式 ── */

const ROLE = ['替人顶罪刚出狱的人', '被退了三次婚的姑娘', '在殡仪馆上夜班的守夜人', '替老板背了黑锅的会计',
  '被人顶替了身份的复读生', '只会修老式收音机的师傅', '从火场里爬出来的消防员', '在县医院值夜班的护工',
  '被全家瞒了二十年的养女', '欠了十八条街钱的修车工', '总在凌晨三点醒来的出租车司机', '被村里当成疯子的赤脚医生',
  '高考前一夜失踪又回来的考生', '在赌场当荷官的年轻人', '给孩子当后爸的中年男人', '被通缉了三年的无罪者']

const SCENE = ['一场雨夜的葬礼上', '城中村的自建房顶', '殡仪馆三号炉前', '凌晨四点的水产市场',
  '停业三年的旧影院', '一条没有名字的巷子', '邻市大巴的最后一排', '被查封的厂房里',
  '老式电梯卡住的四十七秒里', '小学门口的人行天桥上', '烧了一半的出租屋', '县城的殡葬用品一条街',
  '高速服务区的便利店', '塌了半边的戏台下', '冬天的露天泳池边']

const ODD = ['捡到一张和自己同名的身份证', '收到一封自己笔迹的信', '发现家里多了一副碗筷',
  '被人叫住却叫的是另一个名字', '在监控里看见三年前的自己', '听到有人用死人的声音打电话',
  '翻出一张从没拍过的全家福', '手机里多了一个不认识的联系人', '钱包里多出三百块没人认的现金',
  '手机相册自动多出一段夜里的录像', '在墙上摸到一排别人刻的日期', '发现自己的档案被人改过一页',
  '被陌生人递来一把钥匙说“你家门换了”', '听见楼下有人一遍遍喊自己小名']

const GOAL = ['要查清妹妹到底嫁给了谁', '要把欠条一张张赎回来', '要找到那晚唯一活着的证人',
  '要不声不响地拿回名字', '要替死人把话说完', '要在三天内把人找回来', '要守住那间没人租的铺子',
  '要让一个死人重新活在社会关系里']

const COST = ['一旦露馅，全城都会知道他是谁', '每查一步，就多一个人消失', '天亮之前不解决，他就得再进去一次',
  '只要开口，就得承认自己当年做了什么', '动一次钱，就会牵出背后的那条线']

const TPL = [
  (r, s, o, g, c) => '【' + r + '】' + s + '，' + o + '。他要' + g + '，但' + c + '。',
  (r, s, o, g, c) => '【' + r + '】本来只想活到月底。' + s + '，他' + o + '——' + c + '。',
  (r, s, o, g, c) => '所有人都以为死掉的是他。可' + s + '，他' + o + '，而他要' + g + '。',
  (r, s, o, g, c) => s + '，' + r + o + '。' + '他必须' + g + '；' + c + '。',
  (r, s, o, g, c) => '这本该是个普通的夜班。' + r + '在' + s.replace(/^(一场|一条|一间|一个)/, '') + o + '，' + c + '。',
  (r, s, o, g, c) => '【' + r + '】手里只有一样东西：' + o.replace(/^(捡到|收到|发现|翻出|听见|在)/, '') + '。他要在' + s.replace(/^一/, '') + g + '。',
]

export function makeIdea() {
  return pick(TPL)(pick(ROLE), pick(SCENE), pick(ODD), pick(GOAL), pick(COST))
}

/** 生成 n 条，避开 avoid 里出现过的（最近 200 条） */
export function ideas(n, avoid) {
  const seen = new Set(avoid || [])
  const out = []
  let guard = 0
  while (out.length < (n || 5) && guard < 600) {
    const t = makeIdea()
    guard += 1
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/** 外部脑洞源：把任意文本/JSON 解析成候选句子 */
export function parseIdeaSource(text) {
  const raw = String(text || '').trim()
  if (!raw) return []
  try {
    const data = JSON.parse(raw)
    const list = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : Array.isArray(data.ideas) ? data.ideas : []
    return list.map((x) => (typeof x === 'string' ? x : x && (x.title || x.text || x.idea || ''))).filter(Boolean).slice(0, 60)
  } catch {}
  return raw.split(/\n+/).map((s) => s.replace(/^[-*\d.、\s]+/, '').trim()).filter((s) => s.length >= 8).slice(0, 60)
}

export function blurbs(book) {
  const title = (book && book.title) || '这本书'
  const hero = (book && book.characters && book.characters[0] && book.characters[0].name) || '他'
  const genre = (book && book.genre) || '都市'
  const premise = (book && book.premise) || '一个不该被记住的人'
  return [
    title + '：' + premise + '。' + hero + '以为最难的是活着，直到他发现，有人正替他活得很好。',
    '别人求的是翻身，' + hero + '求的是把名字拿回来。' + genre + '长篇，慢热，但每章都有人掉队。',
    hero + '在' + pick(SCENE) + '捡到一件不属于自己的东西。从那天起，' + pick(GOAL).replace('要', '他得') + '——而' + pick(COST) + '。',
  ]
}

export function drawPrompt() {
  return [
    '同一个场景写三个版本，各 400 字，输出为 A / B / C，不要评论：',
    'A 用动作开场（第一句必须是手上的动作）；',
    'B 用对话开场（第一句是一句不完整的话）；',
    'C 用细节开场（第一句只有气味或声音，不出现人名）。',
    '三版必须同一个场景、同一个结局，节奏不同。',
  ].join('\n')
}

/* ── 按分类生成（题材行情加权用） ── */

const CAT = {
  男频衍生: {
    role: ['在殡葬一条街跑业务的', '给直播公司做场控的', '在县医院当护工的', '帮人代写简历的', '跑夜班出租的', '给剧组打灯的'],
    scene: ['殡仪馆三号炉前', '直播间外的走廊', '凌晨的水产市场', '剧组收工后的片场', '县城殡葬用品一条街'],
    odd: ['接到一单要求“看着别说话”的活', '客户的资料里夹着一张自己的照片', '被人递来一份自己签过字的合同'],
    goal: ['要把这单做完拿到钱', '要弄清是谁在背后下单'],
  },
  科幻末世: {
    role: ['在避难所排值班表的人', '守发电机的维修工', '管物资登记的老会计', '第一个发现水变味的人'],
    scene: ['地下二层的配电间', '第七天之后的城郊公路', '按名字分配的食堂窗口', '被铁链锁住的广播站'],
    odd: ['广播开始按名单点名，念到的人第二天消失', '发现自己的名字被念错了一个字', '值班表上自己那一栏被人划掉了'],
    goal: ['要撑过这一轮点名', '要查出名单是谁排的'],
  },
  东方仙侠: {
    role: ['在宗门管账房的', '被逐出师门带走一把钥匙的', '给长老炼废丹的杂役', '守后山三十年的守山人'],
    scene: ['祖师堂的账房', '后山封着的山门', '炼废了的丹房', '宗门封山那天的山道'],
    odd: ['发现宗门三十年没清过一笔账', '被逐出那天只带走一把钥匙', '在账本上看到自己的名字被划掉'],
    goal: ['要把欠的灵石一笔笔收回来', '要弄清是谁在账上做了手脚'],
  },
  历史脑洞: {
    role: ['在县志办整理旧档的', '替死人顶名服役的', '漕运司里管押船的', '在县衙抄卷宗的'],
    scene: ['县志办的旧档案室', '万历年间的里甲册', '漕运码头的货栈', '县衙后堂的灯下'],
    odd: ['县志上多出一个没有生平的“某人”', '一份册子上有两处笔迹不一样', '发现自己顶的那个名字还活着'],
    goal: ['要把这一页对不上号的地方查清', '要在被上面收走之前抄完'],
  },
  都市脑洞: {
    role: ['在夜市摆摊的', '只接深夜单的跑腿员', '开旧书店的', '给人修老式收音机的'],
    scene: ['夜市第三排的摊子前', '凌晨两点的写字楼', '只亮一盏灯的书店', '老小区六楼的走廊'],
    odd: ['摊子上有人拿“我杀过人”来换一顿饭', '第七单的收件地址是自己家', '收到一本写着别人批注的旧书'],
    goal: ['要把这一单送到', '要弄清这些人为什么都找他'],
  },
  玄幻脑洞: {
    role: ['给宗门送柴的杂役', '被当成废物的旁支子弟', '守矿脉的老矿工', '替人养灵兽的'],
    scene: ['矿脉最深的那一层', '宗门外的柴道', '废了的演武场', '灵兽棚的夜里'],
    odd: ['发现自己能听见灵兽说话', '矿脉里有块石头一直在响', '捡到一枚刻着自己名字的旧牌'],
    goal: ['要把这块石头弄明白', '要在下一次大比前站起来'],
  },
  悬疑脑洞: {
    role: ['做监控安装的', '在殡仪馆上夜班的', '做社区网格员的', '给老楼送水的'],
    scene: ['监控室的三块屏前', '老楼负一层的配电房', '凌晨的楼道', '停业三年的旧影院'],
    odd: ['同一段监控里多出一个人', '三户人家的电表在同一个夜里归零', '楼道声控灯只在没人时亮'],
    goal: ['要把这段录像看完', '要弄清那晚楼里到底有几个人'],
  },
  都市高武: {
    role: ['在武馆教小孩的', '给高手当陪练的', '开器械店的', '做赛事解说的'],
    scene: ['地下拳场的后台', '武馆的旧垫子上', '赛事检录处', '高手云集的电梯里'],
    odd: ['陪练时被一拳打断了三根肋骨却没人管', '发现自己的段位被人冒用', '赛前有人递来一瓶水'],
    goal: ['要打上那个台子', '要查清是谁在给对手放水'],
  },
  西方奇幻: {
    role: ['替教廷抄卷宗的', '给雇佣兵团记账的', '守边境哨塔的', '在港口做契约公证的'],
    scene: ['教廷的地下藏书室', '边境哨塔的第三层', '港口公证处的柜台', '雨季的雇佣兵营地'],
    odd: ['卷宗里有一页被人从中间裁走', '契约上出现了自己的笔迹', '哨塔的火三天没灭过'],
    goal: ['要把那一页找回来', '要弄清契约是谁替他签的'],
  },
}

export function ideasForCategories(cats, n, avoid) {
  const seen = new Set(avoid || [])
  const out = []
  const weight = (i) => (i === 0 ? 0.45 : i === 1 ? 0.3 : i === 2 ? 0.15 : 0.1)
  let guard = 0
  while (out.length < (n || 5) && guard < 400) {
    guard += 1
    let pickIdx = 0
    const r = Math.random()
    let acc = 0
    for (let i = 0; i < cats.length; i++) {
      acc += weight(i)
      if (r <= acc) {
        pickIdx = i
        break
      }
    }
    const cat = cats[pickIdx]
    const pack = CAT[cat] || {}
    const r0 = pick(pack.role || ROLE)
    const s0 = pick(pack.scene || SCENE)
    const o0 = pick(pack.odd || ODD)
    const g0 = pick(pack.goal || GOAL)
    const c0 = pick(COST)
    const goal = String(g0).replace(/^要/, '')
    const tpl = pick([
      (r, s, o, g, c) => r + '，在' + s + '，' + o + '。他要' + g + '，但' + c + '。',
      (r, s, o, g, c) => s + '，' + r + o + '。他必须' + g + '；' + c + '。',
      (r, s, o, g, c) => '谁都以为这晚会平安过去。直到' + s + '，' + r + o + '——' + c + '。',
      (r, s, o, g, c) => r + '只做一件事：' + o + '。他要' + g + '，可' + c + '。',
    ])
    const line = '【' + cat + '】' + tpl(r0, s0, o0, goal, c0)
    if (seen.has(line)) continue
    seen.add(line)
    out.push(line)
  }
  return out
}

