// lib/idea.js —— 本地生成：起名 / 脑洞 / 简介骨架 / 三版抽卡（不调模型，纯组合）
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const sample = (arr, n) => {
  const copy = arr.slice()
  const out = []
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0])
  return out
}

const XING = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣邓郁单杭洪包诸左石崔吉钮龚程嵇邢裴陆荣翁荀羊甄封芮储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾甘厉戎祖武符刘景詹束龙叶幸司韶郜黎蓟薄印宿白怀蒲邰从鄂索咸籍赖卓蔺屠蒙池乔阴胥能苍双闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍却璩桑桂濮牛寿通边扈燕冀郏浦尚农温别庄晏柴瞿阎充慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧殳沃利蔚越夔隆师巩厍聂晁勾敖融冷訾辛阚那简饶空曾毋沙乜养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公'
const FU_XING = ['欧阳', '司马', '上官', '慕容', '独孤', '南宫', '西门', '夏侯', '皇甫', '东方', '长孙', '宇文', '公孙', '令狐', '钟离', '闾丘']
const NAME_M = '峰衡野寒屿冽决野临聿砚烬屿砚青肃戈策沉alpha'.replace(/[a-z]/g, '')
const NAME_F = '晚棠梨昭宁宴笙絮窈眠茉妙稚宵笺沁汐梧栖槿妤'

const SUFFIX_PLACE = ['州', '城', '关', '谷', '渡', '岭', '原', '泽', '崖', '陵', '港', '湾', '口', '集', '道']
const PREFIX_PLACE = ['青', '落', '云', '断', '寒', '赤', '黑', '长', '孤', '九', '白', '苍', '雪', '雾', '铁', '石']
const SECT_HEAD = ['玄', '太', '青', '血', '无', '九', '寒', '赤', '流', '天', '落', '孤', '万']
const SECT_KIND = ['门', '宗', '阁', '殿', '堂', '观', '寺', '山庄', '剑冢', '书院', '镖局', '帮']
const ART_HEAD = ['九幽', '太虚', '血煞', '流云', '破军', '焚天', '寒渊', '碎星', '归元', '照夜', '问心', '斩春']
const ART_KIND = ['诀', '经', '剑典', '掌', '指', '心法', '真解', '秘录', '刀谱', '枪式']
const MAT = ['寒铁', '陨金', '白骨', '老玉', '槐木', '青铜', '玄冰', '赤铜', '阴沉木', '雷击木']
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

const ROLE = ['替人顶罪刚出狱的', '被退了三次婚的', '在殡仪馆上夜班的', '替老板背了黑锅的', '被人顶替了身份的', '只会修老式收音机的', '从火场里爬出来的', '在县医院当护工的']
const PLACE = ['一场雨夜的葬礼上', '城中村的自建房顶', '殡仪馆三号炉前', '凌晨四点的水产市场', '停业三年的旧影院', '一条没有名字的巷子', '邻市的大巴最后一排', '被查封的厂房里']
const ODD = ['捡到一张和自己同名的身份证', '收到一封自己写的信', '发现家里多了一个人的碗筷', '被人叫住却叫的是另一个名字', '在监控里看见了三年前的自己', '听到有人用死人的声音打电话']
const GOAL = ['要查清妹妹到底嫁给了谁', '要把欠条一张张赎回来', '要找到那晚唯一活着的证人', '要不声不响地拿回名字', '要替死人把话说完']
const COST = ['一旦露馅，全城都会知道他是谁', '每查一步，就多一个人消失', '天亮之前不解决，他就得再进去一次']

export function makeIdea() {
  const t = pick([
    '【' + pick(ROLE) + '】在' + pick(PLACE) + '，' + pick(ODD) + '。他' + pick(GOAL) + '，但' + pick(COST) + '。',
    '【' + pick(ROLE) + '】本来只想活到月底。' + pick(PLACE) + '，他' + pick(ODD) + '——' + pick(COST) + '。',
    '所有人都以为' + pick(['死掉的是他', '走丢的是妹妹', '签字的是他自己']) + '。可他' + pick(ODD) + '，而' + pick(GOAL) + '。',
  ])
  return t
}

export function ideas(n) {
  const out = new Set()
  let guard = 0
  while (out.size < (n || 5) && guard < 60) {
    out.add(makeIdea())
    guard += 1
  }
  return [...out]
}

export function blurbs(book) {
  const title = (book && book.title) || '这本书'
  const hero = (book && book.characters && book.characters[0] && book.characters[0].name) || '他'
  const genre = (book && book.genre) || '都市'
  const premise = (book && book.premise) || '一个不该被记住的人'
  const v = [
    title + '：' + premise + '。' + hero + '以为最难的是活着，直到他发现，有人正替他活得很好。',
    '别人求的是翻身，' + hero + '求的是把名字拿回来。' + genre + '长篇，慢热，但每章都有人掉队。',
    hero + '在' + pick(PLACE) + '捡到一件不属于自己的东西。从那天起，' + pick(GOAL).replace('要', '他得') + '——而' + pick(COST) + '。',
  ]
  return v
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
