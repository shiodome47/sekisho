/**
 * URL のチェック項目（{ type: 'url', url }）・URL のご褒美（{ type: 'video', url }）のための道具（画面なし）。
 * URL は http(s) だけを使う（javascript: などは使わない）。YouTube・Dropbox の扱いは @shiodome47/video-utils
 */
import { isSafeUrl } from '@shiodome47/video-utils'
import type { RewardRef, TargetRef } from './types'

/** チェック項目の中身が URL のときの type */
export const URL_TARGET = 'url'

/** http(s) の URL なら、前後の空白を除いて返す。ほかは undefined */
export function safeUrl(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  return s && isSafeUrl(s) ? s : undefined
}

/** チェック項目・ご褒美の url（http(s) のものだけ） */
export const urlOf = (r: TargetRef | RewardRef | undefined): string | undefined => (r && 'url' in r ? safeUrl(r.url) : undefined)

/** URL のチェック項目か */
export const isUrlTarget = (t: TargetRef | undefined): boolean => t?.type === URL_TARGET

/** URL のチェック項目の中身を作る */
export function urlTarget(url: string): TargetRef {
  return { type: URL_TARGET, url: url.trim() }
}

/** URL の動画のご褒美を作る（title は無くてもよい） */
export function urlVideoReward(url: string, title?: string): RewardRef {
  return { type: 'video', url: url.trim(), ...(title?.trim() ? { title: title.trim() } : {}) }
}
