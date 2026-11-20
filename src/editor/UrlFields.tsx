import { titleFromUrl } from 'linkshelf'
import { useEffect, useState } from 'react'
import { safeUrl } from '../core/url'
import type { JA_LABELS } from '../ui/labels'

/**
 * URL と名前を入れる欄（作る画面の「＋ URL から足す」「ご褒美の動画を URL で」。0.4.0）。
 * http(s) の URL だけを受け付ける。名前を入れなければ、ページの題名（titleOf があれば）か、URL から作った名前
 */
export function UrlFields({
  labels,
  titleOf,
  initialUrl = '',
  initialName = '',
  onSubmit,
  onCancel,
}: {
  labels: typeof JA_LABELS
  titleOf?: (url: string) => Promise<string | null>
  initialUrl?: string
  initialName?: string
  /** url は http(s) のもの、name は空でない名前 */
  onSubmit: (url: string, name: string) => void
  onCancel: () => void
}) {
  const [url, setUrl] = useState(initialUrl)
  const [name, setName] = useState(initialName)
  const ok = safeUrl(url)
  const [pageTitle, setPageTitle] = useState<{ url: string; title: string } | null>(null)
  useEffect(() => {
    if (!ok || !titleOf) return
    let alive = true
    const t = setTimeout(() => {
      void titleOf(ok)
        .then((title) => alive && title && setPageTitle({ url: ok, title }))
        .catch(() => {})
    }, 500)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [ok, titleOf])
  const example = !ok ? '' : pageTitle?.url === ok ? pageTitle.title : titleFromUrl(ok)
  return (
    <div className="sk-url-fields">
      <input
        className="sk-input"
        aria-label={labels.urlLabel}
        placeholder={labels.urlPlaceholder}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && ok) {
            e.preventDefault()
            onSubmit(ok, name.trim() || example)
          }
        }}
        autoFocus
      />
      <input
        className="sk-input"
        aria-label={labels.urlName}
        placeholder={labels.urlNamePlaceholder(example)}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {url.trim() && !ok ? (
        <p className="sk-url-fields__error" role="alert">
          {labels.urlInvalid}
        </p>
      ) : null}
      <div className="sk-url-fields__actions">
        <button type="button" className="sk-btn sk-btn--primary" disabled={!ok} onClick={() => ok && onSubmit(ok, name.trim() || example)}>
          {labels.useUrl}
        </button>
        <button type="button" className="sk-btn sk-btn--ghost" onClick={onCancel}>
          {labels.cancel}
        </button>
      </div>
    </div>
  )
}
