/**
 * コースの書き出し・読み込み（JSON）。
 * 配る形（パックなど）はアプリが決める。部品は「コースの JSON」を作る・確かめる・取り込むだけ。
 */
import { settleClears } from './progress'
import type { Changes, CheckItem, Course, Gate, RewardRef, SekishoData, TargetRef } from './types'

/** コースのファイルの形 */
export interface SekishoFile {
  format: 'sekisho-courses'
  version: 1
  courses: Course[]
}

/**
 * コースを書き出す（配る用）。
 * 受け取った人のところでは与えられたコースになるように、origin は 'given' にする
 */
export function exportCourses(courses: Course[]): SekishoFile {
  return {
    format: 'sekisho-courses',
    version: 1,
    courses: courses.map((c) => ({ ...structuredClone(c), origin: 'given' as const })),
  }
}

// ─── 形を確かめる ─────────────────────────────────────

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const text = (v: unknown): string | undefined => {
  const s = str(v)?.trim()
  return s ? s : undefined
}
const id = (v: unknown): string | undefined => {
  const s = str(v)?.trim()
  return s && s.length <= 200 ? s : undefined
}
const MAX_COUNT = 9999

function ref<T extends TargetRef | RewardRef>(v: unknown): T | undefined {
  if (!isObj(v) || !text(v.type)) return undefined
  const out = { ...v, type: text(v.type)! } as T
  if ('id' in out && out.id !== undefined && typeof out.id !== 'string') return undefined
  return out
}

function readItem(v: unknown, seen: Set<string>, errors: string[], where: string): CheckItem | null {
  if (!isObj(v)) return null
  const itemId = id(v.id)
  const title = text(v.title)
  if (!itemId || !title || seen.has(itemId)) {
    errors.push(`${where}: チェック項目を 1 つ飛ばしました（id・名前が無いか、同じ id があります）`)
    return null
  }
  seen.add(itemId)
  const count = Math.floor(Number(v.count))
  const target = ref<TargetRef>(v.target)
  const note = text(v.note)
  const { id: _i, title: _t, note: _n, target: _g, count: _c, ...rest } = v
  return {
    ...rest,
    id: itemId,
    title,
    ...(note ? { note } : {}),
    ...(target ? { target } : {}),
    ...(Number.isFinite(count) && count > 1 ? { count: Math.min(count, MAX_COUNT) } : {}),
  }
}

function readGate(v: unknown, seenGates: Set<string>, seenItems: Set<string>, errors: string[], where: string): Gate | null {
  if (!isObj(v)) return null
  const gateId = id(v.id)
  const title = text(v.title)
  if (!gateId || !title || seenGates.has(gateId)) {
    errors.push(`${where}: 関所を 1 つ飛ばしました（id・名前が無いか、同じ id があります）`)
    return null
  }
  seenGates.add(gateId)
  const items = (Array.isArray(v.items) ? v.items : [])
    .map((i) => readItem(i, seenItems, errors, `${where}「${title}」`))
    .filter((i): i is CheckItem => i !== null)
  const description = text(v.description)
  const reward = ref<RewardRef>(v.reward)
  const stamp = isObj(v.stamp)
    ? { ...(text(v.stamp.text) ? { text: text(v.stamp.text) } : {}), ...(text(v.stamp.color) ? { color: text(v.stamp.color) } : {}) }
    : undefined
  const points = Number(v.points)
  const { id: _i, title: _t, description: _d, items: _it, stamp: _s, reward: _r, points: _p, ...rest } = v
  return {
    ...rest,
    id: gateId,
    title,
    ...(description ? { description } : {}),
    items,
    ...(stamp && Object.keys(stamp).length > 0 ? { stamp } : {}),
    ...(reward ? { reward } : {}),
    ...(Number.isFinite(points) && v.points !== undefined ? { points } : {}),
  }
}

/** 1 つのコースの形を確かめる。使えなければ null（errors にわけを足す） */
export function readCourse(v: unknown, now: Date, errors: string[] = []): Course | null {
  if (!isObj(v)) return null
  const courseId = id(v.id)
  const title = text(v.title)
  if (!courseId || !title) {
    errors.push('コースを 1 つ飛ばしました（id か名前がありません）')
    return null
  }
  const where = `コース「${title}」`
  const seenGates = new Set<string>()
  const seenItems = new Set<string>()
  const gates = (Array.isArray(v.gates) ? v.gates : [])
    .map((g) => readGate(g, seenGates, seenItems, errors, where))
    .filter((g): g is Gate => g !== null)
  const at = now.toISOString()
  const revision = Math.floor(Number(v.revision))
  const description = text(v.description)
  const color = text(v.color)
  const reward = ref<RewardRef>(v.reward)
  const { id: _i, title: _t, description: _d, origin: _o, route: _r, gates: _g, color: _c, reward: _w, revision: _v, createdAt: _ca, updatedAt: _ua, ...rest } = v
  return {
    ...rest,
    id: courseId,
    title,
    ...(description ? { description } : {}),
    origin: v.origin === 'own' ? 'own' : 'given',
    route: v.route === 'ordered' ? 'ordered' : 'free',
    gates,
    ...(color ? { color } : {}),
    ...(reward ? { reward } : {}),
    revision: Number.isFinite(revision) && revision >= 1 ? revision : 1,
    createdAt: str(v.createdAt) ?? at,
    updatedAt: str(v.updatedAt) ?? at,
  }
}

/**
 * コースの JSON を読む。コースのファイル（SekishoFile）・コースの並び・コース 1 つ、のどれでもよい。
 * 形の合わないところは飛ばして、わけを errors に入れる
 */
export function parseCourses(input: unknown, now: Date): { courses: Course[]; errors: string[] } {
  const errors: string[] = []
  let list: unknown[]
  if (isObj(input) && input.format === 'sekisho-courses') {
    if (input.version !== 1) return { courses: [], errors: ['このファイルは新しい版のアプリで作られています。アプリを新しくしてください'] }
    list = Array.isArray(input.courses) ? input.courses : []
  } else if (Array.isArray(input)) {
    list = input
  } else if (isObj(input)) {
    list = [input]
  } else {
    return { courses: [], errors: ['コースの形ではありません'] }
  }
  const seen = new Set<string>()
  const courses: Course[] = []
  for (const v of list) {
    const c = readCourse(v, now, errors)
    if (!c) continue
    if (seen.has(c.id)) {
      errors.push(`コース「${c.title}」が 2 つあったので、あとのほうを飛ばしました`)
      continue
    }
    seen.add(c.id)
    courses.push(c)
  }
  return { courses, errors }
}

// ─── 取り込む ─────────────────────────────────────

export interface ImportResult {
  changes: Changes
  /** 新しく入れたコース */
  added: Course[]
  /** 新しい版にしたコース */
  updated: Course[]
  /** 入れなかったコース（同じか古い版・同じ id の自分のコース） */
  skipped: Course[]
}

/**
 * 配られたコースを取り込む（パックを取り込んだときなど）。
 * - この端末に無いコースは足す
 * - あるコースは、配られたほうが新しい版（revision が大きい。同じなら updatedAt が後）のときだけ置きかえる。
 *   進み具合はチェック項目の id で結びつくので残る。一度クリアした関所はクリアのまま
 * - 同じ id の自分のコースは置きかえない
 * 取り込んだコースは与えられたコース（origin: 'given'）になる
 */
export function importCourses(data: SekishoData, incoming: Course[], now: Date): ImportResult {
  const local = new Map(data.courses.map((c) => [c.id, c]))
  const added: Course[] = []
  const updated: Course[] = []
  const skipped: Course[] = []
  for (const raw of incoming) {
    const c: Course = { ...raw, origin: 'given' }
    const mine = local.get(c.id)
    if (!mine) added.push(c)
    else if (mine.origin === 'own') skipped.push(c)
    else if (c.revision > mine.revision || (c.revision === mine.revision && c.updatedAt > mine.updatedAt)) updated.push(c)
    else skipped.push(c)
  }
  const put = [...added, ...updated]
  if (put.length === 0) return { changes: {}, added, updated, skipped }
  // 項目が減って、もう全部済んでいる関所があれば、ここでクリアにする
  const ids = new Set(put.map((c) => c.id))
  const next: SekishoData = { ...data, courses: [...data.courses.filter((c) => !ids.has(c.id)), ...put] }
  const settled = settleClears(next, now, [...ids])
  return { changes: { courses: put, ...settled }, added, updated, skipped }
}
