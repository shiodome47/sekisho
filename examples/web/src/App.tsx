import { useEffect, useRef, useState } from 'react'
import {
  applyChanges,
  Celebration,
  report,
  Sekisho,
  type ClearEvent,
  type Course,
  type RewardConnector,
  type SekishoData,
  type TargetAdapter,
  type TargetRef,
} from '@shiodome47/sekisho'
import { CourseEditor } from '@shiodome47/sekisho/editor'

/** 見本の「区間」（手話アプリなら、A-B リピートで保存した区間） */
const SEGMENTS = [
  { id: 's-ohayo', title: '「おはよう」の区間' },
  { id: 's-arigato', title: '「ありがとう」の区間' },
  { id: 's-yoroshiku', title: '「よろしく」の区間' },
]

const T = '2026-11-20T00:00:00.000Z'
const SAMPLE: Course = {
  id: 'demo-basic',
  title: '手話のはじめの一歩',
  description: '先生が配ったコースの見本です。どの関所から回ってもかまいません。',
  origin: 'given',
  route: 'free',
  revision: 1,
  createdAt: T,
  updatedAt: T,
  gates: [
    {
      id: 'g-aisatsu',
      title: 'あいさつ',
      stamp: { text: '挨拶' },
      reward: { type: 'message', text: '毎日のあいさつが、いちばんの練習です。' },
      items: [
        { id: 'i-ohayo', title: '「おはよう」の動画を見る', target: { type: 'segment', id: 's-ohayo' } },
        { id: 'i-arigato', title: '「ありがとう」を 5 回くり返す', target: { type: 'segment', id: 's-arigato' }, count: 5 },
      ],
    },
    {
      id: 'g-jiko',
      title: '自己紹介',
      reward: { type: 'confetti' },
      items: [
        { id: 'i-namae', title: '自分の名前を表せるようにする' },
        { id: 'i-yoroshiku', title: '「よろしく」を 3 回くり返す', target: { type: 'segment', id: 's-yoroshiku' }, count: 3 },
      ],
    },
    {
      id: 'g-kazu',
      title: '数字',
      stamp: { text: '数', color: '#1d4ed8' },
      items: [
        { id: 'i-1to5', title: '1 から 5 まで' },
        { id: 'i-6to10', title: '6 から 10 まで' },
      ],
    },
  ],
  reward: { type: 'message', text: '全部の関所を回りました。おめでとうございます！' },
}

const KEY = 'sekisho-demo'
const initial = (): SekishoData => ({ courses: [SAMPLE], progress: [], clears: [] })
function load(): SekishoData {
  try {
    const s = localStorage.getItem(KEY)
    return s ? (JSON.parse(s) as SekishoData) : initial()
  } catch {
    return initial()
  }
}

/** アプリが足すご褒美のコネクタの見本: 紙吹雪 */
const confetti: RewardConnector = {
  type: 'confetti',
  render: ({ done, reducedMotion }) => <Confetti done={done} still={reducedMotion} />,
}

function Confetti({ done, still }: { done: () => void; still: boolean }) {
  const colors = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#a855f7']
  return (
    <div className="demo-confetti">
      {!still
        ? Array.from({ length: 40 }, (_, i) => (
            <span
              key={i}
              style={{
                left: `${(i * 37) % 100}%`,
                background: colors[i % colors.length],
                animationDelay: `${(i % 10) * 0.08}s`,
              }}
            />
          ))
        : null}
      <p className="demo-confetti__text">🎉 アプリが足したご褒美（紙吹雪）</p>
      <button type="button" className="sk-btn sk-btn--primary" onClick={done} autoFocus>
        つぎへ
      </button>
    </div>
  )
}

type Theme = 'light' | 'dark' | 'system'

export function App() {
  const [data, setData] = useState<SekishoData>(load)
  const [theme, setTheme] = useState<Theme>('system')
  const [reduced, setReduced] = useState(false)
  const [toast, setToast] = useState('')
  const [autoEvents, setAutoEvents] = useState<ClearEvent[]>([])
  const [picking, setPicking] = useState(false)
  const pickResolve = useRef<(v: { target: TargetRef; title: string } | null) => void>()

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      /* 保存できなくても動く */
    }
  }, [data])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const targets: TargetAdapter = {
    renderBadge: (t) => (t.type === 'segment' ? '🔁' : '▶'),
    open: (t) => setToast(`${SEGMENTS.find((s) => s.id === t.id)?.title ?? t.id} を開きます（見本）`),
    pick: () =>
      new Promise((resolve) => {
        pickResolve.current = resolve
        setPicking(true)
      }),
  }

  const practice = (segmentId: string) => {
    const ch = report(data, { target: { type: 'segment', id: segmentId } }, new Date())
    setData((d) => applyChanges(d, ch))
    if (ch.events?.length) setAutoEvents((q) => [...q, ...ch.events!])
    setToast(ch.progress?.length ? '関所の項目が 1 つ進みました' : '進む項目はありませんでした')
  }

  return (
    <div className={dark ? 'demo demo--dark' : 'demo'}>
      <header className="demo-head">
        <h1>関所めぐり <small>@shiodome47/sekisho の見本</small></h1>
        <p>
          チェックリストをクリアすると、通行手形にスタンプが押されます。データはこのブラウザの中だけに保存します。
        </p>
        <div className="demo-controls">
          <div className="demo-seg" role="radiogroup" aria-label="表示">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={theme === t} className={theme === t ? 'is-on' : ''} onClick={() => setTheme(t)}>
                {t === 'light' ? 'ライト' : t === 'dark' ? 'ダーク' : '端末に合わせる'}
              </button>
            ))}
          </div>
          <label>
            <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} /> 演出を減らす
          </label>
          <button
            type="button"
            className="demo-btn"
            onClick={() => {
              setData(initial())
              setToast('はじめの状態にもどしました')
            }}
          >
            はじめからやり直す
          </button>
        </div>
      </header>

      <section className="demo-practice" aria-label="自動のチェックを試す">
        <h2>自動のチェックを試す</h2>
        <p>アプリで区間をくり返したことにします（アプリは report() で部品に知らせます）。</p>
        <div className="demo-practice__buttons">
          {SEGMENTS.map((s) => (
            <button key={s.id} type="button" className="demo-btn" onClick={() => practice(s.id)}>
              {s.title}を 1 回くり返した
            </button>
          ))}
        </div>
      </section>

      <Sekisho
        data={data}
        onChange={(ch) => setData((d) => applyChanges(d, ch))}
        targets={targets}
        rewards={[confetti]}
        editor={CourseEditor}
        theme={theme}
        reducedMotion={reduced || undefined}
      />

      <Celebration events={autoEvents} onDone={() => setAutoEvents([])} rewards={[confetti]} theme={theme} reducedMotion={reduced || undefined} />

      {picking ? (
        <div className="demo-modal" role="dialog" aria-label="区間を選ぶ">
          <div className="demo-modal__panel">
            <h2>区間を選ぶ（アプリの画面の見本）</h2>
            {SEGMENTS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="demo-btn"
                onClick={() => {
                  setPicking(false)
                  pickResolve.current?.({ title: s.title, target: { type: 'segment', id: s.id } })
                }}
              >
                🔁 {s.title}
              </button>
            ))}
            <button
              type="button"
              className="demo-btn demo-btn--ghost"
              onClick={() => {
                setPicking(false)
                pickResolve.current?.(null)
              }}
            >
              やめる
            </button>
          </div>
        </div>
      ) : null}

      {toast ? (
        <p className="demo-toast" role="status">
          {toast}
        </p>
      ) : null}
    </div>
  )
}
