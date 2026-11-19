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

  it('events が空なら何も出さない', () => {
    const { container } = render(<Celebration events={[]} onDone={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
