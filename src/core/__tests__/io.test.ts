import { describe, expect, it } from 'vitest'
import { applyChanges, checkItem, clearId, exportCourses, importCourses, parseCourses, viewCourse, type Course, type SekishoData } from '../index'

const T0 = new Date('2026-11-20T10:00:00Z')
const T1 = new Date('2026-11-20T11:00:00Z')

const course = (patch: Partial<Course> = {}): Course => ({
  id: 'c1',
  title: '手話の基本',
  origin: 'given',
  route: 'free',
  revision: 1,
  createdAt: T0.toISOString(),
  updatedAt: T0.toISOString(),
  gates: [
    {
      id: 'g1',
      title: 'あいさつ',
      items: [
        { id: 'i1', title: 'おはよう' },
        { id: 'i2', title: 'ありがとう' },
      ],
    },
  ],
  ...patch,
})

describe('書き出す・読む', () => {
  it('書き出したものを読むと、同じコースになる（origin は given）', () => {
    const own = course({ origin: 'own' })
    const file = JSON.parse(JSON.stringify(exportCourses([own])))
    expect(file).toMatchObject({ format: 'sekisho-courses', version: 1 })
    const { courses, errors } = parseCourses(file, T1)
    expect(errors).toEqual([])
    expect(courses).toEqual([{ ...own, origin: 'given' }])
  })

  it('コース 1 つ・並びでも読める。足りないところは補う', () => {
    const { courses } = parseCourses({ id: 'c9', title: '手で書いたコース', gates: [{ id: 'g', title: '関所', items: [{ id: 'x', title: '項目', count: '5' }] }] }, T1)
    expect(courses[0]).toMatchObject({ origin: 'given', route: 'free', revision: 1, createdAt: T1.toISOString() })
    expect(courses[0].gates[0].items[0].count).toBe(5)
    expect(parseCourses([course()], T1).courses).toHaveLength(1)
  })

  it('形の合わないところは飛ばして、わけを返す', () => {
    const { courses, errors } = parseCourses(
      {
        format: 'sekisho-courses',
        version: 1,
        courses: [
          { title: 'id なし' },
          {
            id: 'c1',
            title: 'ok',
            route: 'zigzag',
            gates: [
              { id: 'g1', title: 'a', items: [{ id: 'i1', title: 'x', target: { id: 1 } }, { id: 'i1', title: 'dup' }, { title: 'no id' }] },
              { id: 'g1', title: 'dup' },
              'nope',
            ],
          },
          { id: 'c1', title: 'dup' },
        ],
      },
      T1,
    )
    expect(courses).toHaveLength(1)
    expect(courses[0].route).toBe('free')
    expect(courses[0].gates).toHaveLength(1)
    expect(courses[0].gates[0].items).toEqual([{ id: 'i1', title: 'x' }])
    expect(errors.length).toBe(5)
  })

  it('新しい版のファイル・コースでないものは読まない', () => {
    expect(parseCourses({ format: 'sekisho-courses', version: 2, courses: [course()] }, T1).courses).toEqual([])
    expect(parseCourses('hello', T1).errors).toHaveLength(1)
  })

  it('知らない項目は残す（新しい版のアプリが足したもの）', () => {
    const { courses } = parseCourses({ ...course(), theme: 'sakura' }, T1)
    expect((courses[0] as unknown as Record<string, unknown>).theme).toBe('sakura')
  })
})

describe('取り込む', () => {
  const empty: SekishoData = { courses: [], progress: [], clears: [] }

  it('無いコースは足す', () => {
    const r = importCourses(empty, [course({ origin: 'own' })], T1)
    expect(r.added).toHaveLength(1)
    expect(r.changes.courses?.[0].origin).toBe('given')
  })

  it('新しい版だけ置きかえ、同じか古い版は入れない', () => {
    const d: SekishoData = { ...empty, courses: [course({ revision: 3 })] }
    expect(importCourses(d, [course({ revision: 2 })], T1).skipped).toHaveLength(1)
    expect(importCourses(d, [course({ revision: 3 })], T1).skipped).toHaveLength(1)
    expect(importCourses(d, [course({ revision: 3, updatedAt: T1.toISOString() })], T1).updated).toHaveLength(1)
    expect(importCourses(d, [course({ revision: 4 })], T1).updated).toHaveLength(1)
  })

  it('同じ id の自分のコースは置きかえない', () => {
    const d: SekishoData = { ...empty, courses: [course({ origin: 'own' })] }
    expect(importCourses(d, [course({ revision: 9 })], T1).skipped).toHaveLength(1)
  })

  it('新しい版にしても進み具合は残り、項目が減って全部済んだ関所はクリアになる', () => {
    let d: SekishoData = { ...empty, courses: [course()] }
    d = applyChanges(d, checkItem(d, 'c1', 'i1', T0))
    const v2 = course({ revision: 2, gates: [{ id: 'g1', title: 'あいさつ', items: [{ id: 'i1', title: 'おはよう' }] }] })
    const r = importCourses(d, [v2], T1)
    expect(r.changes.events?.[0]).toMatchObject({ kind: 'gate' })
    d = applyChanges(d, r.changes)
    expect(d.clears.map((c) => c.id)).toEqual([clearId('c1', 'g1'), clearId('c1')])
    expect(viewCourse(d, d.courses[0]).gates[0].items[0].complete).toBe(true)
  })
})
