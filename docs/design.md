# 条文討伐の作りの考え方

2026-11-05。遊びの形を決める前に、似たゲームと、ゲーミフィケーション・学び方の研究を読んだ。研究の知見と、このゲームで何をどう決めたかを並べる。

## 研究から取り入れたこと

| 研究の知見 | このゲームでの形 |
|---|---|
| 学ぶ中身そのものを遊びの中心の操作にすると、楽しさも身につき方も上がる（intrinsic integration。Habgood & Ainsworth 2011） | 攻撃＝「この事件に当てはまる条文を選ぶ」こと。クイズを戦いの外に置かない |
| ゲーミフィケーションは学びに小〜中くらいの良い効果がある。物語（game fiction）があると効果が強まりやすい（Sailer & Homner 2020、メタ分析） | 魔物ごとに分野と一言の言い伝え（lore）。魔物図鑑で物語を集める |
| 効果は使う人・場面によって大きく変わる。仕組みを足せば必ず効くわけではない（Hamari, Koivisto & Sarsa 2014、文献レビュー） | 仕組みは増やしすぎない。1日5体・3分で終わる形に絞る |
| バッジや順位表を中心にすると、時間とともにやる気・成績が下がることがある（Hanus & Fox 2015） | 順位表を作らない。実績は腕前・集める・続けるの目安として「いま/目標」を見せるだけ。連続が途切れても責めない（遊んだ日の合計を主に） |
| 有能感・自律性・関係性が満たされると、ゲームは楽しく続けたくなる（自己決定理論。Ryan, Rigby & Przybylski 2006） | 有能感：すぐ分かる手ごたえ（斬・体力・★）と、ほどよい難しさ。自律性：練習で戦う魔物を選べる。関係性：同じ日はだれでも同じ3体、結果を四角でシェア |
| 読み返すより、思い出して答えるほうが覚える（テスト効果。Roediger & Karpicke 2006） | 毎回、自分でカードを選ぶ（答えを先に見せない） |
| 間違えたあとに正しい答えと理由を示すと、覚え直しが進む（説明つきのフィードバック。Shute 2008） | 当てても外しても、条文の本文と一言の理由を出す |
| 似たものを混ぜて練習すると、見分ける力が育つ（交互練習。Rohrer & Taylor 2007、Brunmair & Richter 2019） | 1体のカードは同じ分野のまぎらわしい条文（窃盗・詐欺・横領・恐喝…）。上級は分野をまぜる |
| 間をあけて解き直すと長く覚えている（分散学習。Cepeda ほか 2006） | 外した問題を「おさらい」に残し、後で解き直す。毎日ちがう5体 |
| 挑戦がうまさに合うと没頭しやすい（フロー。Csikszentmihalyi） | 体力3・盾3（2回まで外してよい）・見抜く1回。上級は体力5・カード4枚・ヒントなし |
| 思い出す向きを変える（答え→手がかり）練習も、テスト効果が出る（Roediger & Karpicke 2006） | 条文帳の「思い出す」：条文の文を見て名前を当てる。久しく出していない条文から（分散学習） |
| ブラウザは、人が押す前に音を鳴らすことを止める（MDN「Autoplay guide for media and Web Audio APIs」） | 効果音は押したときだけ Web Audio で作って鳴らす。切り替えられる |

2026-11-05 の追加（satouさんの声から）：1日5体と「連戦」（遊べる量が少ない）、練習は出会った魔物だけ（図鑑の楽しみを先に見せない）、魔物24体（種類を増やす）、真の姿・今週の大魔の技（同じ遊びに変化をつけ、有能感の次の目標を置く）。

似たアプリ：行政書士試験向けの「法令択一クエスト」（RPG 風の四択問題集）。こちらは条文を当てること自体を攻撃にし、魔物ごとの分野・図鑑・条文帳で差をつける。

satouさんの好み（文字少なめ・一画面一問・時間制限なし・お笑いを入れない・見た目リッチ・やりこみ）も合わせて決めた。

## 出典

- Habgood, M. P. J. & Ainsworth, S. (2011). Motivating children to learn effectively: Exploring the value of intrinsic integration in educational games. Journal of the Learning Sciences. 博士論文 https://eprints.nottingham.ac.uk/10385/
- Sailer, M. & Homner, L. (2020). The Gamification of Learning: a Meta-analysis. Educational Psychology Review. https://opus.bibliothek.uni-augsburg.de/opus4/frontdoor/index/index/docId/109056
- Hamari, J., Koivisto, J. & Sarsa, H. (2014). Does Gamification Work? A Literature Review of Empirical Studies on Gamification. HICSS. https://research.aalto.fi/fi/publications/does-gamification-work-a-literature-review-of-empirical-studies-o/
- Hanus, M. D. & Fox, J. (2015). Assessing the effects of gamification in the classroom: A longitudinal study on intrinsic motivation, social comparison, satisfaction, effort, and academic performance. Computers & Education.
- Ryan, R. M., Rigby, C. S. & Przybylski, A. (2006). The motivational pull of video games: A self-determination theory approach. Motivation and Emotion. https://link.springer.com/content/pdf/10.1007%2Fs11031-006-9051-8.pdf
- Roediger, H. L. & Karpicke, J. D. (2006). Test-enhanced learning. Psychological Science.
- Shute, V. J. (2008). Focus on formative feedback. Review of Educational Research.
- Rohrer, D. & Taylor, K. (2007). The shuffling of mathematics problems improves learning. Instructional Science. / Brunmair, M. & Richter, T. (2019). Similarity matters: A meta-analysis of interleaved learning. Psychological Bulletin.
- Cepeda, N. J. ほか (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. Psychological Bulletin.
- MDN Web Docs: Autoplay guide for media and Web Audio APIs. https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
- 条文：e-Gov 法令検索 https://laws.e-gov.go.jp/ （2026-11-05 時点。tools/check-laws.py で本文と照らし合わせる）
