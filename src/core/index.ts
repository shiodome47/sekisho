/**
 * @shiodome47/sekisho/core — 関所めぐりの土台（画面なし・計算だけ）。
 * React にも、保存先にも頼らない。保存はアプリがする。
 */
export type {
  Activity,
  Changes,
  CheckItem,
  Clear,
  ClearEvent,
  Course,
  Gate,
  ItemProgress,
  RewardRef,
  Route,
  SekishoData,
  TargetRef,
} from './types'

export {
  addOne,
  applyChanges,
  checkItem,
  clearId,
  deleteCourse,
  isGateOpen,
  itemGoal,
  newerProgress,
  progressId,
  removeOne,
  report,
  sameTarget,
  settleClears,
  toggleItem,
  uncheckItem,
  viewCourse,
} from './progress'
export type { CourseView, GateView, ItemView } from './progress'

export {
  addGate,
  addItem,
  duplicateCourse,
  moveGate,
  moveItem,
  newCourse,
  newGate,
  newItem,
  removeGate,
  removeItem,
  updateCourse,
  updateGate,
  updateItem,
} from './course'

export { exportCourses, importCourses, parseCourses, readCourse } from './io'
export type { ImportResult, SekishoFile } from './io'
