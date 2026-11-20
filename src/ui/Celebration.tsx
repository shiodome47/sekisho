import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ClearEvent } from '../core/types'
import { stampOf, type RewardConnector, type StampRenderProps } from './connectors'
import { JA_LABELS, type Labels } from './labels'
import { isUrlVideoReward, urlVideoConnector } from './urlParts'
import { urlOf } from '../core/url'
import { Stamp, useReducedMotion } from './Stamp'

/** 部品に入っているご褒美: ひみつの一言（{ type: 'message', text: '…' }） */
export const messageReward: RewardConnector = {
  type: 'message',
  render: ({ reward, done, labels }) => {
    const text = typeof reward.text === 'string' ? reward.text : ''
    return (
      <div className="sk-reward-message">
        <p className="sk-reward-message__label">{labels.secretMessage}</p>
        <p className="sk-reward-message__text">{text}</p>
        <button type="button" className="sk-btn sk-btn--primary" onClick={done} autoFocus>
          {labels.next}
        </button>
      </div>
    )
  },
}

export interface CelebrationProps {
  /** 見せるクリアの知らせ（古いものから）。空なら何も出さない */
  events: ClearEvent[]
  /** 全部見せ終えたとき（閉じたとき）。アプリは events を空にする */
  onDone: () => void
  /** ご褒美のコネクタ（部品に入っている message に足す・差し替える） */
  rewards?: RewardConnector[]
  /** スタンプの演出を差し替える */
  renderStamp?: (props: StampRenderProps) => ReactNode
  /** 演出を減らす。無ければ端末の設定（prefers-reduced-motion）に従う */
  reducedMotion?: boolean
  /** 音を出さない（コネクタに渡す）。既定は true */
  muted?: boolean
  labels?: Partial<Labels>
  theme?: 'light' | 'dark' | 'system'
  className?: string
}

const isEmptyMessage = (r: { type: string; text?: unknown }) => r.type === 'message' && !(typeof r.text === 'string' && r.text.trim())

type Step = { event: ClearEvent; part: 'stamp' } | { event: ClearEvent; part: 'reward'; connector: RewardConnector }

/**
 * クリアの演出。知らせ 1 つにつき「スタンプ → ご褒美（あれば）」の順に見せる。
 * 画面いっぱいに重ねて出す。<Sekisho> の中でも使っているが、自動のチェック（report）の知らせを
 * 練習の画面の上で見せたいときは、アプリがこれを置く
 */
export function Celebration({
  events,
  onDone,
  rewards = [],
  renderStamp,
  reducedMotion: forceReduced,
  muted = true,
  labels: labelsPatch,
  theme = 'system',
  className,
}: CelebrationProps) {
  const labels = useMemo(() => ({ ...JA_LABELS, ...labelsPatch }), [labelsPatch])
  const reducedMotion = useReducedMotion(forceReduced)
  const connectors = useMemo(() => {
    const m = new Map<string, RewardConnector>([[messageReward.type, messageReward]])
    for (const r of rewards) m.set(r.type, r)
    return m
  }, [rewards])
  const steps = useMemo<Step[]>(
    () =>
      events.flatMap((event): Step[] => {
        const reward = event.kind === 'gate' ? event.gate?.reward : event.course.reward
        // URL の動画のご褒美（{ type: 'video', url }）は部品が出す（http(s) でなければ飛ばす）
        const connector =
          !reward || isEmptyMessage(reward)
            ? undefined
            : isUrlVideoReward(reward)
              ? urlOf(reward)
                ? urlVideoConnector
                : undefined
              : connectors.get(reward.type)
        // 知らない type のご褒美は飛ばす（古い版のアプリでも止まらない）
        return connector ? [{ event, part: 'stamp' }, { event, part: 'reward', connector }] : [{ event, part: 'stamp' }]
      }),
    [events, connectors],
  )
  const [index, setIndex] = useState(0)
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  useEffect(() => setIndex(0), [events])
  const step = steps[index]
  const next = () => {
    if (index + 1 >= steps.length) doneRef.current()
    else setIndex(index + 1)
  }
  useEffect(() => {
    if (!step) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') doneRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])
  if (!step) return null

  const { event } = step
  let body: ReactNode
  if (step.part === 'reward') {
    const reward = (event.kind === 'gate' ? event.gate?.reward : event.course.reward)!
    body = step.connector.render({ reward, event, done: next, reducedMotion, muted, labels })
  } else {
    const stamp = event.gate ? stampOf(event.gate, event.course.color) : { text: '制覇', color: event.course.color || '#d9480f' }
    const props: StampRenderProps = { event, stamp, done: next, reducedMotion, muted, labels }
    body = renderStamp ? renderStamp(props) : <DefaultStamp {...props} />
  }
  return (
    <div
      className={['sekisho', 'sk-celebration', reducedMotion ? 'sk-reduced' : '', className ?? ''].filter(Boolean).join(' ')}
      data-theme={theme}
      role="dialog"
      aria-modal="true"
      aria-label={event.kind === 'gate' ? labels.gateClear : labels.courseClear}
    >
      <div className="sk-celebration__panel" key={index}>
        {body}
      </div>
    </div>
  )
}

/** 既定の演出: 通行手形に、スタンプが「ポン！」と押される */
function DefaultStamp({ event, stamp, done, labels }: StampRenderProps) {
  const course = event.kind === 'course'
  return (
    <div className="sk-clear">
      <p className="sk-clear__title" aria-live="assertive">
        {course ? labels.courseClear : labels.gateClear}
      </p>
      <div className="sk-clear__paper">
        {course ? (
          <div className="sk-clear__row">
            {event.course.gates.map((g, i) => {
              const s = stampOf(g, event.course.color)
              return (
                <span key={g.id} className="sk-clear__mini" style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
                  <Stamp text={s.text} color={s.color} size={44} tilt={((i * 7) % 15) - 7} label={g.title} />
                </span>
              )
            })}
          </div>
        ) : (
          <span className="sk-clear__stamp">
            <Stamp text={stamp.text} color={stamp.color} size={140} label={event.gate?.title} />
            <span className="sk-clear__splash" style={{ borderColor: stamp.color }} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="sk-clear__name">{course ? event.course.title : event.gate?.title}</p>
      <p className="sk-clear__count">{labels.clearedOf(event.cleared, event.total)}</p>
      <button type="button" className="sk-btn sk-btn--primary" onClick={done} autoFocus>
        {labels.next}
      </button>
    </div>
  )
}
