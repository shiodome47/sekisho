import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { newCourse, type Course } from '../../core/index'
import { CourseEditor } from '../CourseEditor'

const T0 = new Date('2026-11-20T10:00:00Z')

describe('<CourseEditor>', () => {
  it('名前・関所・項目を入れて保存すると、直したコースが届く', async () => {
    const onSave = vi.fn()
    const pick = vi.fn().mockResolvedValue({ title: '「こんにちは」の区間', target: { type: 'segment', id: 's9' } })
    render(<CourseEditor course={newCourse({ title: '' }, T0)} onSave={onSave} onCancel={() => {}} targets={{ pick }} />)

    fireEvent.change(screen.getByLabelText('コースの名前'), { target: { value: 'はじめての手話' } })
    fireEvent.click(screen.getByRole('radio', { name: '順番' }))
    fireEvent.click(screen.getByRole('button', { name: /関所を足す/ }))
    fireEvent.change(screen.getByLabelText('関所の名前'), { target: { value: 'あいさつ' } })
    fireEvent.change(screen.getByLabelText('項目を足す'), { target: { value: '「ありがとう」を 10 回くり返す' } })
    fireEvent.click(screen.getByRole('button', { name: '項目を足す' }))
    fireEvent.click(screen.getByRole('button', { name: /動画・区間から足す/ }))
    await screen.findByDisplayValue('「こんにちは」の区間')
    fireEvent.change(screen.getByLabelText('ご褒美: ひみつの一言（なくてもよい）'), { target: { value: 'おめでとう' } })
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

  it('やめると onCancel', () => {
    const onCancel = vi.fn()
    render(<CourseEditor course={newCourse({ title: 'x' }, T0)} onSave={() => {}} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'やめる' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
