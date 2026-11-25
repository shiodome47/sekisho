# @shiodome47/sekisho — 関所めぐり

チェックリストをクリアしていくと、通行手形にスタンプが押される部品です。
いろいろなアプリ（手話学習・英語など）に入れて使います。

- **コース**（関所の集まり）→ **関所**（チェック項目のまとまり。全部済んだらクリア）→ **チェック項目**
- 回り方はコースごとに「どこからでも」か「順番」
- 「10 回くり返す」のような回数のある項目は「3 / 10」と数える
- 自分でチェックするのが基本。アプリが「これをした」と知らせると、自動でも進む
- 関所をクリアするたびに、スタンプとご褒美（コネクタでつなぐ）

> 見本: https://sekisho-rho.vercel.app ・設計は [`docs/design.md`](docs/design.md)

| 入り口 | 中身 | 要るもの |
|---|---|---|
| `@shiodome47/sekisho` | 画面（`<Sekisho>`・`<Celebration>`）と、土台のすべて | React 18・19 |
| `@shiodome47/sekisho/editor` | コースを作る・編集する画面（`<CourseEditor>`） | React と **linkshelf**（関所のカードを並べる `<CardBoard>`） |
| `@shiodome47/sekisho/core` | 画面なしの土台（計算だけ） | なし |
| `@shiodome47/sekisho/style.css` | 見た目（`.sekisho` の中だけに効く） | — |

## 画面（`<Sekisho>`）

コースの一覧 → コース（通行手形・関所・チェック項目）までを、まるごと出します。
関所をクリアすると、通行手形にスタンプが「ポン！」と押され、続けてご褒美が出ます。

```tsx
import { Sekisho, applyChanges } from '@shiodome47/sekisho'
import { CourseEditor } from '@shiodome47/sekisho/editor' // 作る画面が要るときだけ
import '@shiodome47/sekisho/style.css'

<Sekisho
  data={data} // { courses, progress, clears, laps }
  onChange={(changes) => {
    myStorage.save(changes) // 保存はアプリ
    setData((d) => applyChanges(d, changes))
  }}
  targets={targets} // チェック項目の中身（動画・区間など）の窓口
  rewards={[videoReward]} // ご褒美のコネクタ
  editor={CourseEditor} // 渡すと「コースを作る」「編集」が出る
/>
```

| 設定 | 中身 |
|---|---|
| `data` / `onChange` | データと、変わったとき（必須） |
| `targets` | チェック項目の中身の窓口。`open`（押したら開く）・`renderBadge`（▶ などの印）・`pick`（作る画面で「動画・区間から追加」）・`canOpen` |
| `rewards` | ご褒美のコネクタ（下） |
| `renderStamp` | スタンプの演出そのものを差し替える（メダル・花丸など） |
| `editor` | 作る画面。渡さなければ回るだけ |
| `allowImport` / `allowExport` | 「コースを読み込む」「書き出す（配る用）」を出す（既定は出す） |
| `onExport` | 「書き出す（配る用）」を、アプリが受け持つ（0.6.0）。コースが指している動画・区間も、いっしょに配りたいときに |
| `importFile` | 「コースを読み込む」で選んだファイルを、アプリが先に見る（0.6.0）。アプリのファイルなら取り込んで、お知らせの文を返す。コースのファイルなら `null` を返す |
| `reducedMotion` | 演出を減らす。無ければ端末の設定（視差効果を減らす）に従う |
| `muted` | 音を出さない（コネクタに渡す。既定は true） |
| `theme` | `light` / `dark` / `system`（既定） |
| `labels` | 文言の一部を差し替え。英語は `EN_LABELS` |

色は CSS の変数で変えます: `.sekisho { --sk-accent: #2563eb; }`（ほかに `--sk-surface`・`--sk-text`・`--sk-danger`・`--sk-paper` など）。

### コースを配るとき（チェック項目の中身は、アプリのもの）

「書き出す（配る用）」が作るのは、**コースの JSON だけ**です。チェック項目が指している動画・区間（`target`）は、アプリのデータなので入りません。
受け取った人の端末に、その動画・区間が無いと、`canOpen` が false になり、項目は開けません（手でチェックはできます）。

中身もいっしょに配りたいアプリは:

- `onExport` で、コースと中身をまとめた、アプリのファイルを書き出す
- `importFile` で、そのファイルを「コースを読み込む」から取り込めるようにする
- 中身が無い項目は、`renderBadge` で「この端末にありません」の印を出す

`parseCourses` は、`format` がほかの種類のファイル（アプリのバックアップなど）を、コースとして入れません（0.6.0）。

### ご褒美のコネクタ（差込口）

関所（`gate.reward`）とコース（`course.reward`）に、ご褒美を書いておけます。
`type` が同じコネクタを、アプリが `rewards` で渡すと、スタンプのあとに出ます。

```tsx
import type { RewardConnector } from '@shiodome47/sekisho'

// コースの JSON: "reward": { "type": "video", "id": "lesson-123" }
const videoReward: RewardConnector = {
  type: 'video',
  render: ({ reward, done, muted }) => <MyVideo id={String(reward.id)} muted={muted} onEnded={done} />,
}
```

- 部品に入っているもの: `message`（ひみつの一言。`{ "type": "message", "text": "…" }`）。同じ `type` を渡せば差し替わる
- **作る画面で選べるようにする**（0.3.0）: コネクタに `label` と `pick` を足すと、作る画面の関所とコースに「＋ ご褒美の動画を選ぶ」が出る。
  `pick` はアプリの選ぶ画面を出して、ご褒美（`{ id, title, … }`）を返す。見せ方を変えるときは `describe`

```tsx
const videoReward: RewardConnector = {
  type: 'video',
  label: '動画',
  pick: () => openMyVideoPicker(), // → { id: 'lesson-123', title: 'おめでとう' }（やめたら null）
  render: ({ reward, done }) => <MyVideo id={String(reward.id)} onEnded={done} />,
}
```
- 知らない `type` のご褒美は飛ばす（古い版のアプリでも止まらない）
- `done()` を呼ぶと次へ進む。`reducedMotion`・`muted` も届くので、演出を合わせる

### URL のチェック項目・URL の動画のご褒美（0.4.0）

YouTube の URL・Dropbox の共有リンク・動画ファイルの URL などを、**アプリが何もしなくても**使えます。

- チェック項目 `{ "type": "url", "url": "https://…" }`: リンクの印が付き、押すと別のタブで開く
- ご褒美 `{ "type": "video", "url": "https://…", "title": "…" }`: クリアの演出の中で再生する（YouTube は埋め込み、Dropbox の共有リンクは再生用の形に、ほかは動画として）。「別のタブで開く」も出る
- 作る画面: 関所のカードに「URL から追加」、ご褒美の欄に「＋ ご褒美の動画を URL で」
- URL は **http(s) だけ**。読み込むとき（`readCourse`・`parseCourses`）に、ほかの URL の項目の中身・ご褒美は落とす
- 変えたいとき: `targets.openUrl(url, item)`（アプリの中のプレイヤーで見せるなど）、`targets.titleOf(url)`（作る画面で、ページの題名を名前の例に出す）、`allowUrl={false}`（作る画面に URL のボタンを出さない）
- 印は、アプリの `renderBadge` が何か返せばそちらを使う（`null` を返せば部品の印）
- 道具（`/core`）: `safeUrl`・`urlOf`・`urlTarget`・`urlVideoReward`。YouTube・Dropbox の扱いは [`@shiodome47/video-utils`](https://www.npmjs.com/package/@shiodome47/video-utils)

### 自動のチェックの演出（`<Celebration>`）

アプリが `report()` で知らせて関所がクリアになったときは、返ってきた `events` を `<Celebration>` に渡して、練習の画面の上で見せます。

```tsx
const changes = report(data, { target: { type: 'segment', id } }, new Date())
save(changes)
setEvents((q) => [...q, ...(changes.events ?? [])])

<Celebration events={events} onDone={() => setEvents([])} rewards={[videoReward]} />
```

## 土台（`@shiodome47/sekisho/core`）

React にも保存先にも頼らない、計算だけの入り口です。
関数はデータを書き換えず、**変更（`Changes`）を返す**だけ。保存はアプリが行い、`applyChanges` で手元にも当てます。
「今」（`now`）は関数に渡します。

```ts
import { addOne, applyChanges, report, viewCourse, type SekishoData } from '@shiodome47/sekisho/core'

let data: SekishoData = await myStorage.load() // { courses, progress, clears, laps }

// 自分で「＋1」を押した
const changes = addOne(data, courseId, itemId, new Date())
await myStorage.save(changes) // courses / progress / clears を書き、delete… を消す
data = applyChanges(data, changes)
for (const e of changes.events ?? []) showStamp(e) // 新しくクリアした関所・コース

// アプリから「区間を 1 回くり返した」と知らせる（target が同じ項目が、全部のコースで進む）
report(data, { target: { type: 'segment', id: segmentId } }, new Date())

// 画面に出す形（関所ごとの「2 / 3」・開いているか・クリアしたか）
const view = viewCourse(data, data.courses[0])
```

| 種類 | 関数 |
|---|---|
| 進める・戻す | `addOne`（＋1）・`removeOne`（−1）・`checkItem`（済みにする）・`uncheckItem`（外す）・`toggleItem`・`report`（自動のチェック） |
| 周回 | `nextLap`（もう一周する）・`restartCourse`（はじめからやり直す） |
| 見る | `viewCourse`（何周目か・周回の記録も）・`isGateOpen`・`itemGoal`・`currentLap` |
| コースを作る・直す | `newCourse`・`newGate`・`newItem`・`updateCourse`・`addGate`・`updateGate`・`removeGate`・`moveGate`・`addItem`・`updateItem`・`removeItem`・`moveItem`・`duplicateCourse` |
| 配る・受け取る | `exportCourses`（JSON にする）・`parseCourses`（形を確かめて読む。http(s) 以外の URL は落とす）・`importCourses`（新しい版だけ取り込む） |
| URL | `safeUrl`・`urlOf`・`urlTarget`・`urlVideoReward` |
| 保存・同期 | `applyChanges`・`deleteCourse`・`settleClears`・`newerProgress` |

決まりごと:

- チェックは 1 回きり（日付が変わっても外れない）。自分で外せる
- 関所のクリアの記録は消えない。項目を外しても残り、演出は 2 回目は出ない（その周の中では）
- やり直すときは、使う人が選ぶ: **もう一周する**（`nextLap`。今の周を周回の記録 `laps` に残し、空の通行手形で次の周へ）か、**はじめからやり直す**（`restartCourse`。周回の記録も消して 1 周目へ）
- 順番のコースでは、開いていない関所の項目は進まない
- 進み具合はチェック項目の `id` で結びつく。コースが新しい版になっても残る

## 見本のページ

```bash
npm install
npm run dev
```

`examples/web` にあります（公開しているもの: https://sekisho-rho.vercel.app ）。紙吹雪のご褒美（アプリが足すコネクタの見本。作る画面でも選べる）・区間を選ぶ窓口・自動のチェック・周回を試せます。
公開の手順は [`PUBLISHING.md`](PUBLISHING.md)。

## ライセンス

MIT
