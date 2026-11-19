import { describe, expect, it } from 'vitest'
import {
  addGate,
  addItem,
  duplicateCourse,
  moveGate,
  moveItem,
  newCourse,
  newGate,
  newItem,
  removeGate,
  removeItem,
  updateCourse,
  updateGate,
  updateItem,
} from '../index'

const T0 = new Date('2026-11-20T10:00:00Z')
const T1 = new Date('2026-11-20T11:00:00Z')

function sample() {
  let c = newCourse({ title: ' 手話の基本 ' }, T0)
  const g1 = newGate({ title: 'あいさつ' })
  const g2 = newGate({ title: '数字' })
  c = addGate(addGate(c, g1, T0), g2, T0)
  const a = newItem({ title: 'おはよう' })
  const b = newItem({ title: 'ありがとうを 10 回', count: 10, target: { type: 'segment', id: 's1' } })
  c = addItem(addItem(c, g1.id, a, T0), g1.id, b, T0)
  return { c, g1, g2, a, b }
}

describe('コースを作る・直す', () => {
  it('新しいコースは、自分のコース・どこからでも・版 1', () => {
    const c = newCourse({ title: ' 手話の基本 ' }, T0)
    expect(c).toMatchObject({ title: '手話の基本', origin: 'own', route: 'free', revision: 1, gates: [] })
    expect(c.createdAt).toBe(T0.toISOString())
  })

  it('回数は 2 以上のときだけ持つ', () => {
    expect(newItem({ title: 'x', count: 1 }).count).toBeUndefined()
    expect(newItem({ title: 'x', count: 10 }).count).toBe(10)
  })

  it('関所と項目を足すと、直すたびに版が上がる。元のコースは変えない', () => {
    const before = newCourse({ title: 'x' }, T0)
    const after = addGate(before, newGate({ title: 'a' }), T1)
    expect(before.gates).toHaveLength(0)
    expect(after.revision).toBe(2)
    expect(after.updatedAt).toBe(T1.toISOString())
    const { c } = sample()
    expect(c.revision).toBe(5)
    expect(c.gates[0].items.map((i) => i.title)).toEqual(['おはよう', 'ありがとうを 10 回'])
  })

  it('直す・消す', () => {
    const { c, g1, g2, a, b } = sample()
    const d = updateItem(updateGate(updateCourse(c, { route: 'ordered' }, T1), g1.id, { stamp: { text: '挨' } }, T1), a.id, { title: 'おはよう！' }, T1)
    expect(d.route).toBe('ordered')
    expect(d.gates[0].stamp).toEqual({ text: '挨' })
    expect(d.gates[0].items[0].title).toBe('おはよう！')
    expect(removeItem(d, b.id, T1).gates[0].items.map((i) => i.id)).toEqual([a.id])
    expect(removeGate(d, g2.id, T1).gates.map((g) => g.id)).toEqual([g1.id])
  })

  it('関所の並びを変える', () => {
    const { c, g1, g2 } = sample()
    expect(moveGate(c, g1.id, 1, T1).gates.map((g) => g.id)).toEqual([g2.id, g1.id])
    expect(moveGate(c, 'nope', 0, T1)).toBe(c)
  })

  it('項目を、同じ関所の中でも、ほかの関所へも動かせる', () => {
    const { c, g1, g2, a, b } = sample()
    expect(moveItem(c, b.id, g1.id, 0, T1).gates[0].items.map((i) => i.id)).toEqual([b.id, a.id])
    const moved = moveItem(c, a.id, g2.id, 0, T1)
    expect(moved.gates[0].items.map((i) => i.id)).toEqual([b.id])
    expect(moved.gates[1].items.map((i) => i.id)).toEqual([a.id])
  })

  it('複製すると、新しい id の自分のコースになる', () => {
    const { c } = sample()
    const given = { ...c, origin: 'given' as const }
    const copy = duplicateCourse(given, T1, '自分用')
    expect(copy).toMatchObject({ title: '自分用', origin: 'own', revision: 1, createdAt: T1.toISOString() })
    expect(copy.id).not.toBe(c.id)
    expect(copy.gates).toEqual(c.gates)
    expect(copy.gates).not.toBe(c.gates)
  })
})
