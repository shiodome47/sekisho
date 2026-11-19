import { describe, expect, it } from 'vitest'
import {
  addOne,
  applyChanges,
  checkItem,
  clearId,
  deleteCourse,
  currentLap,
  isGateOpen,
  lapId,
  newerProgress,
  nextLap,
  progressId,
  removeOne,
  report,
  restartCourse,
  settleClears,
  toggleItem,
  uncheckItem,
  viewCourse,
  type Course,
  type SekishoData,
} from '../index'

const T0 = new Date('2026-11-20T10:00:00Z')
const T1 = new Date('2026-11-20T11:00:00Z')

/** 関所 2 つのコース。あいさつ（文字だけ・区間を 3 回）／数字（動画） */
function course(route: Course['route'] = 'free'): Course {
  return {
    id: 'c1',
    title: '手話の基本',
    origin: 'given',
    route,
    revision: 1,
    createdAt: T0.toISOString(),
    updatedAt: T0.toISOString(),
    gates: [
      {
        id: 'g1',
        title: 'あいさつ',
        items: [
          { id: 'i1', title: '「おはよう」を覚える' },
          { id: 'i2', title: '「ありがとう」を 3 回', target: { type: 'segment', id: 's1' }, count: 3 },
        ],
      },
      { id: 'g2', title: '数字', items: [{ id: 'i3', title: '数字の動画を見る', target: { type: 'lesson', id: 'l1' } }] },
    ],
  }
}

const data = (c: Course = course()): SekishoData => ({ courses: [c], progress: [], clears: [] })

/** 変更を当てていく（アプリがすることと同じ） */
function run(d: SekishoData, ...ops: ((d: SekishoData) => ReturnType<typeof addOne>)[]) {
  const events = []
  for (const op of ops) {
    const ch = op(d)
    d = applyChanges(d, ch)
    events.push(...(ch.events ?? []))
  }
  return { d, events }
}

describe('チェックと回数', () => {
  it('回数の無い項目は、＋1 で済みになる', () => {
    const { d } = run(data(), (d) => addOne(d, 'c1', 'i1', T0))
    const v = viewCourse(d, d.courses[0])
    expect(v.gates[0].items[0]).toMatchObject({ done: 1, goal: 1, complete: true })
    expect(d.progress[0]).toMatchObject({ id: progressId('c1', 'i1'), checkedAt: T0.toISOString() })
  })

  it('回数のある項目は、押すたびに 1 つ進み、回数より上には行かない', () => {
    const plus = (d: SekishoData) => addOne(d, 'c1', 'i2', T0)
    const { d } = run(data(), plus, plus)
    expect(viewCourse(d, d.courses[0]).gates[0].items[1]).toMatchObject({ done: 2, goal: 3, complete: false })
    expect(d.progress[0].checkedAt).toBeUndefined()
    const after = run(d, plus, plus, plus).d
    expect(after.progress[0].done).toBe(3)
  })

  it('回数に届いたあとの＋1 は、何も変えない', () => {
    const { d } = run(data(), (d) => checkItem(d, 'c1', 'i2', T0))
    expect(addOne(d, 'c1', 'i2', T1)).toEqual({})
  })

  it('1 つ戻す・外す', () => {
    let { d } = run(data(), (d) => checkItem(d, 'c1', 'i2', T0))
    d = run(d, (d) => removeOne(d, 'c1', 'i2', T1)).d
    expect(d.progress[0]).toMatchObject({ done: 2 })
    expect(d.progress[0].checkedAt).toBeUndefined()
    d = run(d, (d) => uncheckItem(d, 'c1', 'i2', T1)).d
    expect(d.progress[0].done).toBe(0)
    expect(removeOne(d, 'c1', 'i2', T1)).toEqual({})
  })

  it('チェック欄を押すと、済み／外す が入れかわる', () => {
    let { d } = run(data(), (d) => toggleItem(d, 'c1', 'i2', T0))
    expect(d.progress[0].done).toBe(3)
    d = run(d, (d) => toggleItem(d, 'c1', 'i2', T1)).d
    expect(d.progress[0].done).toBe(0)
  })

  it('無い項目・無いコースは何も変えない', () => {
    expect(addOne(data(), 'c1', 'nope', T0)).toEqual({})
    expect(addOne(data(), 'nope', 'i1', T0)).toEqual({})
  })
})

describe('関所のクリア', () => {
  it('関所の項目が全部済むと、クリアの記録と知らせが出る', () => {
    const { d, events } = run(
      data(),
      (d) => checkItem(d, 'c1', 'i1', T0),
      (d) => checkItem(d, 'c1', 'i2', T1),
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ kind: 'gate', gate: { id: 'g1' }, cleared: 1, total: 2, at: T1.toISOString() })
    expect(d.clears).toEqual([{ id: clearId('c1', 'g1'), courseId: 'c1', gateId: 'g1', clearedAt: T1.toISOString() }])
    expect(viewCourse(d, d.courses[0])).toMatchObject({ cleared: 1, total: 2, complete: false })
  })

  it('項目を外しても、クリアは残る。もう一度そろっても、知らせは 2 回目は出ない', () => {
    let { d } = run(
      data(),
      (d) => checkItem(d, 'c1', 'i1', T0),
      (d) => checkItem(d, 'c1', 'i2', T0),
    )
    d = run(d, (d) => uncheckItem(d, 'c1', 'i1', T1)).d
    const g = viewCourse(d, d.courses[0]).gates[0]
    expect(g).toMatchObject({ cleared: true, complete: false, clearedAt: T0.toISOString() })
    const again = run(d, (d) => checkItem(d, 'c1', 'i1', T1))
    expect(again.events).toEqual([])
  })

  it('関所を全部クリアすると、コースのクリアも出る', () => {
    const { d, events } = run(
      data(),
      (d) => checkItem(d, 'c1', 'i1', T0),
      (d) => checkItem(d, 'c1', 'i2', T0),
      (d) => checkItem(d, 'c1', 'i3', T1),
    )
    expect(events.map((e) => e.kind)).toEqual(['gate', 'gate', 'course'])
    expect(events[2]).toMatchObject({ cleared: 2, total: 2 })
    expect(viewCourse(d, d.courses[0])).toMatchObject({ complete: true, clearedAt: T1.toISOString() })
  })

  it('項目が 1 つも無い関所は、クリアにならない', () => {
    const c = course()
    c.gates.push({ id: 'g3', title: 'からっぽ', items: [] })
    const { d, events } = run(
      data(c),
      (d) => checkItem(d, 'c1', 'i1', T0),
      (d) => checkItem(d, 'c1', 'i2', T0),
      (d) => checkItem(d, 'c1', 'i3', T0),
    )
    expect(events.map((e) => e.kind)).toEqual(['gate', 'gate'])
    expect(viewCourse(d, d.courses[0]).complete).toBe(false)
  })
})

describe('回り方', () => {
  it('どこからでも: 関所は全部開いていて、2 番目からクリアできる', () => {
    const d0 = data()
    expect(viewCourse(d0, d0.courses[0]).gates.map((g) => g.open)).toEqual([true, true])
    const { events } = run(d0, (d) => checkItem(d, 'c1', 'i3', T0))
    expect(events[0]).toMatchObject({ gate: { id: 'g2' } })
  })

  it('順番: 前の関所をクリアするまで、次の関所は開かず、項目も進まない', () => {
    const d0 = data(course('ordered'))
    expect(viewCourse(d0, d0.courses[0]).gates.map((g) => g.open)).toEqual([true, false])
    expect(isGateOpen(d0, d0.courses[0], 'g2')).toBe(false)
    expect(checkItem(d0, 'c1', 'i3', T0)).toEqual({})
    const { d } = run(
      d0,
      (d) => checkItem(d, 'c1', 'i1', T0),
      (d) => checkItem(d, 'c1', 'i2', T0),
    )
    expect(isGateOpen(d, d.courses[0], 'g2')).toBe(true)
    expect(run(d, (d) => checkItem(d, 'c1', 'i3', T1)).events[0]).toMatchObject({ gate: { id: 'g2' } })
  })

  it('順番: もうクリアした関所は、前に関所が足されても開いたまま', () => {
    let { d } = run(
      data(course('ordered')),
      (d) => checkItem(d, 'c1', 'i1', T0),
      (d) => checkItem(d, 'c1', 'i2', T0),
    )
    const c = { ...d.courses[0], gates: [{ id: 'g0', title: '新しい関所', items: [{ id: 'i0', title: '…' }] }, ...d.courses[0].gates] }
    d = { ...d, courses: [c] }
    expect(viewCourse(d, c).gates.map((g) => g.open)).toEqual([true, true, true])
  })
})

describe('自動のチェック（report）', () => {
  it('target が同じ項目を 1 つ進める', () => {
    const { d } = run(data(), (d) => report(d, { target: { type: 'segment', id: 's1' } }, T0))
    expect(d.progress).toEqual([
      { id: progressId('c1', 'i2'), courseId: 'c1', itemId: 'i2', done: 1, updatedAt: T0.toISOString() },
    ])
  })

  it('amount ぶん進め、最後の 1 回で関所がクリアになる', () => {
    const { events } = run(
      data(),
      (d) => checkItem(d, 'c1', 'i1', T0),
      (d) => report(d, { target: { type: 'segment', id: 's1' }, amount: 2 }, T0),
      (d) => report(d, { target: { type: 'segment', id: 's1' } }, T1),
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ kind: 'gate', at: T1.toISOString() })
  })

  it('入っているコース全部で進める', () => {
    const c2 = { ...course(), id: 'c2' }
    const d0: SekishoData = { courses: [course(), c2], progress: [], clears: [] }
    const { d } = run(d0, (d) => report(d, { target: { type: 'lesson', id: 'l1' } }, T0))
    expect(d.progress.map((p) => p.courseId).sort()).toEqual(['c1', 'c2'])
  })

  it('type か id が違えば進めない。amount が 0 以下なら何もしない', () => {
    expect(report(data(), { target: { type: 'segment', id: 'other' } }, T0)).toEqual({})
    expect(report(data(), { target: { type: 'lesson', id: 's1' } }, T0)).toEqual({})
    expect(report(data(), { target: { type: 'segment', id: 's1' }, amount: 0 }, T0)).toEqual({})
  })

  it('順番のコースで、開いていない関所の項目は進めない', () => {
    expect(report(data(course('ordered')), { target: { type: 'lesson', id: 'l1' } }, T0)).toEqual({})
  })
})

describe('保存・同期のための道具', () => {
  it('settleClears: 項目が減って全部済んだ関所をクリアにする', () => {
    let { d } = run(data(), (d) => checkItem(d, 'c1', 'i1', T0))
    const c = { ...d.courses[0], gates: [{ ...d.courses[0].gates[0], items: [d.courses[0].gates[0].items[0]] }, d.courses[0].gates[1]] }
    d = { ...d, courses: [c] }
    const ch = settleClears(d, T1)
    expect(ch.clears?.map((x) => x.id)).toEqual([clearId('c1', 'g1')])
    expect(settleClears(applyChanges(d, ch), T1)).toEqual({})
  })

  it('deleteCourse: 進み具合・クリアの記録も一緒に消す', () => {
    const { d } = run(
      data(),
      (d) => checkItem(d, 'c1', 'i1', T0),
      (d) => checkItem(d, 'c1', 'i2', T0),
    )
    const after = applyChanges(d, deleteCourse(d, 'c1'))
    expect(after).toEqual({ courses: [], progress: [], clears: [], laps: [] })
  })

  it('applyChanges: アプリが足した項目は残す', () => {
    const d = { ...data(), extra: 1 }
    expect(applyChanges(d, {}).extra).toBe(1)
  })

  it('newerProgress: 手元に無いもの・新しいものだけを返す', () => {
    const p = (id: string, updatedAt: string) => ({ id, courseId: 'c1', itemId: id, done: 1, updatedAt })
    const local = [p('a', '2026-11-20T10:00:00Z'), p('b', '2026-11-20T10:00:00Z')]
    const incoming = [p('a', '2026-11-20T09:00:00Z'), p('b', '2026-11-20T11:00:00Z'), p('c', '2026-11-20T08:00:00Z')]
    expect(newerProgress(local, incoming).map((x) => x.id)).toEqual(['b', 'c'])
  })
})

describe('周回', () => {
  const T2 = new Date('2026-11-21T10:00:00Z')
  /** あいさつの関所をクリアしたところ */
  const cleared1 = () =>
    run(
      data(),
      (d) => checkItem(d, 'c1', 'i1', T0),
      (d) => checkItem(d, 'c1', 'i2', T0),
    ).d

  it('もう一周する: 今の周を記録し、チェックとスタンプが空になって 2 周目になる', () => {
    const d = run(cleared1(), (d) => nextLap(d, 'c1', T1)).d
    const v = viewCourse(d, d.courses[0])
    expect(v).toMatchObject({ lap: 2, cleared: 0, complete: false, started: false })
    expect(v.gates[0].items.map((i) => i.done)).toEqual([0, 0])
    expect(v.laps).toEqual([{ id: lapId('c1', 1), courseId: 'c1', round: 1, endedAt: T1.toISOString(), cleared: 1, total: 2, complete: false }])
    expect(currentLap(d, 'c1')).toBe(2)
    expect(d.progress).toEqual([])
    expect(d.clears).toEqual([])
  })

  it('2 周目でも、関所をクリアするとスタンプと演出がまた出る。記録には周の番号が入る', () => {
    let d = run(cleared1(), (d) => nextLap(d, 'c1', T1)).d
    const r = run(
      d,
      (d) => checkItem(d, 'c1', 'i1', T2),
      (d) => checkItem(d, 'c1', 'i2', T2),
    )
    d = r.d
    expect(r.events.map((e) => e.kind)).toEqual(['gate'])
    expect(d.clears[0]).toMatchObject({ id: clearId('c1', 'g1'), round: 2 })
    expect(d.progress.every((p) => p.round === 2)).toBe(true)
  })

  it('前の周の記録が残っていても（ほかの端末から届いたなど）、今の周には数えない', () => {
    const old = cleared1()
    let d = run(old, (d) => nextLap(d, 'c1', T1)).d
    // 前の周の進み具合とクリアの記録が戻ってきた
    d = { ...d, progress: old.progress, clears: old.clears }
    const v = viewCourse(d, d.courses[0])
    expect(v.cleared).toBe(0)
    expect(v.gates[0].items.map((i) => i.done)).toEqual([0, 0])
    // 2 周目で済ませれば、前の周の記録を上書きして、演出も出る
    const r = run(
      d,
      (d) => checkItem(d, 'c1', 'i1', T2),
      (d) => checkItem(d, 'c1', 'i2', T2),
    )
    expect(r.events).toHaveLength(1)
  })

  it('3 周目まで進めると、周回の記録が古い順に 2 つ', () => {
    let d = run(cleared1(), (d) => nextLap(d, 'c1', T1)).d
    d = run(d, (d) => checkItem(d, 'c1', 'i3', T2), (d) => nextLap(d, 'c1', T2)).d
    const v = viewCourse(d, d.courses[0])
    expect(v.lap).toBe(3)
    expect(v.laps.map((l) => [l.round, l.cleared])).toEqual([
      [1, 1],
      [2, 1],
    ])
  })

  it('はじめからやり直す: チェック・スタンプ・周回の記録を全部消して 1 周目に戻る', () => {
    let d = run(cleared1(), (d) => nextLap(d, 'c1', T1)).d
    d = run(d, (d) => checkItem(d, 'c1', 'i3', T2), (d) => restartCourse(d, 'c1', T2)).d
    const v = viewCourse(d, d.courses[0])
    expect(v).toMatchObject({ lap: 1, laps: [], cleared: 0, started: false })
    // 中の番号は進んでいるので、前の周の記録が戻ってきても数えない
    const back = { ...d, clears: [{ id: clearId('c1', 'g1'), courseId: 'c1', gateId: 'g1', clearedAt: T0.toISOString() }] }
    expect(viewCourse(back, back.courses[0]).cleared).toBe(0)
    // やり直したあとも、関所をクリアすると演出が出る
    expect(run(d, (d) => checkItem(d, 'c1', 'i3', T2)).events.map((e) => e.kind)).toEqual(['gate'])
  })

  it('周回の記録の無い 0.1.0 のデータも、1 周目として読める', () => {
    const { laps: _l, ...v01 } = cleared1()
    expect(viewCourse(v01, v01.courses[0])).toMatchObject({ lap: 1, cleared: 1, laps: [] })
  })

  it('コースを消すと、周回の記録も消える', () => {
    const d = run(cleared1(), (d) => nextLap(d, 'c1', T1)).d
    expect(applyChanges(d, deleteCourse(d, 'c1')).laps).toEqual([])
  })

  it('無いコースは何もしない', () => {
    expect(nextLap(data(), 'nope', T0)).toEqual({})
    expect(restartCourse(data(), 'nope', T0)).toEqual({})
  })
})
