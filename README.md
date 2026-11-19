# @shiodome47/sekisho — 関所めぐり

チェックリストをクリアしていくと、通行手形にスタンプが押される部品です。
いろいろなアプリ（手話学習・英語など）に入れて使います。

- **コース**（関所の集まり）→ **関所**（チェック項目のまとまり。全部済んだらクリア）→ **チェック項目**
- 回り方はコースごとに「どこからでも」か「順番」
- 「10 回くり返す」のような回数のある項目は「3 / 10」と数える
- 自分でチェックするのが基本。アプリが「これをした」と知らせると、自動でも進む
- 関所をクリアするたびに、スタンプとご褒美（コネクタでつなぐ）

> 状態: **作っているところ**。いま使えるのは画面なしの土台（`@shiodome47/sekisho/core`）だけです。
> 設計は [`docs/design.md`](docs/design.md)。

## 土台（`@shiodome47/sekisho/core`）

React にも保存先にも頼らない、計算だけの入り口です。
関数はデータを書き換えず、**変更（`Changes`）を返す**だけ。保存はアプリが行い、`applyChanges` で手元にも当てます。
「今」（`now`）は関数に渡します。

```ts
import { addOne, applyChanges, report, viewCourse, type SekishoData } from '@shiodome47/sekisho/core'

let data: SekishoData = await myStorage.load() // { courses, progress, clears }

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
| 見る | `viewCourse`・`isGateOpen`・`itemGoal` |
| コースを作る・直す | `newCourse`・`newGate`・`newItem`・`updateCourse`・`addGate`・`updateGate`・`removeGate`・`moveGate`・`addItem`・`updateItem`・`removeItem`・`moveItem`・`duplicateCourse` |
| 配る・受け取る | `exportCourses`（JSON にする）・`parseCourses`（形を確かめて読む）・`importCourses`（新しい版だけ取り込む） |
| 保存・同期 | `applyChanges`・`deleteCourse`・`settleClears`・`newerProgress` |

決まりごと:

- チェックは 1 回きり（日付が変わっても外れない）。自分で外せる
- 関所のクリアの記録は消えない。項目を外しても残り、演出は 2 回目は出ない
- 順番のコースでは、開いていない関所の項目は進まない
- 進み具合はチェック項目の `id` で結びつく。コースが新しい版になっても残る

## ライセンス

MIT
