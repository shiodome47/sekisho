import { describe, expect, it } from 'vitest'
import { parseCourses, safeUrl, urlOf, urlTarget, urlVideoReward } from '../index'

const T = new Date('2026-11-21T00:00:00Z')

describe('URL の道具', () => {
  it('http(s) だけ。前後の空白は除く', () => {
    expect(safeUrl(' https://youtu.be/abc ')).toBe('https://youtu.be/abc')
    expect(safeUrl('http://example.com/a.mp4')).toBe('http://example.com/a.mp4')
    expect(safeUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeUrl('data:text/html,x')).toBeUndefined()
    expect(safeUrl(1)).toBeUndefined()
    expect(urlTarget(' https://a.example/ ')).toEqual({ type: 'url', url: 'https://a.example/' })
    expect(urlVideoReward('https://a.example/v.mp4', ' おめでとう ')).toEqual({ type: 'video', url: 'https://a.example/v.mp4', title: 'おめでとう' })
    expect(urlOf({ type: 'url', url: 'ftp://x' })).toBeUndefined()
  })
})

describe('読むときに URL を確かめる', () => {
  const course = (gate: Record<string, unknown>, reward?: unknown) => ({
    id: 'c',
    title: 'コース',
    ...(reward ? { reward } : {}),
    gates: [{ id: 'g', title: '関所', items: [], ...gate }],
  })

  it('http(s) の URL の項目・ご褒美は、そのまま読む（空白は除く）', () => {
    const { courses, errors } = parseCourses(
      course({ items: [{ id: 'i', title: '見る', target: { type: 'url', url: ' https://youtu.be/abc ' } }], reward: { type: 'video', url: 'https://a.example/v.mp4' } }),
      T,
    )
    expect(errors).toEqual([])
    expect(courses[0].gates[0].items[0].target).toEqual({ type: 'url', url: 'https://youtu.be/abc' })
    expect(courses[0].gates[0].reward).toEqual({ type: 'video', url: 'https://a.example/v.mp4' })
  })

  it('ほかの URL は、項目の中身・ご褒美ごと落とし（項目は文字だけになる）、わけを返す', () => {
    const { courses, errors } = parseCourses(
      course(
        { items: [{ id: 'i', title: '見る', target: { type: 'url', url: 'javascript:alert(1)' } }], reward: { type: 'video', url: 'data:text/html,x' } },
        { type: 'video', url: 42 },
      ),
      T,
    )
    const c = courses[0]
    expect(c.gates[0].items[0]).toEqual({ id: 'i', title: '見る' })
    expect(c.gates[0].reward).toBeUndefined()
    expect(c.reward).toBeUndefined()
    expect(errors).toHaveLength(3)
    expect(errors[0]).toMatch(/URL/)
  })
})
