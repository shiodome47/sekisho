import { useEffect, useState } from 'react'

/**
 * 丸い印（スタンプ）。押した印・まだの印（点線の丸）・鍵のかかった印。
 * 色は朱肉のように、少しかすれた二重の丸で描く
 */
export function Stamp({
  text,
  color,
  state = 'pressed',
  size = 56,
  tilt = -8,
  label,
}: {
  text: string
  color: string
  state?: 'pressed' | 'empty' | 'locked'
  size?: number
  /** 傾き（度）。押した印だけ */
  tilt?: number
  /** 読み上げ用の名前 */
  label?: string
}) {
  const chars = [...text].slice(0, 2)
  if (state !== 'pressed') {
    return (
      <span className="sk-stamp sk-stamp--empty" style={{ width: size, height: size }} role="img" aria-label={label}>
        <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="7 7" />
          {state === 'locked' ? (
            <g fill="currentColor">
              <rect x="36" y="48" width="28" height="22" rx="3" />
              <path d="M41 48v-7a9 9 0 0 1 18 0v7" fill="none" stroke="currentColor" strokeWidth="5" />
            </g>
          ) : null}
        </svg>
      </span>
    )
  }
  const vertical = chars.length === 2
  return (
    <span className="sk-stamp" style={{ width: size, height: size, transform: `rotate(${tilt}deg)` }} role="img" aria-label={label}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <defs>
          {/* 朱肉のかすれ */}
          <filter id="sk-ink" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="3" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.25" result="mask" />
            <feComposite in="SourceGraphic" in2="mask" operator="in" />
          </filter>
        </defs>
        <g filter="url(#sk-ink)" fill="none" stroke={color}>
          <circle cx="50" cy="50" r="45" strokeWidth="6" />
          <circle cx="50" cy="50" r="37" strokeWidth="2" />
          <text
            x="50"
            y={vertical ? 47 : 52}
            fill={color}
            stroke="none"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={vertical ? 30 : 44}
            fontWeight="700"
            fontFamily="'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif"
          >
            {vertical ? (
              <>
                <tspan x="50" dy="-12">
                  {chars[0]}
                </tspan>
                <tspan x="50" dy="30">
                  {chars[1]}
                </tspan>
              </>
            ) : (
              chars[0]
            )}
          </text>
        </g>
      </svg>
    </span>
  )
}

/** 端末の「視差効果を減らす」（prefers-reduced-motion）に合わせる。force を渡せば、それに従う */
export function useReducedMotion(force?: boolean): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const read = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches
  const [os, setOs] = useState(read)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const m = window.matchMedia(query)
    const on = () => setOs(m.matches)
    m.addEventListener?.('change', on)
    return () => m.removeEventListener?.('change', on)
  }, [])
  return force ?? os
}
