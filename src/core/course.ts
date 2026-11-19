/**
 * コースを作る・直す（画面なし）。自分のコースを作る画面と、管理者がコースを作る画面の両方で使う。
 * どの関数も元のコースは変えず、新しいコースを返す。直すたびに revision（設計の版）が 1 つ上がる。
 */
import type { CheckItem, Course, Gate, Route } from './types'

const newId = () => crypto.randomUUID()

/** 新しいコース（関所は空） */
export function newCourse(
  input: { title: string; description?: string; route?: Route; origin?: Course['origin']; color?: string },
  now: Date,
): Course {
  const at = now.toISOString()
  return {
    id: newId(),
    title: input.title.trim(),
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    origin: input.origin ?? 'own',
    route: input.route ?? 'free',
    ...(input.color ? { color: input.color } : {}),
    gates: [],
    revision: 1,
    createdAt: at,
    updatedAt: at,
  }
}

/** 新しい関所（項目は空） */
export function newGate(input: { title: string; description?: string }): Gate {
  return {
    id: newId(),
    title: input.title.trim(),
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    items: [],
  }
}

/** 新しいチェック項目 */
export function newItem(input: { title: string; target?: CheckItem['target']; count?: number; note?: string }): CheckItem {
  return {
    id: newId(),
    title: input.title.trim(),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    ...(input.target ? { target: input.target } : {}),
    ...(input.count && input.count > 1 ? { count: Math.floor(input.count) } : {}),
  }
}

/** 直したコース（版を上げ、直した日時を入れる） */
function touch(course: Course, gates: Gate[], now: Date, patch: Partial<Course> = {}): Course {
  return { ...course, ...patch, gates, revision: course.revision + 1, updatedAt: now.toISOString() }
}

/** 並びの中で 1 つを動かす（toIndex は動かしたあとの位置） */
function moveIn<T>(list: T[], from: number, toIndex: number): T[] {
  const out = list.slice()
  const [x] = out.splice(from, 1)
  out.splice(Math.max(0, Math.min(out.length, toIndex)), 0, x)
  return out
}

/** コースの名前・説明・回り方・色・ご褒美を直す */
export function updateCourse(
  course: Course,
  patch: Partial<Pick<Course, 'title' | 'description' | 'route' | 'color' | 'reward'>>,
  now: Date,
): Course {
  return touch(course, course.gates, now, patch)
}

/** 関所を足す（index が無ければ最後に） */
export function addGate(course: Course, gate: Gate, now: Date, index?: number): Course {
  const gates = course.gates.slice()
  gates.splice(index ?? gates.length, 0, gate)
  return touch(course, gates, now)
}

/** 関所の名前・説明・スタンプ・ご褒美を直す */
export function updateGate(
  course: Course,
  gateId: string,
  patch: Partial<Pick<Gate, 'title' | 'description' | 'stamp' | 'reward' | 'points'>>,
  now: Date,
): Course {
  return touch(course, course.gates.map((g) => (g.id === gateId ? { ...g, ...patch } : g)), now)
}

/** 関所を消す（中の項目ごと） */
export function removeGate(course: Course, gateId: string, now: Date): Course {
  return touch(course, course.gates.filter((g) => g.id !== gateId), now)
}

/** 関所の並びを変える */
export function moveGate(course: Course, gateId: string, toIndex: number, now: Date): Course {
  const from = course.gates.findIndex((g) => g.id === gateId)
  if (from < 0) return course
  return touch(course, moveIn(course.gates, from, toIndex), now)
}

/** 関所にチェック項目を足す（index が無ければ最後に） */
export function addItem(course: Course, gateId: string, item: CheckItem, now: Date, index?: number): Course {
  return touch(
    course,
    course.gates.map((g) => {
      if (g.id !== gateId) return g
      const items = g.items.slice()
      items.splice(index ?? items.length, 0, item)
      return { ...g, items }
    }),
    now,
  )
}

/** チェック項目を直す */
export function updateItem(
  course: Course,
  itemId: string,
  patch: Partial<Pick<CheckItem, 'title' | 'note' | 'target' | 'count'>>,
  now: Date,
): Course {
  return touch(
    course,
    course.gates.map((g) => ({ ...g, items: g.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) })),
    now,
  )
}

/** チェック項目を消す */
export function removeItem(course: Course, itemId: string, now: Date): Course {
  return touch(course, course.gates.map((g) => ({ ...g, items: g.items.filter((i) => i.id !== itemId) })), now)
}

/** チェック項目を動かす（同じ関所の中でも、ほかの関所へも） */
export function moveItem(course: Course, itemId: string, toGateId: string, toIndex: number, now: Date): Course {
  const item = course.gates.flatMap((g) => g.items).find((i) => i.id === itemId)
  if (!item || !course.gates.some((g) => g.id === toGateId)) return course
  const gates = course.gates.map((g) => {
    const items = g.items.filter((i) => i.id !== itemId)
    if (g.id === toGateId) items.splice(Math.max(0, Math.min(items.length, toIndex)), 0, item)
    return { ...g, items }
  })
  return touch(course, gates, now)
}

/**
 * 複製して自分のコースにする（与えられたコースを、自分用に直したいとき）。
 * 新しい id になるので、進み具合は引き継がない
 */
export function duplicateCourse(course: Course, now: Date, title?: string): Course {
  const at = now.toISOString()
  return {
    ...structuredClone(course),
    id: newId(),
    title: (title ?? course.title).trim(),
    origin: 'own',
    revision: 1,
    createdAt: at,
    updatedAt: at,
  }
}
