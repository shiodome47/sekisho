import { CardBoard, flattenCards, type CardBoardCardState, type CardPlace } from 'linkshelf'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { newGate, newItem } from '../core/course'
import type { CheckItem, Course, Gate, RewardRef } from '../core/types'
import { getDomain } from '@shiodome47/video-utils'
import { urlOf, urlTarget, urlVideoReward } from '../core/url'
import { stampOf, type RewardConnector } from '../ui/connectors'
import { isUrlVideoReward, resolveTargets, type ResolvedTargets } from '../ui/urlParts'
import { UrlFields } from './UrlFields'
import { JA_LABELS } from '../ui/labels'
import type { CourseEditorProps } from '../ui/Sekisho'
import { Stamp } from '../ui/Stamp'

export type { CourseEditorProps }

const MAX_COUNT = 999

/**
 * コースを作る・編集する画面。自分のコースにも、管理者が配るコースにも使う。
 * 関所はカードにして段組みで並べ、ドラッグで動かす（linkshelf の <CardBoard>）。
 * 保存するまでは、手元の下書きだけを変える
 */
export function CourseEditor({ course, onSave, onCancel, targets, rewards = [], allowUrl = true, labels: labelsPatch }: CourseEditorProps) {
  const labels = useMemo(() => ({ ...JA_LABELS, ...labelsPatch }), [labelsPatch])
  // URL の項目にも印を出す（部品が受け持つ）
  const resolved = useMemo(() => resolveTargets(targets, labels), [targets, labels])
  const titleOf = targets?.titleOf
  const [draft, setDraft] = useState<Course>(course)
  const setGates = (fn: (gates: Gate[]) => Gate[]) => setDraft((d) => ({ ...d, gates: fn(d.gates) }))
  const setGate = (gateId: string, fn: (g: Gate) => Gate) => setGates((gs) => gs.map((g) => (g.id === gateId ? fn(g) : g)))

  const cards = draft.gates.map((g, i) => ({ ...g, order: g.board?.order ?? i, column: g.board?.column, size: g.items.length + 4 }))

  const onMove = (places: CardPlace[]) => {
    const byId = new Map(places.map((p) => [p.id, p]))
    const placed = cards.map((c) => {
      const p = byId.get(c.id)
      return p ? { ...c, order: p.order, column: p.column } : c
    })
    // 左上から読む順を、回る順（関所の並び）にする
    const order = flattenCards(placed).map((c) => c.id)
    setGates((gs) =>
      order
        .map((id) => gs.find((g) => g.id === id)!)
        .map((g) => {
          const p = byId.get(g.id)
          return p ? { ...g, board: { order: p.order, ...(p.column !== undefined ? { column: p.column } : {}) } } : g
        }),
    )
  }

  const addGate = () => setGates((gs) => [...gs, newGate({ title: labels.newGateTitle(gs.length + 1) })])

  const save = () => {
    const at = new Date().toISOString()
    onSave({
      ...draft,
      title: draft.title.trim() || labels.untitled,
      description: draft.description?.trim() || undefined,
      gates: draft.gates.map((g) => ({ ...g, title: g.title.trim() || labels.gateTitle, items: g.items.filter((i) => i.title.trim()) })),
      revision: course.revision + 1,
      updatedAt: at,
    })
  }

  // 「…」の上へ・下へ: 並びを入れかえて、段組みの場所は並びどおりに付け直す
  const shiftGate = (gateId: string, by: -1 | 1) =>
    setGates((gs) => {
      const from = gs.findIndex((g) => g.id === gateId)
      const to = from + by
      if (from < 0 || to < 0 || to >= gs.length) return gs
      const next = gs.slice()
      const [x] = next.splice(from, 1)
      next.splice(to, 0, x)
      return next.map((g, i) => ({ ...g, board: { order: i } }))
    })

  const route = draft.route ?? 'free'
  return (
    <div className="sk-editor">
      <div className="sk-toolbar sk-editor__bar">
        <h2 className="sk-h2">{course.title ? labels.editorEdit : labels.editorNew}</h2>
        <div className="sk-toolbar__actions">
          <button type="button" className="sk-btn" onClick={onCancel}>
            {labels.cancel}
          </button>
          <button type="button" className="sk-btn sk-btn--primary" onClick={save}>
            {labels.save}
          </button>
        </div>
      </div>

      <div className="sk-card sk-editor__course">
        <div className="sk-editor__top">
          <label className="sk-field sk-grow">
            <span className="sk-field__label">{labels.courseTitle}</span>
            <input
              className="sk-input"
              value={draft.title}
              placeholder={labels.courseTitlePlaceholder}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              autoFocus={!course.title}
            />
          </label>
          <div className="sk-field">
            <span className="sk-field__label">{labels.route}</span>
            <div className="sk-segmented" role="radiogroup" aria-label={labels.route}>
              {(['free', 'ordered'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={route === r}
                  className={route === r ? 'is-on' : ''}
                  onClick={() => setDraft({ ...draft, route: r })}
                >
                  {r === 'free' ? labels.routeFree : labels.routeOrdered}
                </button>
              ))}
            </div>
          </div>
        </div>
        <label className="sk-field">
          <span className="sk-field__label">
            {labels.courseDescription}
            <span className="sk-optional">{labels.optional}</span>
          </span>
          <textarea className="sk-input" rows={2} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </label>
        <Fold summary={labels.courseReward} set={!!draft.reward} labels={labels}>
          <RewardField
            reward={draft.reward}
            messageLabel={labels.rewardMessage}
            name={labels.courseReward}
            connectors={rewards}
            allowUrl={allowUrl}
            titleOf={titleOf}
            labels={labels}
            onChange={(reward) => setDraft(({ reward: _r, ...d }) => (reward ? { ...d, reward } : (d as Course)))}
          />
        </Fold>
      </div>

      <h3 className="sk-editor__heading">{labels.gatesHeading}</h3>
      <CardBoard
        cards={cards}
        onMove={onMove}
        minColumnWidth={320}
        gap={12}
        addon={
          <button type="button" className="sk-btn sk-add-gate" onClick={addGate}>
            <span aria-hidden="true">＋ </span>
            {labels.addGate}
          </button>
        }
        renderCard={(card, { dragHandle, isDragging }) => {
          const gate = draft.gates.find((g) => g.id === card.id)!
          const index = draft.gates.indexOf(gate)
          return (
            <GateEditor
              gate={gate}
              index={index}
              count={draft.gates.length}
              onShift={(by) => shiftGate(gate.id, by)}
              color={draft.color}
              labels={labels}
              dragHandle={dragHandle}
              isDragging={isDragging}
              canPick={!!targets?.pick}
              onPick={async () => {
                const picked = await targets!.pick!()
                if (picked) setGate(gate.id, (g) => ({ ...g, items: [...g.items, newItem({ title: picked.title, target: picked.target })] }))
              }}
              renderBadge={resolved.renderBadge}
              rewards={rewards}
              allowUrl={allowUrl}
              titleOf={titleOf}
              onChange={(fn) => setGate(gate.id, fn)}
              onRemove={() => {
                if (gate.items.length === 0 || window.confirm(labels.removeGateConfirm(gate.title))) setGates((gs) => gs.filter((g) => g.id !== gate.id))
              }}
            />
          )
        }}
      />
    </div>
  )
}

type L = typeof JA_LABELS

function GateEditor({
  gate,
  index,
  count,
  onShift,
  color,
  labels,
  dragHandle,
  isDragging,
  canPick,
  onPick,
  renderBadge,
  rewards,
  allowUrl,
  titleOf,
  onChange,
  onRemove,
}: {
  gate: Gate
  index: number
  /** 関所の数（「…」の上へ・下へを出すかどうか） */
  count: number
  onShift: (by: -1 | 1) => void
  color?: string
  labels: L
  dragHandle: CardBoardCardState['dragHandle']
  isDragging: boolean
  canPick: boolean
  onPick: () => void
  renderBadge: ResolvedTargets['renderBadge']
  rewards: RewardConnector[]
  allowUrl: boolean
  titleOf?: (url: string) => Promise<string | null>
  onChange: (fn: (g: Gate) => Gate) => void
  onRemove: () => void
}) {
  const [text, setText] = useState('')
  const [addingUrl, setAddingUrl] = useState(false)
  const s = stampOf(gate, color)
  const setItem = (itemId: string, patch: Partial<CheckItem>) =>
    onChange((g) => ({ ...g, items: g.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }))
  const moveItem = (from: number, to: number) =>
    onChange((g) => {
      if (to < 0 || to >= g.items.length) return g
      const items = g.items.slice()
      const [x] = items.splice(from, 1)
      items.splice(to, 0, x)
      return { ...g, items }
    })
  const addText = () => {
    const title = text.trim()
    if (!title) return
    // 「10 回」「×10」「x10」が文にあれば、回数にする
    const m = title.match(/(\d{1,3})\s*(回|times|x)|[×x]\s*(\d{1,3})/i)
    const count = m ? Number(m[1] ?? m[3]) : undefined
    onChange((g) => ({ ...g, items: [...g.items, newItem({ title, count })] }))
    setText('')
  }
  return (
    <section className="sk-card sk-gate-editor" style={{ opacity: isDragging ? 0.5 : 1 }}>
      <div className="sk-gate-editor__head">
        <button type="button" className="sk-handle" aria-label={labels.moveGate(gate.title)} {...dragHandle}>
          ⋮⋮
        </button>
        <Stamp text={s.text} color={s.color} size={44} />
        <span className="sk-gate-editor__number">{labels.gateNumber(index + 1)}</span>
        <Menu label={labels.gateMenu(gate.title)}>
          {(close) => (
            <>
              {index > 0 ? (
                <button type="button" role="menuitem" onClick={() => (close(), onShift(-1))}>
                  {labels.moveGateUp}
                </button>
              ) : null}
              {index < count - 1 ? (
                <button type="button" role="menuitem" onClick={() => (close(), onShift(1))}>
                  {labels.moveGateDown}
                </button>
              ) : null}
              <button type="button" role="menuitem" className="is-danger" onClick={() => (close(), onRemove())}>
                {labels.removeGate}
              </button>
            </>
          )}
        </Menu>
      </div>
      <div className="sk-gate-editor__title">
        <label className="sk-field sk-grow">
          <span className="sk-field__label">{labels.gateTitle}</span>
          <input className="sk-input" value={gate.title} onChange={(e) => onChange((g) => ({ ...g, title: e.target.value }))} />
        </label>
        <label className="sk-field sk-field--narrow">
          <span className="sk-field__label">{labels.stampText}</span>
          <input
            className="sk-input"
            value={gate.stamp?.text ?? ''}
            placeholder={[...gate.title.trim()][0] ?? ''}
            title="1〜2 文字"
            maxLength={4}
            onChange={(e) => onChange((g) => ({ ...g, stamp: { ...g.stamp, text: [...e.target.value].slice(0, 2).join('') } }))}
          />
        </label>
      </div>

      <p className="sk-field__label sk-gate-editor__items-label">{labels.itemsHeading}</p>
      <ul className="sk-edit-items">
        {gate.items.map((item, i) => (
          <li key={item.id} className="sk-edit-item">
            {item.target && renderBadge ? <span className="sk-item__badge">{renderBadge(item.target, item)}</span> : null}
            <input className="sk-input sk-grow" aria-label={labels.itemTitle} value={item.title} onChange={(e) => setItem(item.id, { title: e.target.value })} />
            <span className="sk-edit-item__tools">
            <label className="sk-count-field">
              <input
                className="sk-input"
                type="number"
                min={1}
                max={MAX_COUNT}
                aria-label={labels.itemCount}
                value={item.count ?? 1}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(MAX_COUNT, Math.floor(Number(e.target.value) || 1)))
                  setItem(item.id, { count: n > 1 ? n : undefined })
                }}
              />
              <span>{labels.itemCount}</span>
            </label>
            <span className="sk-edit-item__moves">
              <button type="button" className="sk-icon-btn" aria-label={labels.moveUp(item.title)} disabled={i === 0} onClick={() => moveItem(i, i - 1)}>
                ↑
              </button>
              <button type="button" className="sk-icon-btn" aria-label={labels.moveDown(item.title)} disabled={i === gate.items.length - 1} onClick={() => moveItem(i, i + 1)}>
                ↓
              </button>
              <button
                type="button"
                className="sk-icon-btn sk-icon-btn--danger"
                aria-label={labels.removeItem(item.title)}
                onClick={() => onChange((g) => ({ ...g, items: g.items.filter((x) => x.id !== item.id) }))}
              >
                ×
              </button>
            </span>
            </span>
          </li>
        ))}
      </ul>

      <form
        className="sk-add-item"
        onSubmit={(e) => {
          e.preventDefault()
          addText()
        }}
      >
        <input className="sk-input sk-grow" aria-label={labels.addItemInput} placeholder={labels.addItemPlaceholder} value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="sk-btn sk-btn--accent" disabled={!text.trim()}>
          {labels.addItem}
        </button>
      </form>
      {canPick || allowUrl ? (
        <div className="sk-pickers">
          {canPick ? (
            <button type="button" className="sk-btn sk-btn--ghost sk-pick" onClick={onPick}>
              <span aria-hidden="true">📹 </span>
              {labels.pickTarget}
            </button>
          ) : null}
          {allowUrl && !addingUrl ? (
            <button type="button" className="sk-btn sk-btn--ghost sk-pick" onClick={() => setAddingUrl(true)}>
              <span aria-hidden="true">🔗 </span>
              {labels.addUrl}
            </button>
          ) : null}
        </div>
      ) : null}
      {addingUrl ? (
        <UrlFields
          labels={labels}
          titleOf={titleOf}
          onCancel={() => setAddingUrl(false)}
          onSubmit={(url, name) => {
            onChange((g) => ({ ...g, items: [...g.items, newItem({ title: labels.urlItemTitle(name), target: urlTarget(url) })] }))
            setAddingUrl(false)
          }}
        />
      ) : null}

      <Fold summary={labels.gateReward} set={!!gate.reward} labels={labels}>
        <RewardField
          reward={gate.reward}
          messageLabel={labels.rewardMessage}
          name={labels.gateReward}
          connectors={rewards}
          allowUrl={allowUrl}
          titleOf={titleOf}
          labels={labels}
          onChange={(reward) => onChange(({ reward: _r, ...g }) => (reward ? { ...g, reward } : g))}
        />
      </Fold>
    </section>
  )
}

/** 折りたたむ欄（ご褒美）。もう決めてあるときは、はじめから開いておく */
function Fold({ summary, set, labels, children }: { summary: string; set: boolean; labels: L; children: ReactNode }) {
  const [initiallyOpen] = useState(set)
  return (
    <details className="sk-fold" open={initiallyOpen}>
      <summary>
        <span aria-hidden="true">🎁 </span>
        {summary}
        {set ? <span className="sk-tag sk-fold__set">{labels.rewardSet}</span> : null}
      </summary>
      <div className="sk-fold__body">{children}</div>
    </details>
  )
}

/** 「…」のメニュー。外を押す・Esc で閉じる */
function Menu({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
    }
  }, [open])
  return (
    <span className="sk-menu" ref={ref}>
      <button type="button" className="sk-icon-btn" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true">…</span>
      </button>
      {open ? (
        <span className="sk-menu__list" role="menu">
          {children(() => setOpen(false))}
        </span>
      ) : null}
    </span>
  )
}

/**
 * ご褒美の欄（関所・コース）。
 * ひみつの一言（message）は、ここで文を書く。ほかのご褒美（動画など）は、アプリのコネクタの pick で選ぶ
 */
function RewardField({
  reward,
  messageLabel,
  name,
  connectors,
  allowUrl,
  titleOf,
  labels,
  onChange,
}: {
  reward?: RewardRef
  messageLabel: string
  /** どのご褒美か（読み上げ用。「この関所のご褒美」など） */
  name: string
  connectors: RewardConnector[]
  allowUrl: boolean
  titleOf?: (url: string) => Promise<string | null>
  labels: L
  onChange: (reward: RewardRef | undefined) => void
}) {
  const [urlForm, setUrlForm] = useState<{ url: string; name: string } | null>(null)
  const pickers = connectors.filter((c) => c.pick && c.type !== 'message')
  const choose = async (c: RewardConnector) => {
    const picked = await c.pick!()
    if (picked) onChange({ ...picked, type: c.type })
  }
  if (urlForm) {
    return (
      <UrlFields
        labels={labels}
        titleOf={titleOf}
        initialUrl={urlForm.url}
        initialName={urlForm.name}
        onCancel={() => setUrlForm(null)}
        onSubmit={(url, name) => {
          onChange(urlVideoReward(url, name))
          setUrlForm(null)
        }}
      />
    )
  }
  // URL の動画のご褒美（部品が受け持つ）
  if (reward && isUrlVideoReward(reward)) {
    const url = urlOf(reward)
    const title = typeof reward.title === 'string' && reward.title ? reward.title : url ? getDomain(url) : ''
    return (
      <p className="sk-reward-chip">
        <span className="sk-reward-chip__text">{labels.rewardOther(labels.urlReward(title))}</span>
        <button
          type="button"
          className="sk-btn sk-btn--ghost sk-pick"
          onClick={() => setUrlForm({ url: url ?? '', name: typeof reward.title === 'string' ? reward.title : '' })}
        >
          {labels.repickReward}
        </button>
        <button type="button" className="sk-icon-btn sk-icon-btn--danger" aria-label={labels.removeReward} onClick={() => onChange(undefined)}>
          ×
        </button>
      </p>
    )
  }
  if (reward && reward.type !== 'message') {
    const c = connectors.find((x) => x.type === reward.type)
    const name = c?.label ?? reward.type
    const text = c?.describe?.(reward) ?? (typeof reward.title === 'string' && reward.title ? `${name}「${reward.title}」` : name)
    return (
      <p className="sk-reward-chip">
        <span className="sk-reward-chip__text">{labels.rewardOther(text)}</span>
        {c?.pick ? (
          <button type="button" className="sk-btn sk-btn--ghost sk-pick" onClick={() => void choose(c)}>
            {labels.repickReward}
          </button>
        ) : null}
        <button type="button" className="sk-icon-btn sk-icon-btn--danger" aria-label={labels.removeReward} onClick={() => onChange(undefined)}>
          ×
        </button>
      </p>
    )
  }
  const message = reward?.type === 'message' ? String(reward.text ?? '') : ''
  return (
    <div className="sk-reward-field">
      <label className="sk-field">
        <span className="sk-field__label">
          {messageLabel}
          <span className="sk-optional">{labels.optional}</span>
        </span>
        <textarea
          className="sk-input"
          rows={2}
          aria-label={`${name}: ${messageLabel}`}
          value={message}
          onChange={(e) => onChange(e.target.value ? { type: 'message', text: e.target.value } : undefined)}
        />
      </label>
      {pickers.length > 0 || allowUrl ? (
        <div className="sk-reward-field__pickers">
          {pickers.map((c) => (
            <button key={c.type} type="button" className="sk-btn sk-btn--ghost sk-pick" onClick={() => void choose(c)}>
              ＋ {labels.pickReward(c.label ?? c.type)}
            </button>
          ))}
          {allowUrl ? (
            <button type="button" className="sk-btn sk-btn--ghost sk-pick" onClick={() => setUrlForm({ url: '', name: '' })}>
              ＋ {labels.pickRewardUrl}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
