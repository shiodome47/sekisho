/**
 * 進み具合の計算（画面なし）。
 * 関数はデータを書き換えず、変更（Changes）を返す。保存はアプリがして、applyChanges で手元にも当てる。
 */
import type { Activity, Changes, CheckItem, Clear, ClearEvent, Course, Gate, ItemProgress, SekishoData, TargetRef } from './types'

/** 進み具合の id */
export const progressId = (courseId: string, itemId: string) => `${courseId}|${itemId}`

/** クリアの記録の id。gateId が無ければコースを全部クリアした記録 */
export const clearId = (courseId: string, gateId?: string) => `${courseId}|${gateId ?? '*'}`

/** 項目の回数（無ければ 1。1 より小さい・数でないものも 1） */
export function itemGoal(item: Pick<CheckItem, 'count'>): number {
  const n = Math.floor(Number(item.count ?? 1))
  return Number.isFinite(n) && n >= 1 ? n : 1
}

// ─── 見るための形 ─────────────────────────────────────

export interface ItemView {
  item: CheckItem
  /** 今の回数 */
  done: number
  /** 回数（無ければ 1） */
  goal: number
  complete: boolean
}

export interface GateView {
  gate: Gate
  index: number
  items: ItemView[]
  /** 済んだ項目の数 */
  done: number
  /** 項目の数 */
  total: number
  /** 今、項目が全部済んでいるか */
  complete: boolean
  /** クリアの記録があるか（一度クリアしたら、項目を外しても true のまま） */
  cleared: boolean
  clearedAt?: string
  /** 開いているか（順番のコースでは、前の関所をクリアすると開く） */
  open: boolean
}

export interface CourseView {
  course: Course
  gates: GateView[]
  /** クリアした関所の数 */
  cleared: number
  /** 関所の数 */
  total: number
  /** コースを全部クリアした記録があるか */
  complete: boolean
  clearedAt?: string
}

type ProgressMap = Map<string, ItemProgress>
type ClearMap = Map<string, Clear>

const progressMap = (data: Pick<SekishoData, 'progress'>): ProgressMap => new Map(data.progress.map((p) => [p.id, p]))
const clearMap = (data: Pick<SekishoData, 'clears'>): ClearMap => new Map(data.clears.map((c) => [c.id, c]))

function doneOf(progress: ProgressMap, courseId: string, item: CheckItem): number {
  const n = progress.get(progressId(courseId, item.id))?.done ?? 0
  return Math.max(0, Math.min(itemGoal(item), n))
}

function openAt(course: Course, clears: ClearMap, index: number): boolean {
  if ((course.route ?? 'free') === 'free' || index <= 0) return true
  const gate = course.gates[index]
  const prev = course.gates[index - 1]
  // 前の関所をクリアしていれば開く。もうクリアした関所は、前に関所が足されても開いたまま
  return clears.has(clearId(course.id, prev.id)) || (!!gate && clears.has(clearId(course.id, gate.id)))
}

/** 関所が開いているか */
export function isGateOpen(data: Pick<SekishoData, 'clears'>, course: Course, gateId: string): boolean {
  const index = course.gates.findIndex((g) => g.id === gateId)
  return index >= 0 && openAt(course, clearMap(data), index)
}

function viewWith(progress: ProgressMap, clears: ClearMap, course: Course): CourseView {
  const gates = course.gates.map((gate, index): GateView => {
    const items = gate.items.map((item): ItemView => {
      const goal = itemGoal(item)
      const done = doneOf(progress, course.id, item)
      return { item, done, goal, complete: done >= goal }
    })
    const done = items.filter((i) => i.complete).length
    const clear = clears.get(clearId(course.id, gate.id))
    return {
      gate,
      index,
      items,
      done,
      total: items.length,
      complete: items.length > 0 && done === items.length,
      cleared: !!clear,
      ...(clear ? { clearedAt: clear.clearedAt } : {}),
      open: openAt(course, clears, index),
    }
  })
  const courseClear = clears.get(clearId(course.id))
  return {
    course,
    gates,
    cleared: gates.filter((g) => g.cleared).length,
    total: gates.length,
    complete: !!courseClear,
    ...(courseClear ? { clearedAt: courseClear.clearedAt } : {}),
  }
}

/** コースの進み具合（関所ごと・項目ごと）。画面はこれを描く */
export function viewCourse(data: SekishoData, course: Course): CourseView {
  return viewWith(progressMap(data), clearMap(data), course)
}

// ─── 進める・戻す ─────────────────────────────────────

interface Step {
  courseId: string
  itemId: string
  next: (done: number, goal: number) => number
}

function findItem(course: Course, itemId: string): { gateIndex: number; item: CheckItem } | null {
  for (let gateIndex = 0; gateIndex < course.gates.length; gateIndex++) {
    const item = course.gates[gateIndex].items.find((i) => i.id === itemId)
    if (item) return { gateIndex, item }
  }
  return null
}

/**
 * クリアの記録が無いのに項目が全部済んでいる関所を探して、記録と知らせを作る。
 * 関所を全部クリアしたコースには、コースの記録も作る
 */
function detectClears(courses: Course[], progress: ProgressMap, clears: ClearMap, at: string): { clears: Clear[]; events: ClearEvent[] } {
  const added: Clear[] = []
  const events: ClearEvent[] = []
  for (const course of courses) {
    const view = viewWith(progress, clears, course)
    let cleared = view.cleared
    for (const g of view.gates) {
      if (g.cleared || !g.complete) continue
      const c: Clear = { id: clearId(course.id, g.gate.id), courseId: course.id, gateId: g.gate.id, clearedAt: at }
      clears.set(c.id, c)
      added.push(c)
      cleared++
      events.push({ kind: 'gate', course, gate: g.gate, cleared, total: view.total, at })
    }
    const allCleared = course.gates.length > 0 && course.gates.every((g) => clears.has(clearId(course.id, g.id)))
    if (allCleared && !clears.has(clearId(course.id))) {
      const c: Clear = { id: clearId(course.id), courseId: course.id, clearedAt: at }
      clears.set(c.id, c)
      added.push(c)
      events.push({ kind: 'course', course, cleared: view.total, total: view.total, at })
    }
  }
  return { clears: added, events }
}

function applySteps(data: SekishoData, steps: Step[], now: Date): Changes {
  const at = now.toISOString()
  const progress = progressMap(data)
  const clears = clearMap(data)
  const courses = new Map(data.courses.map((c) => [c.id, c]))
  const changed = new Map<string, ItemProgress>()
  const touched = new Set<string>()
  for (const step of steps) {
    const course = courses.get(step.courseId)
    if (!course) continue
    const found = findItem(course, step.itemId)
    // 順番のコースで、まだ開いていない関所の項目は進めない
    if (!found || !openAt(course, clears, found.gateIndex)) continue
    const goal = itemGoal(found.item)
    const id = progressId(course.id, found.item.id)
    const before = progress.get(id)
    const done = doneOf(progress, course.id, found.item)
    const next = Math.max(0, Math.min(goal, Math.floor(step.next(done, goal))))
    if (next === done) continue
    const wasComplete = done >= goal
    const p: ItemProgress = {
      id,
      courseId: course.id,
      itemId: found.item.id,
      done: next,
      ...(next >= goal ? { checkedAt: wasComplete && before?.checkedAt ? before.checkedAt : at } : {}),
      updatedAt: at,
    }
    progress.set(id, p)
    changed.set(id, p)
    touched.add(course.id)
  }
  if (changed.size === 0) return {}
  const found = detectClears(
    data.courses.filter((c) => touched.has(c.id)),
    progress,
    clears,
    at,
  )
  return {
    progress: [...changed.values()],
    ...(found.clears.length > 0 ? { clears: found.clears, events: found.events } : {}),
  }
}

/** 1 つ進める（「＋1」。回数の無い項目なら済みにする） */
export function addOne(data: SekishoData, courseId: string, itemId: string, now: Date): Changes {
  return applySteps(data, [{ courseId, itemId, next: (d) => d + 1 }], now)
}

/** 1 つ戻す（まちがえたとき） */
export function removeOne(data: SekishoData, courseId: string, itemId: string, now: Date): Changes {
  return applySteps(data, [{ courseId, itemId, next: (d) => d - 1 }], now)
}

/** 済みにする（回数のある項目は、まとめて回数まで） */
export function checkItem(data: SekishoData, courseId: string, itemId: string, now: Date): Changes {
  return applySteps(data, [{ courseId, itemId, next: (_d, goal) => goal }], now)
}

/** 外す（回数は 0 に戻る。関所のクリアの記録は残る） */
export function uncheckItem(data: SekishoData, courseId: string, itemId: string, now: Date): Changes {
  return applySteps(data, [{ courseId, itemId, next: () => 0 }], now)
}

/** 済んでいれば外し、まだなら済みにする（チェック欄を押したとき） */
export function toggleItem(data: SekishoData, courseId: string, itemId: string, now: Date): Changes {
  return applySteps(data, [{ courseId, itemId, next: (d, goal) => (d >= goal ? 0 : goal) }], now)
}

/** target が同じか（type と id が同じ。ほかの項目は見ない） */
export function sameTarget(a: TargetRef | undefined, b: TargetRef | undefined): boolean {
  return !!a && !!b && a.type === b.type && (a.id ?? null) === (b.id ?? null)
}

/**
 * 自動のチェック。アプリが「これをした」と知らせると、target が同じチェック項目を、
 * 入っているコース全部で amount ずつ進める（回数の無い項目は済みにする）。
 * 数えるのは知らせを受けたときだけなので、コースを入れる前の練習はさかのぼらない
 */
export function report(data: SekishoData, activity: Activity, now: Date): Changes {
  const amount = Math.floor(Number(activity.amount ?? 1))
  if (!Number.isFinite(amount) || amount < 1) return {}
  const steps: Step[] = []
  for (const course of data.courses) {
    for (const gate of course.gates) {
      for (const item of gate.items) {
        if (sameTarget(item.target, activity.target)) steps.push({ courseId: course.id, itemId: item.id, next: (d) => d + amount })
      }
    }
  }
  return applySteps(data, steps, now)
}

/**
 * クリアの記録を整える。コースが新しい版になって項目が減ったときなど、
 * 進み具合は変わらないのに関所が全部済んだ状態になったら、ここでクリアにする。
 * courseIds を渡すと、そのコースだけを見る
 */
export function settleClears(data: SekishoData, now: Date, courseIds?: string[]): Changes {
  const only = courseIds ? new Set(courseIds) : null
  const courses = only ? data.courses.filter((c) => only.has(c.id)) : data.courses
  const found = detectClears(courses, progressMap(data), clearMap(data), now.toISOString())
  return found.clears.length > 0 ? { clears: found.clears, events: found.events } : {}
}

// ─── 保存・同期のための道具 ─────────────────────────────────

/** コースを消す（進み具合・クリアの記録も一緒に） */
export function deleteCourse(data: SekishoData, courseId: string): Changes {
  return {
    deleteCourseIds: data.courses.some((c) => c.id === courseId) ? [courseId] : [],
    deleteProgressIds: data.progress.filter((p) => p.courseId === courseId).map((p) => p.id),
    deleteClearIds: data.clears.filter((c) => c.courseId === courseId).map((c) => c.id),
  }
}

function upsert<T extends { id: string }>(rows: T[], put: T[] | undefined, del: string[] | undefined): T[] {
  if (!put?.length && !del?.length) return rows
  const drop = new Set(del ?? [])
  const byId = new Map(rows.filter((r) => !drop.has(r.id)).map((r) => [r.id, r]))
  for (const r of put ?? []) byId.set(r.id, r)
  return [...byId.values()]
}

/** 変更を手元のデータに当てる（新しいデータを返す。元は変えない） */
export function applyChanges<T extends SekishoData>(data: T, changes: Changes): T {
  return {
    ...data,
    courses: upsert(data.courses, changes.courses, changes.deleteCourseIds),
    progress: upsert(data.progress, changes.progress, changes.deleteProgressIds),
    clears: upsert(data.clears, changes.clears, changes.deleteClearIds),
  }
}

/**
 * 同期・追記で、ほかの端末の進み具合を受け取ったとき、書き直すものを返す。
 * 手元に無いもの・手元より新しい（updatedAt が後の）ものだけ。
 * クリアの記録は消えないので、手元に無い id のものを足すだけでよい
 */
export function newerProgress(local: ItemProgress[], incoming: ItemProgress[]): ItemProgress[] {
  const byId = new Map(local.map((p) => [p.id, p]))
  return incoming.filter((p) => {
    const mine = byId.get(p.id)
    return !mine || p.updatedAt > mine.updatedAt
  })
}
