import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { applyChanges, type Changes, type Course, type SekishoData } from '../../core/index'
import { Celebration } from '../Celebration'
import type { RewardConnector } from '../connectors'
import { Sekisho, type SekishoProps } from '../Sekisho'

const T0 = new Date('2026-11-20T10:00:00Z')

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
      reward: { type: 'message', text: 'よくできました' },
      items: [
        { id: 'i1', title: 'おはよう' },
        { id: 'i2', title: 'ありがとう', count: 2, target: { type: 'segment', id: 's1' } },
      ],
    },
    { id: 'g2', title: '数字', reward: { type: 'video', id: 'v1' }, items: [{ id: 'i3', title: '数字の動画' }] },
  ],
  ...patch,
})

/** アプリと同じように、変更を当てて持ち続ける */
function App(props: Partial<SekishoProps> & { initial: SekishoData; spy?: (c: Changes) => void }) {
  const { initial, spy, ...rest } = props
  const [data, setData] = useState(initial)
  return (
    <Sekisho
      data={data}
      now={() => T0}
      onChange={(c) => {
        spy?.(c)
        setData((d) => applyChanges(d, c))
      }}
      {...rest}
    />
  )
}

const start = (c: Course = course(), props: Partial<SekishoProps> & { spy?: (c: Changes) => void } = {}) => {
  render(<App initial={{ courses: [c], progress: [], clears: [] }} reducedMotion {...props} />)
  fireEvent.click(screen.getByRole('button', { name: /手話の基本/ }))
}

describe('<Sekisho>', () => {
  it('一覧からコースを開くと、関所と項目が出る', () => {
    start()
    expect(screen.getByRole('heading', { name: '手話の基本' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'あいさつ' })).toBeInTheDocument()
    expect(screen.getByText('0 / 2', { selector: '.sk-gate__count' })).toBeInTheDocument()
  })

  it('チェックを入れ、回数を＋1 すると、関所クリアの演出とご褒美が出る', () => {
    const spy = vi.fn()
    start(course(), { spy })
    fireEvent.click(screen.getByRole('checkbox', { name: '「おはよう」を済みにする' }))
    fireEvent.click(screen.getByRole('button', { name: '「ありがとう」を 1 回進める' }))
    expect(screen.getByText('1 / 2', { selector: '.sk-counter__value' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '「ありがとう」を 1 回進める' }))
    const dialog = screen.getByRole('dialog', { name: '関所クリア！' })
    expect(dialog).toHaveTextContent('あいさつ')
    fireEvent.click(screen.getByRole('button', { name: 'つぎへ' }))
    expect(screen.getByText('よくできました')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'つぎへ' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(spy.mock.calls.at(-1)?.[0].clears).toHaveLength(1)
  })

  it('順番のコースでは、まだの関所のチェックは押せない', () => {
    start(course({ route: 'ordered' }))
    expect(screen.getByRole('checkbox', { name: '「数字の動画」を済みにする' })).toBeDisabled()
    expect(screen.getByText(/まだ開いていません/)).toBeInTheDocument()
  })

  it('項目を押すと、アプリの open が呼ばれる', () => {
    const open = vi.fn()
    start(course(), { targets: { open, renderBadge: () => '🔁' } })
    fireEvent.click(screen.getByRole('button', { name: '「ありがとう」を開く' }))
    expect(open).toHaveBeenCalledWith({ type: 'segment', id: 's1' }, expect.objectContaining({ id: 'i2' }))
    expect(screen.getByText('🔁')).toBeInTheDocument()
  })

  it('editor を渡さなければ、作る・直すは出ない', () => {
    render(<App initial={{ courses: [course({ origin: 'own' })], progress: [], clears: [] }} />)
    expect(screen.queryByRole('button', { name: 'コースを作る' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /手話の基本/ }))
    expect(screen.queryByRole('button', { name: '直す' })).toBeNull()
  })

  it('コースを消すと、一覧にもどる', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    start()
    fireEvent.click(screen.getByRole('button', { name: 'コースを消す' }))
    expect(screen.getByText('まだコースがありません')).toBeInTheDocument()
  })
})

describe('周回', () => {
  it('もう一周すると、周回の記録が残り、2 周目でもう一度クリアの演出が出る', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const c = course({ gates: [{ id: 'g1', title: 'あいさつ', items: [{ id: 'i1', title: 'おはよう' }] }] })
    start(c)
    expect(screen.getByRole('button', { name: 'もう一周する' })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: '「おはよう」を済みにする' }))
    fireEvent.click(screen.getByRole('button', { name: 'つぎへ' })) // 関所クリア
    fireEvent.click(screen.getByRole('button', { name: 'つぎへ' })) // コース制覇
    fireEvent.click(screen.getByRole('button', { name: 'もう一周する' }))
    expect(screen.getByText('2 周目', { selector: '.sk-tag' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '周回の記録' })).toHaveTextContent('1 周目')
    expect(screen.getByRole('checkbox', { name: '「おはよう」を済みにする' })).not.toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: '「おはよう」を済みにする' }))
    expect(screen.getByRole('dialog', { name: '関所クリア！' })).toBeInTheDocument()
  })

  it('はじめからやり直すと、周回の記録も消えて 1 周目に戻る', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    start()
    fireEvent.click(screen.getByRole('checkbox', { name: '「おはよう」を済みにする' }))
    fireEvent.click(screen.getByRole('button', { name: 'もう一周する' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '「おはよう」を済みにする' }))
    fireEvent.click(screen.getByRole('button', { name: 'はじめからやり直す' }))
    expect(screen.queryByText('2 周目')).toBeNull()
    expect(screen.queryByRole('region', { name: '周回の記録' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: '「おはよう」を済みにする' })).not.toBeChecked()
  })
})

describe('URL のチェック項目', () => {
  const urlCourse = () =>
    course({
      gates: [
        {
          id: 'g1',
          title: 'あいさつ',
          items: [
            { id: 'i1', title: '見本を見る', target: { type: 'url', url: 'https://youtu.be/abc' } },
            { id: 'i2', title: 'あやしい', target: { type: 'url', url: 'javascript:alert(1)' } },
          ],
        },
      ],
    })

  it('印が出て、押すと別のタブで開く。http(s) でなければ押せない', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    start(urlCourse())
    expect(screen.getAllByRole('img', { name: 'URL' })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: '「見本を見る」を開く' }))
    expect(open).toHaveBeenCalledWith('https://youtu.be/abc', '_blank', 'noopener,noreferrer')
    expect(screen.queryByRole('button', { name: '「あやしい」を開く' })).toBeNull()
    open.mockRestore()
  })

  it('アプリの openUrl があれば、そちらで開く。アプリの印があれば、そちらを出す', () => {
    const openUrl = vi.fn()
    start(urlCourse(), { targets: { openUrl, renderBadge: (t) => (t.type === 'url' ? '🔗' : null) } })
    fireEvent.click(screen.getByRole('button', { name: '「見本を見る」を開く' }))
    expect(openUrl).toHaveBeenCalledWith('https://youtu.be/abc', expect.objectContaining({ id: 'i1' }))
    expect(screen.getAllByText('🔗')).toHaveLength(2)
  })
})

describe('<Celebration>', () => {
  const event = (c = course()) => ({ kind: 'gate' as const, course: c, gate: c.gates[1], cleared: 1, total: 2, at: T0.toISOString() })

  it('アプリのコネクタで、ご褒美を出す', () => {
    const video: RewardConnector = {
      type: 'video',
      render: ({ reward, done }) => (
        <button type="button" onClick={done}>
          動画 {String(reward.id)}
        </button>
      ),
    }
    const onDone = vi.fn()
    render(<Celebration events={[event()]} onDone={onDone} rewards={[video]} reducedMotion />)
    fireEvent.click(screen.getByRole('button', { name: 'つぎへ' }))
    fireEvent.click(screen.getByRole('button', { name: '動画 v1' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('知らない type のご褒美は飛ばす', () => {
    const onDone = vi.fn()
    render(<Celebration events={[event()]} onDone={onDone} reducedMotion />)
    fireEvent.click(screen.getByRole('button', { name: 'つぎへ' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('スタンプの演出を差し替えられる', () => {
    render(
      <Celebration
        events={[event()]}
        onDone={() => {}}
        renderStamp={({ stamp, done }) => (
          <button type="button" onClick={done}>
            メダル {stamp.text}
          </button>
        )}
      />,
    )
    expect(screen.getByRole('button', { name: 'メダル 数' })).toBeInTheDocument()
  })

  it('Escape で閉じる', () => {
    const onDone = vi.fn()
    render(<Celebration events={[event()]} onDone={onDone} />)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(onDone).toHaveBeenCalled()
  })

  const urlEvent = (url: unknown) => {
    const c = course({ gates: [{ id: 'g', title: 'a', items: [], reward: { type: 'video', url, title: 'おめでとう' } }] })
    return { kind: 'gate' as const, course: c, gate: c.gates[0], cleared: 1, total: 1, at: T0.toISOString() }
  }

  it('URL の動画のご褒美: YouTube は埋め込み。アプリの video コネクタがあっても、URL のものは部品が出す', () => {
    const appVideo: RewardConnector = { type: 'video', render: () => <p>アプリの動画</p> }
    render(<Celebration events={[urlEvent('https://youtu.be/dQw4w9WgXcQ')]} onDone={() => {}} rewards={[appVideo]} reducedMotion />)
    fireEvent.click(screen.getByRole('button', { name: 'つぎへ' }))
    expect(screen.getByText('ご褒美の動画')).toBeInTheDocument()
    expect(screen.queryByText('アプリの動画')).toBeNull()
    expect(document.querySelector('iframe')?.getAttribute('src')).toContain('/embed/dQw4w9WgXcQ')
  })

  it('URL の動画のご褒美: Dropbox の共有リンクは再生用の形で動画に。別のタブでも開ける', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<Celebration events={[urlEvent('https://www.dropbox.com/scl/fi/x/a.mp4?rlkey=k&dl=0')]} onDone={() => {}} reducedMotion />)
    fireEvent.click(screen.getByRole('button', { name: 'つぎへ' }))
    expect(document.querySelector('video')?.getAttribute('src')).toBe('https://www.dropbox.com/scl/fi/x/a.mp4?rlkey=k&raw=1')
    fireEvent.click(screen.getByRole('button', { name: '別のタブで開く' }))
    expect(open).toHaveBeenCalled()
    open.mockRestore()
  })

  it('URL が http(s) でないご褒美は飛ばす', () => {
    const onDone = vi.fn()
    render(<Celebration events={[urlEvent('javascript:alert(1)')]} onDone={onDone} reducedMotion />)
    fireEvent.click(screen.getByRole('button', { name: 'つぎへ' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('events が空なら何も出さない', () => {
    const { container } = render(<Celebration events={[]} onDone={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
