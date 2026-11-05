// 条文討伐の組み方（画面を使わない部分）。今日の5体・上級の大魔・カードの並びは、日本時間の日付から作る種で決まり、だれでも同じ。
// Math.random は使わない（練習の種は画面の側で1回だけ引く）。並べ替えの比較の中で乱数を引かない（ブラウザで引く回数が変わる）。
(function (root) {
  const D = typeof module !== "undefined" && module.exports ? require("./data.js") : root.TOBATSU;
  function seedOf(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // ずらし混ぜ（Fisher–Yates）。元の配列は変えない
  function shuffle(arr, R) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const N = D.MONSTERS.length;
  const DN = 5; // 1日の魔物の数（2026-11-05 satouさん「一日で遊べる量が少なすぎる」で3体から5体に）
  // 今日の5体：ちがう魔物を5つ。前の日と同じ組なら選び直す（毎日ちがう顔ぶれに）
  function pick3(k) { const R = rng(seedOf(k + ":d")); return shuffle([...Array(N).keys()], R).slice(0, DN); }
  const prevDay = (k) => new Date(Date.parse(k) - 864e5).toISOString().slice(0, 10);
  function dailyMons(k) { const a = pick3(k), b = pick3(prevDay(k)); if (a.slice().sort((x, y) => x - y).join() !== b.slice().sort((x, y) => x - y).join()) return a; const R = rng(seedOf(k + ":d2")); return shuffle([...Array(N).keys()].filter((i) => !b.includes(i)), R).slice(0, DN); }
  // 1体ぶんの戦い：問題の順番（全部の問題をまぜて並べる。HP を削るまで前から使う）
  const battleOf = (m, seed) => ({ m, seed, order: shuffle([...D.MONSTERS[m].qs.keys()], rng(seed)) });
  function dailyPlan(k) { return dailyMons(k).map((m, i) => battleOf(m, seedOf(k + ":d:" + i))); }
  // 上級の大魔：今日の5体と重ならない5体から1問ずつ（まちがいのカードが3枚以上ある問題だけ）
  function hardPlan(k) {
    const today = dailyMons(k), R = rng(seedOf(k + ":h"));
    const mons = shuffle([...Array(N).keys()].filter((i) => !today.includes(i)), R).slice(0, D.BOSS.hp + 2);
    const qs = mons.map((m) => { const ok = [...D.MONSTERS[m].qs.keys()].filter((j) => D.MONSTERS[m].qs[j].x.length >= 3); return [m, ok[Math.floor(R() * ok.length)]]; });
    return [{ m: -1, seed: seedOf(k + ":h:0"), order: qs, art: weekArt(k) }];
  }
  // 練習の1体（種は画面が渡す）。m を決めてあればその魔物
  // v=1 は真の姿（体力4・カード4枚）
  const practicePlan = (seed, m, v) => [Object.assign(battleOf(m, seed), v ? { v: 1 } : {})];
  // 連戦：出会った魔物（pool）を、続けて同じにならないよう並べて60体ぶん
  function endlessPlan(seed, pool) { const R = rng(seed), out = []; while (out.length < 60) { let a = shuffle(pool, R); if (out.length && pool.length > 1 && a[0] === out[out.length - 1]) a = [...a.slice(1), a[0]]; out.push(...a); } return out.slice(0, 60).map((m, i) => battleOf(m, (seed + i * 7919) >>> 0)); }
  // 今週の大魔の技（月曜から日曜まで同じ。週ごとに順に替わる）
  const ARTS = ["regen", "guard", "text"];
  function weekArt(k) { const t = Date.parse(k), dow = (new Date(t).getUTCDay() + 6) % 7, w = Math.floor((t - dow * 864e5 - Date.parse("2026-11-02")) / (7 * 864e5)); return ARTS[((w % 3) + 3) % 3]; }
  // 問題を取り出す。boss の order は [魔物, 問題] の組
  const qOf = (b, p) => (b.m < 0 ? D.MONSTERS[b.order[p][0]].qs[b.order[p][1]] : D.MONSTERS[b.m].qs[b.order[p]]);
  // カード：正しい条文と、まちがい（x）から n-1 枚。並びも種で決める
  function choicesOf(q, seed, n) { const R = rng(seed); const wrong = shuffle(q.x, R).slice(0, n - 1); return shuffle([q.a, ...wrong], R); }
  // 見抜く（ヒント）で消すまちがいのカード：種で1枚
  function hintOf(opts, q, seed) { const w = opts.filter((c) => c !== q.a); return w[Math.floor(rng(seed ^ 0x9e3779b9)() * w.length)]; }
  const out = { seedOf, rng, shuffle, dailyMons, dailyPlan, hardPlan, practicePlan, endlessPlan, weekArt, ARTS, DN, qOf, choicesOf, hintOf, prevDay };
  if (typeof module !== "undefined" && module.exports) module.exports = out; else root.BATTLE = out;
})(this);
