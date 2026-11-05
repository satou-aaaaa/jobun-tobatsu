// 条文討伐の検査。データ（条文と問題の形）・今日の3体と大魔の組み方（3年分）・通しで遊ぶ・外す/逃げられる・見抜く・続きから・古いタブ・上級・あとから・図鑑・条文帳・実績・スマホ幅・PWA を確かめる。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
// 条文の本文が e-Gov と同じかは、ネットが要るので別に python3 tools/check-laws.py で見る。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = pathToFileURL(path.join(root, "index.html")).href;
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail) });
const req = createRequire(import.meta.url);
const D = req(path.join(root, "data.js")), G = req(path.join(root, "battle.js"));
const L = D.LAWS, M = D.MONSTERS, len = (t) => [...t].length;

// 1. データの形（ブラウザを使わない）
{
  const bad = [];
  for (const m of M) {
    if (m.qs.length < 5) bad.push(`${m.id}: 問題が5つ未満（体力3＋盾3で最大5問使う）`);
    m.qs.forEach((q, i) => {
      for (const id of [q.a, ...q.x]) if (!L[id]) bad.push(`${m.id}#${i} 条文が無い ${id}`);
      if (q.x.includes(q.a)) bad.push(`${m.id}#${i} 正しい条文がまちがいにも入っている`);
      if (new Set(q.x).size !== q.x.length) bad.push(`${m.id}#${i} まちがいが重なる`);
      if (q.x.length < 2) bad.push(`${m.id}#${i} まちがいが2枚未満`);
      if (len(q.s) > 40) bad.push(`${m.id}#${i} 事件が40字超え`);
      if (len(q.w) > 40) bad.push(`${m.id}#${i} 一言が40字超え`);
    });
  }
  const noAsk = M.filter((m) => !m.ask || len(m.ask) > 14 || !/？$/.test(m.ask)).map((m) => m.id);
  check("魔物ごとに問いかけ（何を答えるか。14字以内・「？」で終わる）がある（2026-11-05 satouさん「問題文が少しわかりずらい」）", noAsk.length === 0, noAsk.join(","));
  const vague = M.flatMap((m) => m.qs.map((q) => q.s)).filter((t) => !/^[^、。]{1,14}?[がは]/.test(t) && !/？$/.test(t));
  check("事件の文は「だれが（は）」で始まるか、問いの形（だれが何をしたかが一読でわかる）", vague.length === 0, vague.slice(0, 3).join(" / "));
  check("問題の形：条文がある・正しい条文はまちがいに入らない・まちがい2枚以上・文は40字以内・1体5問以上", bad.length === 0, bad.slice(0, 4).join(" / "));
  const ans = new Set(M.flatMap((m) => m.qs.map((q) => q.a)));
  const never = Object.keys(L).filter((k) => !ans.has(k));
  check("どの条文も、どこかの問題の答えになる（条文帳を全部集められる）", never.length === 0, never.join(","));
  const lawBad = Object.entries(L).filter(([, x]) => !x.law || !/^\d+条(の\d+)?$/.test(x.no) || !x.name || !x.text || len(x.name) > 14);
  check("条文：法律名・条番号・呼び名（14字以内）・本文の一部がある", lawBad.length === 0, lawBad.map((x) => x[0]).join(","));
  const allS = M.flatMap((m) => m.qs.map((q) => q.s));
  check("同じ事件の文が2つない（画面の文から問題を1つに決められる）", new Set(allS).size === allS.length);
  check("どの魔物にも、上級で使えるまちがい3枚以上の問題がある", M.every((m) => m.qs.some((q) => q.x.length >= 3)));
}

// 2. 今日の3体・大魔の組み方（3年分）
{
  const bad = [], seen = new Set(), seenQ = new Set();
  let d = "2026-11-05", prev = null;
  for (let i = 0; i < 365 * 3; i++) {
    const p = G.dailyPlan(d), h = G.hardPlan(d), ms = p.map((b) => b.m);
    if (new Set(ms).size !== 3) bad.push(`${d} 3体が重なる`);
    if (prev && [...ms].sort().join() === [...prev].sort().join()) bad.push(`${d} 前の日と同じ3体`);
    if (JSON.stringify(p) !== JSON.stringify(G.dailyPlan(d)) || JSON.stringify(h) !== JSON.stringify(G.hardPlan(d))) bad.push(`${d} 同じ日で組み方が変わる`);
    p.forEach((b) => { if (b.order.length !== M[b.m].qs.length || new Set(b.order).size !== b.order.length) bad.push(`${d} 問題の順番がおかしい`); seen.add(b.m); });
    const hm = h[0].order.map((x) => x[0]);
    if (h[0].order.length < D.BOSS.hp + 2 || new Set(hm).size !== hm.length || hm.some((m) => ms.includes(m))) bad.push(`${d} 大魔の問題が足りない・重なる・今日の3体と重なる`);
    if (h[0].order.some(([m, q]) => !M[m].qs[q] || M[m].qs[q].x.length < 3)) bad.push(`${d} 大魔にまちがい3枚未満の問題`);
    for (const b of [...p, ...h]) for (let k = 0; k < b.order.length; k++) {
      const q = G.qOf(b, k), cs = G.cardsOf(q, (b.seed + k * 7919) >>> 0, b.m === -1 ? 4 : 3);
      if (cs.length !== (b.m === -1 ? 4 : 3) || new Set(cs).size !== cs.length || !cs.includes(q.a) || cs.some((c) => c !== q.a && !q.x.includes(c))) bad.push(`${d} カードがおかしい`);
      const g = G.hintOf(cs, q, b.seed + k); if (g === q.a || !cs.includes(g)) bad.push(`${d} 見抜くで正しいカードが消える`);
      seenQ.add(b.m < 0 ? b.order[k].join(":") : b.m + ":" + b.order[k]);
    }
    prev = ms; d = new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10);
  }
  check("今日の3体：毎日ちがう3体・前の日と同じ組にならない・同じ日はいつも同じ（3年分）", bad.filter((x) => /3体|同じ/.test(x)).length === 0, bad.slice(0, 3).join(","));
  check("大魔：今日の3体と重ならない別々の魔物から7問・まちがい3枚以上（3年分）", bad.filter((x) => /大魔/.test(x)).length === 0, bad.filter((x) => /大魔/.test(x)).slice(0, 3).join(","));
  check("カード：正しい条文を入れてちがう3枚（上級4枚）・見抜くは正しいカードを消さない", bad.filter((x) => /カード|見抜く|順番/.test(x)).length === 0, bad.filter((x) => /カード|見抜く|順番/.test(x)).slice(0, 3).join(","));
  const total = M.reduce((t, m) => t + m.qs.length, 0);
  check("3年のうちに全部の魔物・全部の問題が出る", seen.size === M.length && seenQ.size === total, `${seen.size}/${M.length} ${seenQ.size}/${total}`);
  // 片寄り：1年でどの魔物も今日の3体に出る回数が平均の半分〜2倍
  const cnt = new Array(M.length).fill(0); let k = "2026-11-05"; for (let i = 0; i < 365; i++) { G.dailyMons(k).forEach((m) => cnt[m]++); k = new Date(Date.parse(k) + 864e5).toISOString().slice(0, 10); }
  const avg = (365 * 3) / M.length;
  check("1年で、どの魔物も出る回数が平均の半分〜2倍（片寄らない）", cnt.every((c) => c > avg / 2 && c < avg * 2), cnt.join(","));
}

const html = readFileSync(path.join(root, "index.html"), "utf8"), bjs = readFileSync(path.join(root, "battle.js"), "utf8");
const code = (t) => t.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
check("Math.random は練習の種だけ（今日の3体・上級・カードは日付の種）", (code(html).match(/Math\.random/g) || []).length === 2 && !/Math\.random/.test(code(bjs)) && /review[^\n]*Math\.random[^\n]*\n[^\n]*practicePlan\(Math\.floor\(Math\.random/.test(html));
{ const src = html + bjs; const bad = src.match(/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/g) || [];
  check("並べ替えの比較の中で乱数を引いていない（同じ日に人によって問題が変わらない）", bad.length === 0, bad.join(" | ")); }
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$|^https:\/\/laws\.e-gov\.go\.jp\/$|^https:\/\/x\.com\/intent\/post\?|^https:\/\/social-plugins\.line\.me\/lineit\/share\?/.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない", ext.length === 0, ext.join(","));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ボケ|ツッコミ|なんでやねん|（うそ）/.test(html + JSON.stringify(D)));
check("ほかの作品の用語を使わない", !/魔法律|ムヒョ|ロージー|ガッシュ|魔界語|グレイ|ポケモン|ドラクエ/.test(html + JSON.stringify(D)));
check("法律相談ではないことと、条文の出どころ（e-Gov）を遊び方に書いている", /法律相談ではありません/.test(html) && /e-Gov/.test(html));
{ const bad = html.split("\n").map((l) => (l.match(/(?:^|\s)\/\/(?!\S*\.)(.*)$/) || [])[1]).filter((c) => c && /(;|\{|\}\)?|=>\s*\S+\))\s*$/.test(c.trim()));
  check("一行の式の途中にコメント // を足さない（コメントのあとにコードが残っていない。rosen-hitofude 2026-11-04）", bad.length === 0, bad.slice(0, 2).join(" | ")); }
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readFileSync(path.join(root, "README.md"), "utf8").replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/jobun-tobatsu/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームの name が3字以上（2字だと GitHub がフォームを出さない。shared-workflows incidents/2026-11-05-feedback-form-not-shown.md）", len(((fy.match(/^name:\s*(.+)$/m) || [])[1] || "").trim()) >= 3 && /^description:\s*\S/m.test(fy));
  check("感想フォームは名前・メールを聞かない（楽しさ・よかった所・直してほしい所だけ）", /id: fun/.test(fy) && /id: good/.test(fy) && /id: fix/.test(fy) && !/id: (name|email|mail)/.test(fy) && /labels: \["感想"\]/.test(fy)); }
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1]);
  const need = ["./index.html", "./data.js", "./battle.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
  check("PWA：sw.js は画面のファイルを全部保存し、外へ何も送らない", need.every((f) => shell.includes(f)) && !/https?:\/\//.test(sw.replace(/^\/\/.*$/gm, "")));
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "条文討伐" && mf.icons.length >= 2 && mf.start_url === "./");
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => "./" + m[1]);
  check("PWA：画面が読むスクリプトは全部 SHELL に入っている", scripts.every((f) => shell.includes(f)), scripts.join(",")); }

// ---- ブラウザで遊ぶ ----
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const isNoise = (t) => /fonts\.(googleapis|gstatic)\.com|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|net::ERR_/.test(t);
const errors = [];
const DAY0 = "2026-11-05T03:00:00Z";
async function newCtx(time = DAY0) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const open = async () => { const p = await ctx.newPage(); await p.clock.install({ time: new Date(time) }); p.on("pageerror", (e) => errors.push(e.stack)); p.on("console", (m) => { if (m.type() === "error" && !isNoise(m.text())) errors.push(m.text()); }); await p.goto(url); return p; };
  return { ctx, open };
}
const st = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("tobatsu-v1") || "null"));
const qByDeed = (t) => { for (const m of M) for (const q of m.qs) if (q.s === t) return q; return null; };
async function deed(p) { return (await p.textContent("#deed")).trim(); }
// 1問答える。ok=true で正しいカード、false でまちがいのカード
async function answer(p, ok) { const q = qByDeed(await deed(p)); const ids = await p.$$eval(".card:not(:disabled)", (es) => es.map((e) => e.dataset.id)); const id = ok ? q.a : ids.find((x) => x !== q.a); await p.click(`.card[data-id="${id}"]`); await p.waitForSelector("#next"); return { q, id }; }
async function nextBtn(p) { await p.click("#next"); }
// 1体を全部正しく倒す（討伐の画面まで）
async function beat(p) { for (let i = 0; i < 8; i++) { await answer(p, true); await nextBtn(p); if (await p.$(".win")) return true; } return false; }
async function noOverflow(p) { return p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); }
async function smallTaps(p) { return p.$$eval("button, a, summary", (es) => es.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5 && getComputedStyle(e).visibility !== "hidden"; }).map((e) => e.textContent.trim().slice(0, 12))); }

// A. 初めて開く → 今日の3体を全部★3で → 結果・記録・図鑑・条文帳・Ko-fi・シェア
{
  const { ctx, open } = await newCtx();
  const p = await open();
  check("初めて開くと遊び方が出る", await p.isVisible("#howto"));
  await p.click("#howto-ok");
  check("ホーム：今日の3体の影が出て、名前はまだ伏せる", (await p.$$(".trio.shade svg")).length === 3 && (await p.textContent(".trio")).includes("？？？"));
  check("ホーム：押せる所は高さ44px以上", (await smallTaps(p)).length === 0, (await smallTaps(p)).join(","));
  await p.click("#go-d");
  check("戦い：魔物・体力3・事件・カード3枚・盾3・見抜く", (await p.$$(".hpbar i")).length === 3 && (await p.$$(".card")).length === 3 && (await p.$$(".shield span")).length === 3 && !!(await p.$("#hint")));
  check("戦い：押せる所は高さ44px以上", (await smallTaps(p)).length === 0, (await smallTaps(p)).join(","));
  const plan = G.dailyPlan("2026-11-05");
  check("戦い：最初の事件は今日の1体目の、日付で決まる1問目", (await deed(p)) === M[plan[0].m].qs[plan[0].order[0]].s);
  check("戦い：魔物ごとの問いかけを出す", (await p.textContent(".ask")).includes(M[plan[0].m].ask));
  check("戦い：最初は傷の無い魔物が現れる", (await p.getAttribute("#mon svg", "data-dmg")) === "0.00" && (await p.$$("#mon .crack")).length === 0);
  const r1 = await answer(p, true);
  check("当てると「命中」と、その条文の本文・一言が出る", (await p.textContent("#law")).includes("命中") && (await p.textContent("#law")).includes(L[r1.q.a].text.split("…")[0]) && (await p.textContent("#law")).includes(r1.q.w));
  check("当てると魔物の体力が1減り、ひびが入る（斬るたびにボロボロに。2026-11-05 satouさん）", (await p.$$(".hpbar i.off")).length === 1 && (await p.getAttribute("#mon svg", "data-dmg")) === "0.33" && (await p.$$("#mon .crack")).length === 2);
  { const want = { 刑法: "kei", 民法: "min", 憲法: "ken", 労働基準法: "rou", 特定商取引法: "sho", 消費者契約法: "sho" }[L[r1.q.a].law];
    check("攻撃の技は条文の法律で変わる（刑法＝刃・民法＝鎖・憲法＝光・労基＝鐘・消費者＝札）", await p.$eval("#mon", (e, w) => e.classList.contains("fx-" + w), want)); }
  await nextBtn(p);
  let won = true; for (let i = 0; i < 2; i++) { await answer(p, true); await nextBtn(p); }
  won = !!(await p.$(".win")) && (await p.textContent(".win .big")).includes("討伐");
  check("討伐の画面：×の目でボロボロの魔物が消え、条文帳に新しく載った条文を出す", (await p.getAttribute("#mon svg", "data-dmg")) === "1.00" && (await p.$$("#mon .crack")).length === 6 && (await p.textContent(".newlaw")).includes("条文帳に新しく"));
  check("3回当てると「討伐！」と★3", won && (await p.$$(".win .stars")).length === 1 && !(await p.textContent(".win .stars .off")));
  await p.click("#go");
  check("討伐のあと2体目へ（点が進む）", (await p.$$(".dots i.done")).length === 1);
  await beat(p); await p.click("#go");
  await beat(p);
  check("3体目も討伐の画面を見てから結果へ", !!(await p.$(".win")));
  await p.click("#go");
  const s = await st(p);
  check("結果：3体とも★3で、日ごとの記録に入る", JSON.stringify(s.days["2026-11-05"]) === JSON.stringify({ st: [3, 3, 3] }));
  check("結果：図鑑に3体、条文帳と当てた数が増える", Object.values(s.dex).filter((d) => d.w > 0).length === 3 && s.xp === 9 && Object.keys(s.laws).length >= 3);
  const shareTxt = await p.textContent(".share");
  check("シェアの文は四角だけで、条文・魔物の名前（答え）を出さない", shareTxt.includes("🟩🟩🟩") && !Object.values(L).some((x) => shareTxt.includes(x.name) || shareTxt.includes(x.no)) && !M.some((m) => shareTxt.includes(m.name)));
  check("初めて全部★3で終えたので、Ko-fi の1行が結果の画面に出る", (await p.$$("text=Ko-fi で応援")).length >= 2);
  check("新しく取れた実績を知らせる", (await p.textContent(".ach-new")).includes("初めての討伐"));
  check("結果の画面：はみ出さない・押せる所は44px以上", (await noOverflow(p)) && (await smallTaps(p)).length === 0, (await smallTaps(p)).join(","));
  await p.click("#home");
  check("ホーム：今日は結果を見るボタンになり、3体の名前が出て、上級が開く", (await p.textContent("#go-d")).includes("結果") && !(await p.$(".trio.shade")) && !!(await p.$("#go-h")));
  await p.click("#go-d");
  check("もう一度押しても結果を見るだけ（1日1回）", !!(await p.$(".minis")) && !(await p.$(".card")));
  await p.click("#home");
  // 上級
  await p.click("#go-h");
  check("上級：無法大君・体力5・カード4枚・見抜くなし", (await p.textContent(".mname")).includes("無法大君") && (await p.$$(".hpbar i")).length === 5 && (await p.$$(".card")).length === 4 && !(await p.$("#hint")));
  for (let i = 0; i < 5; i++) { await answer(p, true); await nextBtn(p); }
  check("上級：5回当てると討伐", (await p.textContent(".win .big")).includes("討伐"));
  await p.click("#go");
  const s2 = await st(p);
  check("上級の記録は今日の記録と別（hdays）・図鑑に大魔", JSON.stringify(s2.hdays["2026-11-05"]) === JSON.stringify({ st: [3] }) && s2.dex.muhou && s2.dex.muhou.w === 1 && JSON.stringify(s2.days["2026-11-05"]) === JSON.stringify({ st: [3, 3, 3] }));
  await p.click("#home");
  await p.click("#go-book");
  check("条文帳：当てた条文は本文を開ける・まだのものは伏せる", (await p.$$(".book details:not(.no)")).length === Object.keys(s2.laws).length && (await p.$$(".book details.no")).length === Object.keys(L).length - Object.keys(s2.laws).length);
  await p.click("#back"); await p.click("#go-dex");
  check("図鑑：討伐した4体（大魔を入れて）は名前が出る", (await p.$$(".dex > div:not(.no)")).length === 4);
  await p.click("#back"); await p.click("#go-ach");
  check(`実績は13個・いま/目標を出す`, (await p.$$(".ach")).length === 13 && (await p.textContent(".achs")).includes("/"));
  await p.setViewportSize({ width: 320, height: 640 });
  check("幅320pxでも実績の画面がはみ出さない", await noOverflow(p));
  await ctx.close();
}

// B. 外す・逃げられる・見抜く・おさらい（練習）
{
  const { ctx, open } = await newCtx();
  const p = await open(); await p.click("#howto-ok");
  await p.click("#go-p");
  check("練習：12体から選べる", (await p.$$("[data-m]")).length === M.length);
  await p.click('[data-m="0"]');
  const w1 = await answer(p, false);
  check("外すと、選んだ条文が何の決まりかも出す（見分ける手がかり）", (await p.textContent(".law .pick")).includes(L[w1.id].name));
  check("外すと「反撃」・盾が1減り・正しい条文が光る", (await p.textContent("#law")).includes("反撃") && (await p.$$(".shield .off")).length === 1 && !!(await p.$(`.card.right[data-id="${w1.q.a}"]`)) && !!(await p.$(".card.wrong")));
  await nextBtn(p);
  await answer(p, false); await nextBtn(p);
  await answer(p, false);
  check("盾が尽きると「逃げられた…」", (await p.textContent("#next")).includes("逃げられた"));
  await nextBtn(p);
  check("逃げられた画面が出る", (await p.textContent(".win .big")).includes("逃げられた"));
  let s = await st(p);
  check("外した3問がおさらいに入る・練習は日ごとの記録に入らない", s.miss.length === 3 && Object.keys(s.days).length === 0);
  await p.click("#go");
  check("練習の結果：逃げられたと出る・シェアは出さない", (await p.textContent(".minis")).includes("逃げられた") && !(await p.$(".shares")));
  await p.click("#home");
  check("ホームの練習ボタンにおさらいの数", (await p.textContent("#go-p")).includes("おさらい3"));
  await p.click("#go-p"); await p.click("#rev");
  check("おさらい：体力は外した問題の数（3）", (await p.$$(".hpbar i")).length === 3);
  const first = qByDeed(await deed(p));
  check("おさらい：外した問題がもう一度出る", s.miss.some((x) => { const [m, q] = x.split(":").map(Number); return M[m].qs[q] === first; }));
  // 見抜く
  await p.click("#hint");
  check("見抜く：まちがいのカードが1枚消え、押せない", (await p.$$(".card.gone")).length === 1 && (await p.$eval(".card.gone", (e) => e.disabled)) && (await p.getAttribute(".card.gone", "data-id")) !== first.a);
  check("見抜くは1体に1回", await p.$eval("#hint", (e) => e.disabled));
  for (let i = 0; i < 3; i++) { await answer(p, true); await nextBtn(p); }
  check("見抜くを使うと★2", (await p.$$(".win .stars .off")).length === 1 && (await p.textContent(".win .stars .off")).length === 1);
  s = await st(p);
  check("当てた問題はおさらいから消える", s.miss.length === 0);
  await ctx.close();
}

// C. 続きから・古いタブ（同じ問題に二重に答えない）
{
  const { ctx, open } = await newCtx();
  const a = await open(); await a.click("#howto-ok"); await a.click("#go-d");
  await answer(a, true); await nextBtn(a);
  const d1 = await deed(a);
  await a.reload();
  check("閉じて開き直すと「続きから」", (await a.textContent("#go-d")).includes("続きから"));
  await a.click("#go-d");
  check("続きからは同じ問題・同じ体力", (await deed(a)) === d1 && (await a.$$(".hpbar i.off")).length === 1);
  const b = await open(); // 同じ画面を2つ目のタブで
  await b.click("#go-d");
  await answer(a, true);
  const xp1 = (await st(a)).xp;
  const q = qByDeed(await deed(b)); await b.click(`.card[data-id="${q.a}"]`); await b.waitForTimeout(100);
  check("古いタブで同じ問題に答えても二重に数えない", (await st(a)).xp === xp1);
  await ctx.close();
}

// D. あとから遊ぶ（取りこぼした日）と、逃げられた日の記録
{
  const { ctx, open } = await newCtx("2026-11-08T03:00:00Z");
  const p = await open(); await p.click("#howto-ok");
  check("ホーム：あとから遊べる日の数（11/5〜11/7 の3日）", (await p.textContent("#go-cal")).includes("3"));
  await p.click("#go-cal");
  check("カレンダー：取りこぼした3日が押せる・始めた日より前は出さない", (await p.$$(".cal button.d.can")).length === 3 && !(await p.$('[data-k="2026-11-04"].can')));
  check("カレンダー：前の月（始めた月より前）へは戻れない", await p.$eval("#pm", (e) => e.disabled));
  await p.click('[data-k="2026-11-06"]');
  const plan = G.dailyPlan("2026-11-06");
  check("あとから：その日の今日の3体と同じ問題", (await deed(p)) === M[plan[0].m].qs[plan[0].order[0]].s && (await p.textContent("h1")).includes("11/6"));
  // 1体目は外して逃げられる
  for (let i = 0; i < 3; i++) { await answer(p, false); await nextBtn(p); }
  await p.click("#go"); await beat(p); await p.click("#go"); await beat(p); await p.click("#go");
  const s = await st(p);
  check("あとからの記録は pdays に入り、逃げられた体は0", JSON.stringify(s.pdays["2026-11-06"]) === JSON.stringify({ st: [0, 3, 3] }) && !s.days["2026-11-06"]);
  check("あとからは Ko-fi の1行もシェアも出さない", !(await p.$(".shares")) && (await p.$$("text=Ko-fi で応援")).length === 1);
  await p.click("#home");
  check("あとから遊んだ日は連続の日に入らない（遊んだ日には入る）", (await p.textContent(".stats")).includes("1") && (await st(p)).days && Object.keys((await st(p)).days).length === 0);
  await p.click("#go-cal");
  check("カレンダー：あとから遊んだ日は点線の枠・もう押せない", !!(await p.$('[data-k="2026-11-06"].later')) && !(await p.$('button[data-k="2026-11-06"]')));
  await p.setViewportSize({ width: 320, height: 640 });
  check("幅320pxでもカレンダーがはみ出さない・押せる所は44px以上", (await noOverflow(p)) && (await smallTaps(p)).length === 0, (await smallTaps(p)).join(","));
  // 今日：逃げられても今日の記録になり、四角は黒
  await p.click("#back"); await p.click("#go-d");
  check("幅320pxでも戦いの画面がはみ出さない", await noOverflow(p));
  for (let i = 0; i < 3; i++) { await answer(p, false); await nextBtn(p); }
  check("幅320pxでも解説の画面がはみ出さない", await noOverflow(p));
  await p.click("#go"); await beat(p); await p.click("#go"); await beat(p); await p.click("#go");
  check("逃げられた体は ⬛ でシェアする", (await p.textContent(".share")).includes("⬛🟩🟩"));
  check("全部★3でないときは Ko-fi の1行を出さない", (await p.$$("text=Ko-fi で応援")).length === 1);
  await ctx.close();
}

// E. 古い記録・壊れた記録でも開ける
{
  const { ctx, open } = await newCtx();
  const p = await open();
  await p.evaluate(() => localStorage.setItem("tobatsu-v1", JSON.stringify({ v: 1, days: { "2026-11-04": { st: [3, 2, 1] } }, extra: 1 })));
  await p.reload();
  const s = await p.evaluate(() => { const x = JSON.parse(localStorage.getItem("tobatsu-v1")); return x; });
  check("足りない入れ物があっても開ける（古い記録を消さない）", (await p.isVisible("#go-d")) && s.days["2026-11-04"]);
  await p.click("#howto-ok"); await p.click("#go-d"); await answer(p, true);
  check("保存すると、知らない入れ物も残す", (await st(p)).extra === 1 && (await st(p)).days["2026-11-04"]);
  await p.evaluate(() => localStorage.setItem("tobatsu-v1", "{壊れた"));
  await p.reload();
  check("壊れた記録でも白い画面にならない", await p.isVisible("#go-d"));
  await ctx.close();
}

check("ページのエラーが出ない", errors.length === 0, errors.slice(0, 3).join(" / "));
await browser.close();

const fail = results.filter((r) => !r.ok);
const md = `# 条文討伐 QA\n\n${results.length - fail.length}/${results.length} 通過\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.ok || !r.detail ? "" : `（${r.detail}）`}`).join("\n")}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(fail.length ? 1 : 0);
