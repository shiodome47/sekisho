/**
 * URL のチェック項目・URL の動画のご褒美の画面（0.4.0）。
 * URL は http(s) のものだけを使う（core/url.ts の urlOf）。YouTube・Dropbox の扱いは @shiodome47/video-utils
 */
import { buildYouTubeEmbedUrl, extractYouTubeId, normalizeDropboxUrl, openExternal } from '@shiodome47/video-utils'
import type { ReactNode } from 'react'
import type { CheckItem, RewardRef, TargetRef } from '../core/types'
import { isUrlTarget, urlOf } from '../core/url'
import type { RewardConnector, TargetAdapter } from './connectors'
import type { Labels } from './labels'

/** リンクの印 */
export function LinkIcon({ label }: { label?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={label} style={{ verticalAlign: '-2px' }}>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </svg>
  )
}

/** 画面で使う窓口（アプリの窓口に、URL のチェック項目の扱いを足したもの） */
export interface ResolvedTargets {
  renderBadge: (target: TargetRef, item: CheckItem) => ReactNode
  canOpen: (target: TargetRef) => boolean
  open: (target: TargetRef, item: CheckItem) => void
}

/**
 * アプリの窓口に、URL のチェック項目（{ type: 'url', url }）の扱いを足す。
 * URL の項目は部品が受け持つ（印・http(s) のときだけ開ける・別のタブで開く）。開き方は targets.openUrl で変えられる
 */
export function resolveTargets(targets: TargetAdapter | undefined, labels: Labels): ResolvedTargets {
  return {
    renderBadge: (t, item) => {
      const app = targets?.renderBadge?.(t, item)
      if (app !== undefined && app !== null) return app
      return isUrlTarget(t) ? <LinkIcon label={labels.urlBadge} /> : null
    },
    canOpen: (t) => (isUrlTarget(t) ? !!urlOf(t) : !!targets?.open && (targets.canOpen?.(t) ?? true)),
    open: (t, item) => {
      if (!isUrlTarget(t)) return targets?.open?.(t, item)
      const url = urlOf(t)
      if (!url) return
      if (targets?.openUrl) targets.openUrl(url, item)
      else openExternal(url)
    },
  }
}

/** URL の動画のご褒美か（{ type: 'video', url }） */
export const isUrlVideoReward = (r: RewardRef | undefined): boolean => r?.type === 'video' && r.url !== undefined

/**
 * 部品に入っている、URL の動画のご褒美。
 * YouTube は動画 ID から埋め込みを作り、ほかは動画として再生する（Dropbox の共有リンクは再生用の形に）
 */
export const urlVideoConnector: RewardConnector = {
  type: 'video',
  render: ({ reward, done, muted, labels }) => <UrlVideo reward={reward} done={done} muted={muted} labels={labels} />,
}

function UrlVideo({ reward, done, muted, labels }: { reward: RewardRef; done: () => void; muted: boolean; labels: Labels }) {
  const url = urlOf(reward)
  const title = typeof reward.title === 'string' ? reward.title : ''
  const youtubeId = url ? extractYouTubeId(url) : null
  return (
    <div className="sk-video-reward">
      <p className="sk-reward-message__label">{labels.rewardVideo}</p>
      {title ? <p className="sk-video-reward__title">{title}</p> : null}
      {youtubeId ? (
        <div className="sk-video-reward__frame">
          <iframe
            src={`${buildYouTubeEmbedUrl(youtubeId)}&autoplay=1&playsinline=1${muted ? '&mute=1' : ''}`}
            title={title || labels.rewardVideo}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : url ? (
        <div className="sk-video-reward__frame">
          <video src={normalizeDropboxUrl(url)} controls autoPlay playsInline muted={muted} />
        </div>
      ) : null}
      <div className="sk-video-reward__actions">
        {url ? (
          <button type="button" className="sk-btn" onClick={() => openExternal(url)}>
            {labels.openInNewTab}
          </button>
        ) : null}
        <button type="button" className="sk-btn sk-btn--primary" onClick={done} autoFocus>
          {labels.next}
        </button>
      </div>
    </div>
  )
}
