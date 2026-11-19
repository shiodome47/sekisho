/**
 * 関所めぐりのデータの形（@shiodome47/sekisho の土台）。
 * 日時は ISO 8601 の文字列。
 *
 * コースの「設計」（Course）と、その人の「進み具合」（ItemProgress・Clear）を分けて持つ。
 * こうすると、管理者がコースを新しい版にしても、進み具合は消えない。
 */

/**
 * チェック項目の中身へのつなぎ。部品は中を見ない。アプリが表示と「開く」をする。
 * 例: { type: 'segment', id: '…' }（手話アプリの区間）、{ type: 'lesson', id: '…' }（動画）
 */
export interface TargetRef {
  type: string
  id?: string
  [key: string]: unknown
}

/**
 * ご褒美の指定。type で、どのコネクタが出すかを決める。
 * 例: { type: 'message', text: '…' }（ひみつの一言）、{ type: 'video', id: '…' }（アプリが足す）
 */
export interface RewardRef {
  type: string
  [key: string]: unknown
}

/** チェック項目 */
export interface CheckItem {
  id: string
  /** 表示する文（「あいさつの区間を 10 回」など） */
  title: string
  note?: string
  /** 中身へのつなぎ。無ければ文字だけの項目 */
  target?: TargetRef
  /** くり返す回数（「10 回」）。無ければ 1 回（チェックを入れるだけ） */
  count?: number
}

/** 関所（チェック項目のまとまり。全部済んだらクリア） */
export interface Gate {
  id: string
  title: string
  description?: string
  items: CheckItem[]
  /** スタンプの見た目。無ければ名前の 1 文字目・コースの色 */
  stamp?: { text?: string; color?: string }
  /** この関所のご褒美。無ければスタンプだけ */
  reward?: RewardRef
  /** 点数。今は使わない（あとで足す場所） */
  points?: number
  /** 作る画面（カードのボード）で置いた列と、列の中の順番。回る画面では使わない */
  board?: { column?: number; order: number }
}

/** 回り方。'free' どこからでも（既定）／'ordered' 順番（前の関所をクリアすると次が開く） */
export type Route = 'free' | 'ordered'

/** コース（関所の集まり） */
export interface Course {
  id: string
  title: string
  description?: string
  /** 'given' 与えられた（学ぶ人には読むだけ）／'own' 自分で作った */
  origin: 'given' | 'own'
  /** 回り方。無ければ 'free' */
  route?: Route
  gates: Gate[]
  /** スタンプの色（#rrggbb）。関所の stamp.color が優先 */
  color?: string
  /** コースを全部クリアしたときのご褒美 */
  reward?: RewardRef
  /** 設計の版。管理者が直して配り直すと上がる */
  revision: number
  createdAt: string
  updatedAt: string
}

/** 進み具合（1 人・1 チェック項目につき 1 件） */
export interface ItemProgress {
  /** `${courseId}|${itemId}`（progressId） */
  id: string
  courseId: string
  itemId: string
  /** 今の回数（0 から、その項目の回数まで） */
  done: number
  /** 済んだ日時（回数に届いたとき）。外すと消える */
  checkedAt?: string
  updatedAt: string
}

/**
 * クリアの記録。gateId があれば関所のクリア、無ければコースを全部クリア。
 * 一度付いたら消さない（項目を外しても残る。演出は 2 回目は出さない）
 */
export interface Clear {
  /** `${courseId}|${gateId}`、コースは `${courseId}|*`（clearId） */
  id: string
  courseId: string
  gateId?: string
  clearedAt: string
}

/** 部品が扱うデータ全部。アプリは、これを保存先から読んで渡す */
export interface SekishoData {
  courses: Course[]
  progress: ItemProgress[]
  clears: Clear[]
}

/** クリアの知らせ（画面がスタンプとご褒美を出すのに使う） */
export interface ClearEvent {
  kind: 'gate' | 'course'
  course: Course
  /** kind === 'gate' のとき */
  gate?: Gate
  /** クリアした関所の数（この知らせのぶんを入れて） */
  cleared: number
  /** 関所の数 */
  total: number
  at: string
}

/**
 * 変更（保存するもの）。関数はデータを直接は変えずに、これを返す。
 * アプリは、これを保存先に書き、applyChanges で手元のデータにも当てる（planner と同じやり方）
 */
export interface Changes {
  courses?: Course[]
  progress?: ItemProgress[]
  clears?: Clear[]
  deleteCourseIds?: string[]
  deleteProgressIds?: string[]
  deleteClearIds?: string[]
  /** 新しくクリアしたもの（保存はしない。画面が演出に使う） */
  events?: ClearEvent[]
}

/** アプリが知らせる「これをした」（自動のチェック）。target はチェック項目の target と同じ形 */
export interface Activity {
  target: TargetRef
  /** 何回分か。無ければ 1 */
  amount?: number
}
