import { useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { duplicateCourse, newCourse } from '../core/course'
import { exportCourses, importCourses, parseCourses } from '../core/io'
import {
  addOne,
  applyChanges,
  deleteCourse,
  nextLap,
  removeOne,
  restartCourse,
  settleClears,
  toggleItem,
  viewCourse,
  type CourseView,
  type GateView,
  type ItemView,
} from '../core/progress'
import type { Changes, ClearEvent, Course, SekishoData } from '../core/types'
import { Celebration } from './Celebration'
import { stampOf, type RewardConnector, type StampRenderProps, type TargetAdapter } from './connectors'
import { resolveTargets, type ResolvedTargets } from './urlParts'
import { JA_LABELS, type Labels } from './labels'
import { Stamp, useReducedMotion } from './Stamp'

/** コースを作る・編集する画面（@shiodome47/sekisho/editor の CourseEditor）に渡すもの */
export interface CourseEditorProps {
  course: Course
  /** 保存したとき（直したコースが届く） */
  onSave: (course: Course) => void
  onCancel: () => void
  targets?: TargetAdapter
  /** ご褒美のコネクタ（pick があるものは、作る画面で選べる） */
  rewards?: RewardConnector[]
  /** 「＋ URL から足す」「ご褒美の動画を URL で」を出す（0.4.0。既定は true） */
  allowUrl?: boolean
  labels?: Partial<Labels>
}

export interface SekishoProps {
  /** コース・進み具合・クリアの記録（アプリが保存先から読んだもの） */
  data: SekishoData
  /** 変わったとき。アプリは保存して、applyChanges で data を新しくする */
  onChange: (changes: Changes) => void
  /** 今（テスト・見本用）。無ければ new Date() */
  now?: () => Date
  /** チェック項目の中身（動画・区間など）の窓口 */
  targets?: TargetAdapter
  /** ご褒美のコネクタ */
  rewards?: RewardConnector[]
  /** スタンプの演出を差し替える */
  renderStamp?: (props: StampRenderProps) => ReactNode
  /**
   * コースを作る・直す画面（import { CourseEditor } from '@shiodome47/sekisho/editor'）。
   * 渡すと「コースを作る」「編集」が出る。渡さなければ、回るだけ
   */
  editor?: ComponentType<CourseEditorProps>
  /** 「コースを読み込む」（JSON のファイル）を出す。既定は true */
  allowImport?: boolean
  /** 「書き出す（配る用）」を出す。既定は true */
  allowExport?: boolean
  /**
   * 「書き出す（配る用）」を押したときに、アプリが書き出す（0.6.0）。
   * コースが指している動画・区間などを、いっしょに配りたいアプリが使う。渡さなければ、部品がコースの JSON を保存させる
   */
  onExport?: (course: Course) => void
  /**
   * 「コースを読み込む」で選んだファイルを、アプリが先に見る（0.6.0）。
   * アプリが受け持つファイル（アプリの配布用のまとまりなど）なら、取り込んで、お知らせの文を返す。
   * コースのファイルなら null を返す（部品がいつもどおり取り込む）
   */
  importFile?: (json: unknown) => string | null | Promise<string | null>
  /**
   * 作る画面で、URL（YouTube・Dropbox など）からチェック項目・ご褒美の動画を足せるようにする（0.4.0）。既定は true。
   * false でも、もうある URL の項目・ご褒美は使える
   */
  allowUrl?: boolean
  /** 演出を減らす。無ければ端末の設定に従う */
  reducedMotion?: boolean
  /** 音を出さない（コネクタに渡す）。既定は true */
  muted?: boolean
  theme?: 'light' | 'dark' | 'system'
  labels?: Partial<Labels>
  className?: string
}

type Screen = { kind: 'list' } | { kind: 'course'; id: string } | { kind: 'edit'; course: Course; isNew: boolean }

/**
 * 関所めぐりの画面まるごと: コースの一覧 → コース（通行手形・関所・チェック項目）。
 * クリアすると、スタンプとご褒美の演出を出す
 */
export function Sekisho(props: SekishoProps) {
  const {
    data,
    onChange,
    now = () => new Date(),
    targets,
    rewards,
    renderStamp,
    editor: Editor,
    allowImport = true,
    allowExport = true,
    onExport,
    importFile,
    allowUrl = true,
    reducedMotion: forceReduced,
    muted = true,
    theme = 'system',
    labels: labelsPatch,
    className,
  } = props
  const labels = useMemo(() => ({ ...JA_LABELS, ...labelsPatch }), [labelsPatch])
  // URL のチェック項目は部品が受け持つ（アプリの窓口に足す）
  const resolvedTargets = useMemo(() => resolveTargets(targets, labels), [targets, labels])
  const reducedMotion = useReducedMotion(forceReduced)
  const [screen, setScreen] = useState<Screen>({ kind: 'list' })
  const [events, setEvents] = useState<ClearEvent[]>([])
  const [notice, setNotice] = useState('')

  const change = (changes: Changes) => {
    if (Object.keys(changes).length === 0) return
    onChange(changes)
    if (changes.events?.length) setEvents((q) => [...q, ...changes.events!])
  }

  const saveCourse = (course: Course) => {
    const next = applyChanges(data, { courses: [course] })
    const settled = settleClears(next, now(), [course.id])
    change({ courses: [course], ...settled })
    setScreen({ kind: 'course', id: course.id })
  }

  const current = screen.kind === 'course' ? data.courses.find((c) => c.id === screen.id) : undefined

  let body: ReactNode
  if (screen.kind === 'edit' && Editor) {
    body = (
      <Editor
        course={screen.course}
        onSave={saveCourse}
        onCancel={() => setScreen(screen.isNew ? { kind: 'list' } : { kind: 'course', id: screen.course.id })}
        targets={targets}
        rewards={rewards}
        allowUrl={allowUrl}
        labels={labelsPatch}
      />
    )
  } else if (current) {
    body = (
      <CoursePage
        view={viewCourse(data, current)}
        labels={labels}
        targets={resolvedTargets}
        reducedMotion={reducedMotion}
        onBack={() => setScreen({ kind: 'list' })}
        onToggle={(itemId) => change(toggleItem(data, current.id, itemId, now()))}
        onPlus={(itemId) => change(addOne(data, current.id, itemId, now()))}
        onMinus={(itemId) => change(removeOne(data, current.id, itemId, now()))}
        onEdit={Editor && current.origin === 'own' ? () => setScreen({ kind: 'edit', course: current, isNew: false }) : undefined}
        onDuplicate={
          Editor && current.origin === 'given'
            ? () => {
                const copy = duplicateCourse(current, now())
                change({ courses: [copy] })
                setScreen({ kind: 'course', id: copy.id })
              }
            : undefined
        }
        onExport={allowExport ? () => (onExport ? onExport(current) : download(current)) : undefined}
        onNextLap={() => {
          if (!window.confirm(labels.nextLapConfirm(viewCourse(data, current).lap))) return
          change(nextLap(data, current.id, now()))
        }}
        onRestart={() => {
          if (!window.confirm(labels.restartConfirm)) return
          change(restartCourse(data, current.id, now()))
        }}
        onDelete={() => {
          if (!window.confirm(labels.deleteConfirm(current.title))) return
          change(deleteCourse(data, current.id))
          setScreen({ kind: 'list' })
        }}
      />
    )
  } else {
    body = (
      <CourseList
        data={data}
        labels={labels}
        notice={notice}
        onOpen={(id) => {
          setNotice('')
          setScreen({ kind: 'course', id })
        }}
        onCreate={Editor ? () => setScreen({ kind: 'edit', course: newCourse({ title: '' }, now()), isNew: true }) : undefined}
        onImport={
          allowImport
            ? async (json) => {
                if (importFile && json !== null) {
                  let handled: string | null
                  try {
                    handled = await importFile(json)
                  } catch (e) {
                    handled = e instanceof Error && e.message ? e.message : labels.importFailed
                  }
                  if (handled !== null) return setNotice(handled)
                }
                const { courses, errors } = parseCourses(json, now())
                const r = importCourses(data, courses, now())
                change(r.changes)
                const n = r.added.length + r.updated.length
                setNotice([n > 0 ? labels.importDone(n) : labels.importNothing, ...errors].join('\n'))
              }
            : undefined
        }
      />
    )
  }

  return (
    <div className={['sekisho', reducedMotion ? 'sk-reduced' : '', className ?? ''].filter(Boolean).join(' ')} data-theme={theme}>
      {body}
      <Celebration
        events={events}
        onDone={() => setEvents([])}
        rewards={rewards}
        renderStamp={renderStamp}
        reducedMotion={reducedMotion}
        muted={muted}
        labels={labelsPatch}
        theme={theme}
      />
    </div>
  )
}

/** コースを JSON のファイルにして保存させる（配る用） */
function download(course: Course) {
  const blob = new Blob([JSON.stringify(exportCourses([course]), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${course.title.replace(/[\\/:*?"<>|]/g, '_') || 'course'}.sekisho.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ─── コースの一覧 ─────────────────────────────────────

function CourseList({
  data,
  labels,
  notice,
  onOpen,
  onCreate,
  onImport,
}: {
  data: SekishoData
  labels: Labels
  notice: string
  onOpen: (id: string) => void
  onCreate?: () => void
  onImport?: (json: unknown) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const views = data.courses.map((c) => viewCourse(data, c))
  return (
    <div className="sk-list">
      <div className="sk-toolbar">
        <h2 className="sk-h2">{labels.courses}</h2>
        <div className="sk-toolbar__actions">
          {onImport ? (
            <>
              <button type="button" className="sk-btn" onClick={() => fileRef.current?.click()}>
                {labels.importCourses}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  try {
                    onImport(JSON.parse(await file.text()))
                  } catch {
                    onImport(null)
                  }
                }}
              />
            </>
          ) : null}
          {onCreate ? (
            <button type="button" className="sk-btn sk-btn--primary" onClick={onCreate}>
              {labels.createCourse}
            </button>
          ) : null}
        </div>
      </div>
      {notice ? (
        <p className="sk-notice" role="status">
          {notice}
        </p>
      ) : null}
      {views.length === 0 ? <p className="sk-empty">{labels.noCourses}</p> : null}
      <ul className="sk-cards">
        {views.map((v) => (
          <li key={v.course.id}>
            <button type="button" className="sk-card sk-card--button" onClick={() => onOpen(v.course.id)}>
              <span className="sk-card__head">
                <span className="sk-card__title">{v.course.title}</span>
                <span className="sk-tag">{v.course.origin === 'given' ? labels.given : labels.own}</span>
              </span>
              <MiniPassport view={v} />
              <span className="sk-meter" aria-hidden="true">
                <span style={{ width: `${v.total ? (v.cleared / v.total) * 100 : 0}%` }} />
              </span>
              <span className="sk-card__meta">
                {v.lap > 1 ? `${labels.lapNumber(v.lap)} ・ ` : ''}
                {labels.clearedOf(v.cleared, v.total)}
                {v.complete ? ` ・ ${labels.courseCleared}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MiniPassport({ view }: { view: CourseView }) {
  if (view.gates.length === 0) return null
  return (
    <span className="sk-mini-passport" aria-hidden="true">
      {view.gates.map((g, i) => {
        const s = stampOf(g.gate, view.course.color)
        return <Stamp key={g.gate.id} text={s.text} color={s.color} size={26} tilt={((i * 7) % 15) - 7} state={g.cleared ? 'pressed' : 'empty'} />
      })}
    </span>
  )
}

// ─── コースの画面 ─────────────────────────────────────

function CoursePage({
  view,
  labels,
  targets,
  reducedMotion,
  onBack,
  onToggle,
  onPlus,
  onMinus,
  onEdit,
  onDuplicate,
  onExport,
  onNextLap,
  onRestart,
  onDelete,
}: {
  view: CourseView
  labels: Labels
  targets: ResolvedTargets
  reducedMotion: boolean
  onBack: () => void
  onToggle: (itemId: string) => void
  onPlus: (itemId: string) => void
  onMinus: (itemId: string) => void
  onEdit?: () => void
  onDuplicate?: () => void
  onExport?: () => void
  onNextLap: () => void
  onRestart: () => void
  onDelete: () => void
}) {
  const { course } = view
  const hasHistory = view.started || view.laps.length > 0
  return (
    <div className="sk-course">
      <div className="sk-toolbar">
        <button type="button" className="sk-btn sk-btn--ghost" onClick={onBack}>
          ← {labels.back}
        </button>
        <div className="sk-toolbar__actions">
          {onEdit ? (
            <button type="button" className="sk-btn" onClick={onEdit}>
              {labels.editCourse}
            </button>
          ) : null}
          {onDuplicate ? (
            <button type="button" className="sk-btn" onClick={onDuplicate}>
              {labels.duplicateCourse}
            </button>
          ) : null}
          {onExport ? (
            <button type="button" className="sk-btn" onClick={onExport}>
              {labels.exportCourse}
            </button>
          ) : null}
        </div>
      </div>

      <header className="sk-course__head">
        <h2 className="sk-h2">{course.title}</h2>
        {course.description ? <p className="sk-course__desc">{course.description}</p> : null}
        <p className="sk-course__meta">
          <span className="sk-tag">{course.origin === 'given' ? labels.given : labels.own}</span>
          <span className="sk-tag">{(course.route ?? 'free') === 'ordered' ? labels.routeOrdered : labels.routeFree}</span>
          {view.lap > 1 ? <span className="sk-tag sk-tag--lap">{labels.lapNumber(view.lap)}</span> : null}
          <span>{labels.clearedOf(view.cleared, view.total)}</span>
          {view.complete ? <span className="sk-tag sk-tag--done">{labels.courseCleared}</span> : null}
        </p>
      </header>

      {view.gates.length > 0 ? (
        <section className="sk-passport" aria-label={labels.passport}>
          <h3 className="sk-passport__title">{labels.passport}</h3>
          <ol className="sk-passport__grid">
            {view.gates.map((g, i) => {
              const s = stampOf(g.gate, course.color)
              return (
                <li key={g.gate.id} className="sk-passport__cell">
                  <Stamp
                    text={s.text}
                    color={s.color}
                    size={60}
                    tilt={((i * 7) % 15) - 7}
                    state={g.cleared ? 'pressed' : g.open ? 'empty' : 'locked'}
                    label={`${g.gate.title}: ${g.cleared ? labels.cleared : g.open ? `${g.done} / ${g.total}` : labels.locked}`}
                  />
                  <span className="sk-passport__name">{g.gate.title}</span>
                </li>
              )
            })}
          </ol>
        </section>
      ) : null}

      <ol className="sk-gates">
        {view.gates.map((g) => (
          <GateCard
            key={g.gate.id}
            gate={g}
            courseColor={course.color}
            labels={labels}
            targets={targets}
            reducedMotion={reducedMotion}
            onToggle={onToggle}
            onPlus={onPlus}
            onMinus={onMinus}
          />
        ))}
      </ol>

      {view.laps.length > 0 ? (
        <section className="sk-laps" aria-label={labels.laps}>
          <h3 className="sk-laps__title">{labels.laps}</h3>
          <ol className="sk-laps__list">
            {view.laps.map((l, i) => (
              <li key={l.id}>
                <span className="sk-laps__n">{labels.lapNumber(i + 1)}</span>
                <span>{labels.lapDate(l.endedAt)}</span>
                <span>{labels.clearedOf(l.cleared, l.total)}</span>
                {l.complete ? <span className="sk-tag sk-tag--done">{labels.courseCleared}</span> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="sk-danger-zone">
        <div className="sk-lap-actions">
          <button type="button" className="sk-btn" onClick={onNextLap} disabled={!view.started} title={labels.nextLapHint}>
            {labels.nextLap}
          </button>
          <button type="button" className="sk-btn sk-btn--danger" onClick={onRestart} disabled={!hasHistory}>
            {labels.restartCourse}
          </button>
        </div>
        <button type="button" className="sk-btn sk-btn--danger" onClick={onDelete}>
          {labels.deleteCourse}
        </button>
      </div>
    </div>
  )
}

function GateCard({
  gate: g,
  courseColor,
  labels,
  targets,
  onToggle,
  onPlus,
  onMinus,
}: {
  gate: GateView
  courseColor?: string
  labels: Labels
  targets: ResolvedTargets
  reducedMotion: boolean
  onToggle: (itemId: string) => void
  onPlus: (itemId: string) => void
  onMinus: (itemId: string) => void
}) {
  const s = stampOf(g.gate, courseColor)
  return (
    <li className={['sk-card', 'sk-gate', g.open ? '' : 'sk-gate--locked', g.cleared ? 'sk-gate--cleared' : ''].filter(Boolean).join(' ')}>
      <div className="sk-gate__head">
        <Stamp text={s.text} color={s.color} size={40} state={g.cleared ? 'pressed' : g.open ? 'empty' : 'locked'} />
        <div className="sk-gate__titles">
          <h3 className="sk-gate__title">{g.gate.title}</h3>
          {g.gate.description ? <p className="sk-gate__desc">{g.gate.description}</p> : null}
        </div>
        <span className="sk-gate__count">{g.open ? (g.cleared && !g.complete ? labels.cleared : `${g.done} / ${g.total}`) : `🔒 ${labels.locked}`}</span>
      </div>
      {g.items.length === 0 ? <p className="sk-empty">{labels.emptyGate}</p> : null}
      <ul className="sk-items">
        {g.items.map((v) => (
          <ItemRow key={v.item.id} view={v} disabled={!g.open} labels={labels} targets={targets} onToggle={onToggle} onPlus={onPlus} onMinus={onMinus} />
        ))}
      </ul>
    </li>
  )
}

function ItemRow({
  view: v,
  disabled,
  labels,
  targets,
  onToggle,
  onPlus,
  onMinus,
}: {
  view: ItemView
  disabled: boolean
  labels: Labels
  targets: ResolvedTargets
  onToggle: (itemId: string) => void
  onPlus: (itemId: string) => void
  onMinus: (itemId: string) => void
}) {
  const { item } = v
  const target = item.target
  const canOpen = !!target && targets.canOpen(target)
  const badge = target ? targets.renderBadge(target, item) : null
  return (
    <li className={['sk-item', v.complete ? 'sk-item--done' : ''].filter(Boolean).join(' ')}>
      <button
        type="button"
        className="sk-check"
        role="checkbox"
        aria-checked={v.complete}
        aria-label={v.complete ? labels.uncheck(item.title) : labels.check(item.title)}
        disabled={disabled}
        onClick={() => onToggle(item.id)}
      >
        {v.complete ? (
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
            <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </button>
      <span className="sk-item__body">
        {badge !== null && badge !== undefined ? <span className="sk-item__badge">{badge}</span> : null}
        {canOpen ? (
          <button type="button" className="sk-item__title sk-item__title--link" aria-label={labels.open(item.title)} onClick={() => targets.open(target!, item)}>
            {item.title}
          </button>
        ) : (
          <span className="sk-item__title">{item.title}</span>
        )}
        {item.note ? <span className="sk-item__note">{item.note}</span> : null}
      </span>
      {v.goal > 1 ? (
        <span className="sk-counter">
          <button type="button" className="sk-counter__btn" aria-label={labels.minusOne(item.title)} disabled={disabled || v.done === 0} onClick={() => onMinus(item.id)}>
            −
          </button>
          <span className="sk-counter__value" aria-live="polite">
            {v.done} / {v.goal}
          </span>
          <button type="button" className="sk-counter__btn sk-counter__btn--plus" aria-label={labels.plusOne(item.title)} disabled={disabled || v.complete} onClick={() => onPlus(item.id)}>
            ＋
          </button>
        </span>
      ) : null}
    </li>
  )
}
