/**
 * @shiodome47/sekisho — 関所めぐりの画面（React）。
 * 見た目は import '@shiodome47/sekisho/style.css'（.sekisho の中だけに効く）。
 * 計算だけなら @shiodome47/sekisho/core、作る画面は @shiodome47/sekisho/editor
 */
export * from '../core/index'
export { Sekisho } from './Sekisho'
export type { CourseEditorProps, SekishoProps } from './Sekisho'
export { Celebration, messageReward } from './Celebration'
export type { CelebrationProps } from './Celebration'
export { Stamp, useReducedMotion } from './Stamp'
export { DEFAULT_STAMP_COLOR, stampOf } from './connectors'
export type { RewardConnector, RewardRenderProps, StampRenderProps, TargetAdapter } from './connectors'
export { EN_LABELS, JA_LABELS } from './labels'
export type { Labels } from './labels'
