import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { newCourse, newGate, type Course } from '../../core/index'
import { CourseEditor } from '../CourseEditor'

const T0 = new Date('2026-11-20T10:00:00Z')

describe('<CourseEditor>', () => {
  it('名前・関所・項目を入れて保存すると、直したコースが届く', async () => {
    const onSave = vi.fn()
    const pick = vi.fn().mockResolvedValue({ title: '「こんにちは」の区間', target: { type: 'segment', id: 's9' } })
    render(<CourseEditor course={newCourse({ title: '' }, T0)} onSave={onSave} onCancel={() => {}} targets={{ pick }} />)

    fireEvent.change(screen.getByLabelText('コース名'), { target: { value: 'はじめての手話' } })
    fireEvent.click(screen.getByRole('radio', { name: '順番に' }))
    fireEvent.click(screen.getByRole('button', { name: /関所を追加/ }))
    fireEvent.change(screen.getByLabelText('関所の名前'), { target: { value: 'あいさつ' } })
    fireEvent.change(screen.getByLabelText('やることを追加'), { target: { value: '「ありがとう」を 10 回くり返す' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    fireEvent.click(screen.getByRole('button', { name: /動画・区間から追加/ }))
    await screen.findByDisplayValue('「こんにちは」の区間')
    fireEvent.change(screen.getByLabelText('この関所のご褒美: ひみつの一言'), { target: { value: 'おめでとう' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    const saved: Course = onSave.mock.calls[0][0]
    expect(saved).toMatchObject({ title: 'はじめての手話', route: 'ordered', revision: 2 })
    expect(saved.gates).toHaveLength(1)
    expect(saved.gates[0]).toMatchObject({ title: 'あいさつ', reward: { type: 'message', text: 'おめでとう' } })
    expect(saved.gates[0].items).toEqual([
      expect.objectContaining({ title: '「ありがとう」を 10 回くり返す', count: 10 }),
      expect.objectContaining({ title: '「こんにちは」の区間', target: { type: 'segment', id: 's9' } }),
    ])
  })

  it('項目の並べ替え・回数・消す', () => {
    const onSave = vi.fn()
    const c: Course = {
      ...newCourse({ title: 'x' }, T0),
      gates: [{ id: 'g', title: 'a', items: [{ id: 'i1', title: 'one' }, { id: 'i2', title: 'two' }] }],
    }
    render(<CourseEditor course={c} onSave={onSave} onCancel={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '「two」を上へ' }))
    fireEvent.change(screen.getAllByLabelText('回数')[0], { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: '「one」を消す' }))
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSave.mock.calls[0][0].gates[0].items).toEqual([{ id: 'i2', title: 'two', count: 5 }])
  })

  it('アプリのコネクタで、関所とコースのご褒美を選べる。選び直す・外すもできる', async () => {
    const onSave = vi.fn()
    const pick = vi.fn().mockResolvedValueOnce({ type: 'ignored', id: 'L1', title: 'おめでとう' }).mockResolvedValueOnce({ id: 'L2', title: 'よくできました' })
    const video = { type: 'video', label: '動画', pick, render: () => null }
    const c: Course = { ...newCourse({ title: 'x' }, T0), gates: [{ id: 'g', title: 'a', items: [{ id: 'i1', title: 'one' }] }] }
    render(<CourseEditor course={c} onSave={onSave} onCancel={() => {}} rewards={[video]} />)
    const buttons = screen.getAllByRole('button', { name: /ご褒美の動画を選ぶ/ })
    expect(buttons).toHaveLength(2) // コースと関所
    fireEvent.click(buttons[1])
    await screen.findByText('ご褒美: 動画「おめでとう」')
    fireEvent.click(screen.getByRole('button', { name: '選び直す' }))
    await screen.findByText('ご褒美: 動画「よくできました」')
    fireEvent.change(screen.getByLabelText('コース制覇のご褒美: ひみつの一言'), { target: { value: '全部おわり！' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    const saved: Course = onSave.mock.calls[0][0]
    expect(saved.gates[0].reward).toEqual({ type: 'video', id: 'L2', title: 'よくできました' })
    expect(saved.reward).toEqual({ type: 'message', text: '全部おわり！' })
  })

  it('pick の無いご褒美は、名前を出して外せるだけ', () => {
    const onSave = vi.fn()
    const c: Course = { ...newCourse({ title: 'x' }, T0), gates: [{ id: 'g', title: 'a', items: [], reward: { type: 'confetti' } }] }
    render(<CourseEditor course={c} onSave={onSave} onCancel={() => {}} rewards={[{ type: 'confetti', label: '紙吹雪', render: () => null }]} />)
    expect(screen.getByText('ご褒美: 紙吹雪')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '選び直す' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'ご褒美を外す' }))
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSave.mock.calls[0][0].gates[0].reward).toBeUndefined()
  })

  it('URL から項目を足せる。名前が無ければページの題名。http(s) でなければ足せない', async () => {
    const onSave = vi.fn()
    const titleOf = vi.fn().mockResolvedValue('あいさつの見本')
    const c: Course = { ...newCourse({ title: 'x' }, T0), gates: [{ id: 'g', title: 'a', items: [] }] }
    render(<CourseEditor course={c} onSave={onSave} onCancel={() => {}} targets={{ titleOf }} />)
    fireEvent.click(screen.getByRole('button', { name: /URL から追加/ }))
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'javascript:alert(1)' } })
    expect(screen.getByRole('alert')).toHaveTextContent('http:// か https://')
    expect(screen.getByRole('button', { name: 'この URL にする' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://youtu.be/abc' } })
    await screen.findByPlaceholderText('名前（なくてもよい。例: あいさつの見本）', {}, { timeout: 2000 })
    fireEvent.click(screen.getByRole('button', { name: 'この URL にする' }))
    expect(screen.getByDisplayValue('「あいさつの見本」を見る')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSave.mock.calls[0][0].gates[0].items[0]).toMatchObject({ title: '「あいさつの見本」を見る', target: { type: 'url', url: 'https://youtu.be/abc' } })
  })

  it('ご褒美の動画を URL で選び、選び直す・外す', () => {
    const onSave = vi.fn()
    const c: Course = { ...newCourse({ title: 'x' }, T0), gates: [{ id: 'g', title: 'a', items: [] }] }
    render(<CourseEditor course={c} onSave={onSave} onCancel={() => {}} />)
    // コースと関所の 2 つ。関所のほうに
    fireEvent.click(screen.getAllByRole('button', { name: /ご褒美の動画を URL で/ })[1])
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://www.dropbox.com/s/x/a.mp4' } })
    fireEvent.change(screen.getByLabelText('URL の名前'), { target: { value: 'おめでとう' } })
    fireEvent.click(screen.getByRole('button', { name: 'この URL にする' }))
    expect(screen.getByText('ご褒美: 動画「おめでとう」（URL）')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '選び直す' }))
    expect(screen.getByLabelText('URL')).toHaveValue('https://www.dropbox.com/s/x/a.mp4')
    fireEvent.change(screen.getByLabelText('URL の名前'), { target: { value: 'よくできました' } })
    fireEvent.click(screen.getByRole('button', { name: 'この URL にする' }))
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSave.mock.calls[0][0].gates[0].reward).toEqual({ type: 'video', url: 'https://www.dropbox.com/s/x/a.mp4', title: 'よくできました' })
  })

  it('allowUrl={false} なら URL のボタンは出ない', () => {
    const c: Course = { ...newCourse({ title: 'x' }, T0), gates: [{ id: 'g', title: 'a', items: [] }] }
    render(<CourseEditor course={c} onSave={() => {}} onCancel={() => {}} allowUrl={false} />)
    expect(screen.queryByRole('button', { name: /URL から追加/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /ご褒美の動画を URL で/ })).toBeNull()
  })

  it('キャンセルで onCancel', () => {
    const onCancel = vi.fn()
    render(<CourseEditor course={newCourse({ title: 'x' }, T0)} onSave={() => {}} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('「…」のメニューで、関所を上へ・下へ動かす、消す', () => {
    const onSave = vi.fn()
    let c = newCourse({ title: 'c' }, T0)
    c = { ...c, gates: [newGate({ title: 'A' }), newGate({ title: 'B' }), newGate({ title: 'C' })] }
    render(<CourseEditor course={c} onSave={onSave} onCancel={() => {}} />)
    expect(screen.getByRole('heading', { name: 'コースの編集' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '関所「C」のメニュー' }))
    expect(screen.queryByRole('menuitem', { name: '下へ動かす' })).toBeNull()
    fireEvent.click(screen.getByRole('menuitem', { name: '上へ動かす' }))
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '関所「A」のメニュー' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'この関所を消す' }))
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSave.mock.calls[0][0].gates.map((g: { title: string }) => g.title)).toEqual(['C', 'B'])
  })

  it('新しいコースは「コースを作る」。ご褒美の欄は、決めてあるときだけ開いている', () => {
    let c = newCourse({ title: '' }, T0)
    c = { ...c, gates: [{ ...newGate({ title: 'A' }), reward: { type: 'message', text: 'やった' } }] }
    const { container } = render(<CourseEditor course={c} onSave={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('heading', { name: 'コースを作る' })).toBeInTheDocument()
    const folds = [...container.querySelectorAll('details.sk-fold')] as HTMLDetailsElement[]
    expect(folds.map((d) => d.open)).toEqual([false, true])
  })
})
