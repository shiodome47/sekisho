/**
 * アプリとのつなぎ（コネクタ・窓口）の形。
 * 部品はチェック項目の中身もご褒美の中身も知らない。アプリがこれを渡して、表示・開く・演出を受け持つ。
 */
import type { ReactNode } from 'react'
import type { CheckItem, ClearEvent, Gate, RewardRef, TargetRef } from '../core/types'
import type { Labels } from './labels'

/** チェック項目の中身（動画・区間など）の窓口 */
export interface TargetAdapter {
  /** 「動画・区間を選ぶ」を押したとき。アプリが自分の画面で選ばせ、選んだものを返す（やめたら null） */
  pick?: () => Promise<{ target: TargetRef; title: string } | null>
  /** 項目の横に出す小さな印（▶ 動画、🔁 区間 など） */
  renderBadge?: (target: TargetRef, item: CheckItem) => ReactNode
  /** 項目を押したとき、その中身を開く（手話アプリなら、動画や区間に飛ぶ）。無ければ押せない */
  open?: (target: TargetRef, item: CheckItem) => void
  /** 開けるか（消した動画など、開けないものは false）。無ければ開ける */
  canOpen?: (target: TargetRef) => boolean
}

/** ご褒美のコネクタに渡すもの */
export interface RewardRenderProps {
  reward: RewardRef
  event: ClearEvent
  /** 呼ぶと次へ進む（閉じる） */
  done: () => void
  /** 演出を減らす（動きを止める）とき true */
  reducedMotion: boolean
  /** 音を出さないとき true */
  muted: boolean
  labels: Labels
}

/**
 * ご褒美のコネクタ。type が同じご褒美（gate.reward・course.reward）を出す。
 * アプリが <Sekisho rewards={[...]} /> で渡す。部品に入っているもの（message）と同じ type なら、こちらが使われる
 */
export interface RewardConnector {
  type: string
  render: (props: RewardRenderProps) => ReactNode
}

/** スタンプ（クリアの演出）を差し替えるときに渡すもの */
export interface StampRenderProps {
  event: ClearEvent
  /** スタンプの文字・色（gate.stamp ・コースの色から決めたもの） */
  stamp: { text: string; color: string }
  done: () => void
  reducedMotion: boolean
  muted: boolean
  labels: Labels
}

/** 関所のスタンプの文字と色（無ければ名前の 1 文字目・コースの色・朱色） */
export function stampOf(gate: Pick<Gate, 'title' | 'stamp'>, courseColor?: string): { text: string; color: string } {
  const text = gate.stamp?.text?.trim() || [...gate.title.trim()][0] || '関'
  return { text: [...text].slice(0, 2).join(''), color: gate.stamp?.color || courseColor || DEFAULT_STAMP_COLOR }
}

export const DEFAULT_STAMP_COLOR = '#d9480f'
