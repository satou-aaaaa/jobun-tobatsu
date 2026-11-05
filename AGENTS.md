# AGENTS.md

条文討伐：魔物の悪事（事件）に当てはまる条文のカードを選んで斬る、1日5体の法律バトル。`index.html` と `data.js`（条文と魔物・問題）・`battle.js`（組み方）を GitHub Pages で公開する。

## 準備（最初に一度）

```bash
bash scripts/setup.sh   # Node.js（版は .nvmrc）を確かめ、検査の依存とブラウザを入れる。何度実行してもよい
```

## push する前の確認

```bash
node qa/run.mjs                # 問題の形・今日の5体と大魔の組み方（3年分）・通しで遊ぶ・外す/逃げられる・見抜く・おさらい・続きから・古いタブ・あとから・スマホ幅・PWA（CI の QA と同じ）
python3 tools/check-laws.py    # data.js の条文を足した・直したときは必ず。e-Gov の本文・見出しと1字ずつ照らし合わせる
```

## このリポジトリの決まり

- 条文（`data.js` の `LAWS`）は e-Gov 法令検索の本文から写す。`text` は本文の一部をそのまま（「…」で略す）、`cap` は e-Gov の見出し（憲法は見出しが無いので空）。足した・直したら `tools/check-laws.py` を通す。法律相談にしない。
- 問題（`qs`）の `x`（まちがいのカード）には、その事件にはっきり当てはまらない条文だけを置く。紛らわしいが当てはまりうる条文（例：強盗の事件に恐喝）は外す。事件 `s`・一言 `w` は40字以内。1体に5問以上（体力3＋盾3で最大5問使う）。どの条文も、どこかの問題の答えにする（条文帳を全部集められる。QA が見る）。
- 魔物・問題は最後に足すだけにし、並べ替え・途中の削除をしない（番号で今日の5体と問題を作るので、過去の日の問題が変わる）。`battle.js` を変えると過去の日も変わるので、変えた PR に一言書く。
- 今日の5体・上級・カードの並び・見抜くで消すカードは日本時間の日付から作る種（`seedOf`・`rng`）で決まり、だれでも同じ。`Math.random()` は練習とおさらいの種だけ（QA が数を見る）。乱数は `sort` の比較の中で引かない。少し遅れて動く処理は `later()` を使い、画面が替わっていたら何もしない。
- 1体：体力3・盾3。見抜く（まちがいのカードを1枚消す）は1体に1回で★が1つ減る。★はまちがい＋見抜くの回数（0で★3・1で★2・2以上で★1・逃げられたら0）。上級の無法大君は体力5・カード4枚・見抜くなし・今日の5体と重ならない魔物から出す。時間制限は付けない。
- 記録 `tobatsu-v1`：`days`・`hdays`・`pdays`（あとから）・`dex`・`laws`・`xp`・`miss`（おさらい、12まで）・`runs`（モードごとの途中経過 `d`・`h`・`p`・`a:日付`）・`ach`・`kofi`。`load` は足りない入れ物を `fresh()` で補い、知らない入れ物を消さない。保存の前に読み直す。答える・次へ・見抜くは、保存した回の id と問題の番号がこの画面と同じときだけ書き込む（古いタブで二重に数えない）。
- 実績（`ACH`、13個）はいまの記録から毎回数える（新しく残すのは知らせ終えた印 `ach` だけ）。続けるは連続でなく遊んだ日の合計を主にし、連続の日は1以上のときだけ出す（休んだ日を責めない）。順位表は作らない（人と比べる仕組みは学ぶ意欲を下げやすい。docs/design.md）。
- 取りこぼした日（きのう〜7日前・`EPOCH` から）はカレンダーからあとから遊べる（その日の今日の5体と同じ）。連続の日・今日の記録・シェア・Ko-fi には数えない（図鑑・条文帳・実績には入る）。
- 文字は少なめ・一画面一問。お笑いの言葉は入れない（QA が見る）。魔物の名前・絵はオリジナル。ほかの作品の名前・キャラ・用語・見た目は使わない（QA が一部の用語を見る）。
- 共有は遊ぶ人が押したときに開くリンク（X・LINE・Web Share・コピー）だけ。シェアの文は四角（🟩★3・🟨★2・🟧★1・⬛逃げられた）だけで、条文・魔物の名前を出さない。
- 感想は「感想を送る」から GitHub の Issue フォーム（`.github/ISSUE_TEMPLATE/feedback.yml`、ラベル「感想」）を開くだけ。名前・メールは聞かない。週1で shared-workflows `routines/game-feedback.md` が読んで直す。
- 応援は Ko-fi（https://ko-fi.com/satouaaaaa）へのただのリンクだけ。今日の5体・上級を初めて全部★3で終えたときだけ、結果の画面の下に1行（共有フォルダ kofi/app-guide.md）。遊ぶのは無料のまま、有料版は置かない。
- 外へ通信しない。外から読むのは Google Fonts の文字だけ（CSP の `connect-src 'self'` を広げない）。記録は遊ぶ人のブラウザ（localStorage）だけ。
- 押せる所は高さ44px以上（QA が見る）。機能を足す・直すたびに `qa/run.mjs` に検査を足す。乱数で組む部分は何年分も作って確かめる（shared-workflows `incidents/2026-10-31-roppo-empty-village.md`）。
- PWA（`manifest.webmanifest`・`sw.js`・`icon-*.png`）：画面のファイルを足したら `sw.js` の `SHELL` にも足し、中身を大きく変えたら `CACHE` の版を上げる。アイコンと SNS 用の絵 `og.png` は `node tools/make-art.cjs`（今日の魔物を入れない）。
- 公開リポジトリなので、個人情報・鍵を入れない。

## 公開

- GitHub Pages は `main` のルート（`/`）を公開する。PR の QA と Secret scan が ✅ になると `automerge.yml` が自動でマージする。止めたいときは下書きにするか、ラベル「自動マージしない」を付ける。
- `sw.js`・`manifest.webmanifest`・`data.js`（条文）を変える PR は自動ではマージされない（`hold_paths`）。CodeRabbit のレビューを待ち、手でマージする直前に今の head へのレビューを読み直す（shared-workflows `incidents/2026-11-01-roppo-merged-before-review.md`）。CodeRabbit は PR に `@coderabbitai review` とコメントして頼む。

## 共通のきまり

- PR の作り方・マージの仕方は satou-aaaaa/shared-workflows の `routines/pr.md`、全体のきまりは `routines/common.md` に従う。
- CI の部品は shared-workflows の共通部品を呼ぶ。リポジトリ側の .github/workflows には呼び出しと設定値だけを書く。
- Claude 以外の AI・人が作業するときは、shared-workflows の `routines/tool-map.md` と `routines/without-claude.md` を読む。
