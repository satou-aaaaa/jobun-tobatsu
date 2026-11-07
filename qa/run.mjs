// 条文討伐の検査。データ（条文と問題の形）・今日の3体と大魔の組み方（3年分）・通しで遊ぶ・外す/逃げられる・見抜く・続きから・古いタブ・上級・あとから・図鑑・条文帳・実績・スマホ幅・PWA を確かめる。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
// 条文の本文が e-Gov と同じかは、ネットが要るので別に python3 tools/check-laws.py で見る。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { checkTransfer } from "./transfer-check.mjs";

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

// 2. 今日の5体・大魔の組み方（3年分）
{
  const bad = [], seen = new Set(), seenQ = new Set();
  let d = "2026-11-05", prev = null;
  for (let i = 0; i < 365 * 3; i++) {
    const p = G.dailyPlan(d), h = G.hardPlan(d), ms = p.map((b) => b.m);
    if (ms.length !== 5 || new Set(ms).size !== 5) bad.push(`${d} 5体が重なる`);
    if (prev && [...ms].sort().join() === [...prev].sort().join()) bad.push(`${d} 前の日と同じ5体`);
    if (JSON.stringify(p) !== JSON.stringify(G.dailyPlan(d)) || JSON.stringify(h) !== JSON.stringify(G.hardPlan(d))) bad.push(`${d} 同じ日で組み方が変わる`);
    p.forEach((b) => { if (b.order.length !== M[b.m].qs.length || new Set(b.order).size !== b.order.length) bad.push(`${d} 問題の順番がおかしい`); seen.add(b.m); });
    const hm = h[0].order.map((x) => x[0]);
    if (h[0].order.length < D.BOSS.hp + 2 || new Set(hm).size !== hm.length || hm.some((m) => ms.includes(m))) bad.push(`${d} 大魔の問題が足りない・重なる・今日の5体と重なる`);
    if (h[0].order.some(([m, q]) => !M[m].qs[q] || M[m].qs[q].x.length < 3)) bad.push(`${d} 大魔にまちがい3枚未満の問題`);
    for (const b of [...p, ...h]) for (let k = 0; k < b.order.length; k++) {
      const q = G.qOf(b, k), cs = G.choicesOf(q, (b.seed + k * 7919) >>> 0, b.m === -1 ? 4 : 3);
      if (cs.length !== (b.m === -1 ? 4 : 3) || new Set(cs).size !== cs.length || !cs.includes(q.a) || cs.some((c) => c !== q.a && !q.x.includes(c))) bad.push(`${d} カードがおかしい`);
      const g = G.hintOf(cs, q, b.seed + k); if (g === q.a || !cs.includes(g)) bad.push(`${d} 見抜くで正しいカードが消える`);
      seenQ.add(b.m < 0 ? b.order[k].join(":") : b.m + ":" + b.order[k]);
    }
    prev = ms; d = new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10);
  }
  check("今日の5体（2026-11-05 satouさん「一日で遊べる量が少なすぎる」で3体から増やした）：毎日ちがう5体・前の日と同じ組にならない・同じ日はいつも同じ（3年分）", bad.filter((x) => /5体|同じ/.test(x)).length === 0, bad.slice(0, 3).join(","));
  check("大魔：今日の5体と重ならない別々の魔物から7問・まちがい3枚以上（3年分）", bad.filter((x) => /大魔/.test(x)).length === 0, bad.filter((x) => /大魔/.test(x)).slice(0, 3).join(","));
  check("カード：正しい条文を入れてちがう3枚（上級4枚）・見抜くは正しいカードを消さない", bad.filter((x) => /カード|見抜く|順番/.test(x)).length === 0, bad.filter((x) => /カード|見抜く|順番/.test(x)).slice(0, 3).join(","));
  const total = M.reduce((t, m) => t + m.qs.length, 0);
  check("3年のうちに全部の魔物・全部の問題が出る", seen.size === M.length && seenQ.size === total, `${seen.size}/${M.length} ${seenQ.size}/${total}`);
  // 片寄り：1年でどの魔物も今日の5体に出る回数が平均の半分〜2倍
  const cnt = new Array(M.length).fill(0); let k = "2026-11-05"; for (let i = 0; i < 365; i++) { G.dailyMons(k).forEach((m) => cnt[m]++); k = new Date(Date.parse(k) + 864e5).toISOString().slice(0, 10); }
  const avg = (365 * 5) / M.length;
  check("1年で、どの魔物も出る回数が平均の半分〜2倍（片寄らない）", cnt.every((c) => c > avg / 2 && c < avg * 2), cnt.join(","));
  // 今週の大魔の技：月曜〜日曜は同じ、3つが順に替わる（3年分）
  const wk = []; let w = "2026-11-02", okW = true; for (let i = 0; i < 156; i++) { const a = G.weekArt(w); for (let j = 1; j < 7; j++) if (G.weekArt(new Date(Date.parse(w) + j * 864e5).toISOString().slice(0, 10)) !== a) okW = false; wk.push(a); w = new Date(Date.parse(w) + 7 * 864e5).toISOString().slice(0, 10); }
  check("今週の大魔の技：月曜〜日曜は同じ・3つ（再生・盾くだき・名隠し）が週ごとに替わり、続けて同じにならない", okW && new Set(wk).size === 3 && wk.every((a, i) => !i || a !== wk[i - 1]) && G.hardPlan("2026-11-05")[0].art === G.weekArt("2026-11-05"), wk.slice(0, 4).join(","));
  // 連戦の並び：出会った魔物だけ・続けて同じ魔物にならない・60体（何百回も作って確かめる）
  let eb = 0; for (let i = 0; i < 500; i++) { const pool = G.shuffle([...M.keys()], G.rng(i)).slice(0, 5 + (i % 8)), pl = G.endlessPlan(i * 7 + 1, pool); if (pl.length !== 60 || pl.some((b, j) => !pool.includes(b.m) || (j && b.m === pl[j - 1].m) || b.order.length !== M[b.m].qs.length)) eb++; }
  check("連戦の並び：出会った魔物だけ・続けて同じ魔物が出ない・60体（500回）", eb === 0, String(eb));
  // 真の姿：体力4・カード4枚（まちがいが3枚ある問題では4枚になる）
  const vp = G.practicePlan(1, 0, 1)[0];
  check("真の姿の練習は v=1（体力4・カード4枚）", vp.v === 1 && vp.m === 0);
}

const html = readFileSync(path.join(root, "index.html"), "utf8"), bjs = readFileSync(path.join(root, "battle.js"), "utf8");
const code = (t) => t.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const ARTK = { 刑法: "kei", 民法: "min", 憲法: "ken", 労働基準法: "rou", 特定商取引法: "sho", 消費者契約法: "sho", 個人情報保護法: "sho", 借地借家法: "min", 著作権法: "pen", 道路交通法: "sig" };
check("どの法律にも攻撃の技がある（新しい法律を足したら ARTS にも足す）", [...new Set(Object.values(L).map((x) => x.law))].every((law) => html.includes(law + ": [\"") && ARTK[law]), [...new Set(Object.values(L).map((x) => x.law))].filter((law) => !html.includes(law + ": [\"")).join(","));
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

// A. 初めて開く → 今日の5体を全部★3で → 結果・記録・図鑑・条文帳・Ko-fi・シェア
{
  const { ctx, open } = await newCtx();
  const p = await open();
  check("初めて開くと遊び方が出る", await p.isVisible("#howto"));
  await p.keyboard.press("Escape"); await p.waitForTimeout(100); check("遊び方を Esc で閉じられる", await p.locator("#howto[open]").count() === 0);
  await p.reload(); await p.waitForTimeout(200); check("遊び方を Esc で閉じても、開き直したとき出ない", await p.locator("#howto[open]").count() === 0);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(200); await p.click("#howto-ok"); await p.reload(); await p.waitForTimeout(200); check("遊び方を「わかった」で閉じてすぐ読み直しても出ない", await p.locator("#howto[open]").count() === 0);
  { let again = 0; for (let i = 0; i < 10; i++) { await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(200); await p.keyboard.press("Escape"); await p.reload(); await p.waitForTimeout(200); again += await p.locator("#howto[open]").count(); } check("遊び方を Esc で閉じてすぐ読み直しても出ない（10回）", again === 0); }
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(200); check("「わかった」を押したその場で「見た」が残る", await p.locator("#howto-ok").evaluate((b) => { b.click(); return Object.keys(localStorage).some((k) => { try { return JSON.parse(localStorage.getItem(k)).tut === true; } catch { return false; } }); }));
  check("ホーム：今日の5体の影が出て、名前はまだ伏せる", (await p.$$(".trio.shade svg")).length === 5 && (await p.textContent(".trio")).includes("？？？"));
  check("ホーム：まだ魔物に出会っていないので連戦は閉じている", await p.$eval("#go-e", (e) => e.disabled));
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
  { const want = ARTK[L[r1.q.a].law];
    check("攻撃の技は条文の法律で変わる（刑法＝刃・民法＝鎖・憲法＝光・労基＝鐘・消費者＝札）", await p.$eval("#mon", (e, w) => e.classList.contains("fx-" + w), want));
    check("効果音も技ごとに変わる（端末の中で作る音。外から読まない）", (await p.evaluate(() => SND.log.slice(-1)[0])) === want); }
  await nextBtn(p);
  let won = true; for (let i = 0; i < 2; i++) { await answer(p, true); await nextBtn(p); }
  won = !!(await p.$(".win")) && (await p.textContent(".win .big")).includes("討伐");
  check("討伐の画面：×の目でボロボロの魔物が消え、条文帳に新しく載った条文を出す", (await p.getAttribute("#mon svg", "data-dmg")) === "1.00" && (await p.$$("#mon .crack")).length === 6 && (await p.textContent(".newlaw")).includes("条文帳に新しく"));
  check("3回当てると「討伐！」と★3", won && (await p.$$(".win .stars")).length === 1 && !(await p.textContent(".win .stars .off")));
  await p.click("#go");
  check("討伐のあと2体目へ（点が進む）", (await p.$$(".dots i.done")).length === 1);
  for (let i = 0; i < 3; i++) { await beat(p); await p.click("#go"); }
  await beat(p);
  check("5体目も討伐の画面を見てから結果へ", !!(await p.$(".win")));
  await p.click("#go");
  const s = await st(p);
  check("結果：5体とも★3で、日ごとの記録に入る", JSON.stringify(s.days["2026-11-05"]) === JSON.stringify({ st: [3, 3, 3, 3, 3] }));
  check("結果：図鑑に5体、条文帳と当てた数が増える・出会った魔物に5体", Object.values(s.dex).filter((d) => d.w > 0).length === 5 && s.xp === 15 && Object.keys(s.laws).length >= 3 && Object.keys(s.seen).length === 5);
  const shareTxt = await p.textContent(".share");
  check("シェアの文は四角だけで、条文・魔物の名前（答え）を出さない", shareTxt.includes("🟩🟩🟩🟩🟩") && !Object.values(L).some((x) => shareTxt.includes(x.name) || shareTxt.includes(x.no)) && !M.some((m) => shareTxt.includes(m.name)));
  check("初めて全部★3で終えたので、Ko-fi の1行が結果の画面に出る", (await p.$$("text=Ko-fi で応援")).length >= 2);
  check("新しく取れた実績を知らせる", (await p.textContent(".ach-new")).includes("初めての討伐"));
  check("結果の画面：はみ出さない・押せる所は44px以上", (await noOverflow(p)) && (await smallTaps(p)).length === 0, (await smallTaps(p)).join(","));
  await p.click("#home");
  check("ホーム：連戦が開く（今日の5体に出会った）", !(await p.$eval("#go-e", (e) => e.disabled)));
  check("ホーム：今日は結果を見るボタンになり、5体の名前が出て、上級が開く", (await p.textContent("#go-d")).includes("結果") && !(await p.$(".trio.shade")) && !!(await p.$("#go-h")));
  await p.click("#go-d");
  check("もう一度押しても結果を見るだけ（1日1回）", !!(await p.$(".minis")) && !(await p.$(".card")));
  await p.click("#home");
  // 上級
  await p.click("#go-h");
  check("上級：無法大君・体力5・カード4枚・見抜くなし", (await p.textContent(".mname")).includes("無法大君") && (await p.$$(".hpbar i")).length === 5 && (await p.$$(".card")).length === 4 && !(await p.$("#hint")));
  check("上級：今週の技（11/5 の週は「再生」）を出す", (await p.textContent(".wart")).includes("再生"));
  await answer(p, true); await nextBtn(p); await answer(p, false);
  check("今週の技「再生」：外すと大君の体力が1戻る", (await p.$$(".hpbar i.off")).length === 0 && (await p.textContent("#mon .pop")).includes("再生"));
  await nextBtn(p);
  for (let i = 0; i < 5; i++) { await answer(p, true); await nextBtn(p); }
  check("上級：体力をすべて削ると討伐", (await p.textContent(".win .big")).includes("討伐"));
  await p.click("#go");
  const s2 = await st(p);
  check("上級の記録は今日の記録と別（hdays）・図鑑に大魔", JSON.stringify(s2.hdays["2026-11-05"]) === JSON.stringify({ st: [2] }) && s2.dex.muhou && s2.dex.muhou.w === 1 && JSON.stringify(s2.days["2026-11-05"]) === JSON.stringify({ st: [3, 3, 3, 3, 3] }));
  await p.click("#home");
  await p.click("#go-book");
  check("条文帳：当てた条文は本文を開ける・まだのものは伏せる", (await p.$$(".book details:not(.no)")).length === Object.keys(s2.laws).length && (await p.$$(".book details.no")).length === Object.keys(L).length - Object.keys(s2.laws).length);
  // 思い出す：集めた条文の文から名前を当てる
  await p.click("#recall");
  const rq = await p.textContent("#rtext"), rk = Object.keys(L).find((k) => rq.includes(L[k].text));
  check("思い出す：集めた条文の文を出し、名前は伏せる・札は集めた条文だけ", !!rk && s2.laws[rk] && !rq.includes(L[rk].name) && (await p.$$eval("[data-r]", (es) => es.map((e) => e.dataset.r))).every((k) => s2.laws[k]));
  await p.click(`[data-r="${rk}"]`);
  check("思い出す：当てると「正解」", (await p.textContent("#law")).includes("正解"));
  for (let i = 0; i < 6 && (await p.$("#next")); i++) { await p.click("#next"); const t = await p.$("#rtext"); if (!t) break; const tx = await t.textContent(); const k = Object.keys(L).find((x) => tx.includes(L[x].text)); await p.click(`[data-r="${k}"]`); }
  const s3 = await st(p);
  check("思い出す：5問で終わり、当てた数と最後に出した日を残す", (await p.textContent(".win .big")).includes("5/5") && s3.rcok === 5 && Object.keys(s3.rc).length === 5);
  await p.click("#bk"); await p.click("#back"); await p.click("#go-dex");
  check("図鑑：討伐した6体（大魔を入れて）は名前が出る・真の姿はまだ伏せる", (await p.$$(".dex > div:not(.no)")).length === 6 && (await p.textContent(".sec")).includes("真の姿 0/"));
  await p.click("#back"); await p.click("#go-ach");
  check(`実績は16個・いま/目標を出す`, (await p.$$(".ach")).length === 16 && (await p.textContent(".achs")).includes("/"));
  await p.setViewportSize({ width: 320, height: 640 });
  check("幅320pxでも実績の画面がはみ出さない", await noOverflow(p));
  await ctx.close();
}

// B. 外す・逃げられる・見抜く・おさらい（練習）
{
  const { ctx, open } = await newCtx();
  const p = await open(); await p.click("#howto-ok");
  await p.click("#go-p");
  check("練習：まだ出会っていない魔物は影で、選べない（2026-11-05 satouさん「練習で全員見えてしまう」）", (await p.$$("[data-m]")).length === 0 && (await p.$$(".dex > div.no")).length === M.length);
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem("tobatsu-v1")); s.seen = { kasume: 1 }; localStorage.setItem("tobatsu-v1", JSON.stringify(s)); });
  await p.click("#back"); await p.click("#go-p");
  check("練習：出会った魔物だけ選べる・ほかの名前は出さない", (await p.$$("[data-m]")).length === 1 && !(await p.textContent(".dex")).includes(M[1].name));
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
  // 真の姿：3回討伐すると練習で戦える（体力4・カード4枚・色ちがい）
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem("tobatsu-v1")); s.dex.kasume = { w: 3, b: 3 }; localStorage.setItem("tobatsu-v1", JSON.stringify(s)); });
  await p.click("#go"); await p.click("#home"); await p.click("#go-p");
  check("練習：3回討伐した魔物は「真の姿」とも戦える", (await p.$$("[data-v]")).length === 1);
  await p.click('[data-v="0"]');
  check("真の姿：名前に「真・」・体力4・カード4枚", (await p.textContent(".mname")).includes("真・" + M[0].name) && (await p.$$(".hpbar i")).length === 4 && (await p.$$(".card")).length === 4);
  for (let i = 0; i < 4; i++) { await answer(p, true); await nextBtn(p); }
  check("真の姿を討伐すると図鑑の別の欄に載る", ((await st(p)).dex["kasume*"] || {}).w === 1);
  // 効果音の切り替え（この端末に覚える）
  await p.click("#go"); await p.click("#home");
  await p.click("#snd");
  check("効果音は切り替えられ、切ると🔇を出して覚える", (await p.textContent("#snd")) === "🔇" && (await p.evaluate(() => localStorage.getItem("tobatsu-v1-snd"))) === "0");
  await p.reload();
  check("開き直しても効果音は切ったまま", (await p.textContent("#snd")) === "🔇");
  await ctx.close();
}

// F. 連戦：盾は持ち越し・3体ごとに1つ戻る・盾が尽きたら終わり・最高を残す
{
  const { ctx, open } = await newCtx();
  const p = await open(); await p.click("#howto-ok");
  const met = ["kasume", "arakobushi", "zawameki", "itsuwari", "madowashi"], names = met.map((id) => M.find((m) => m.id === id).name);
  await p.evaluate((ids) => localStorage.setItem("tobatsu-v1", JSON.stringify({ v: 1, tut: true, seen: Object.fromEntries(ids.map((i) => [i, 1])) })), met);
  await p.reload();
  await p.click("#go-e");
  const who = async () => (await p.$eval(".mname", (e) => e.firstChild.textContent)).trim();
  let okNames = names.includes(await who());
  await answer(p, false); await nextBtn(p);
  check("連戦：外した盾は残る", (await p.$$(".shield .off")).length === 1);
  for (let i = 0; i < 3; i++) { await beat(p); await p.click("#go"); if (i < 2) { okNames = okNames && names.includes(await who()); check(`連戦：盾は次の魔物へ持ち越す（${i + 2}体目）`, (await p.$$(".shield .off")).length === 1); } }
  check("連戦：出会った魔物だけが出る", okNames && names.includes(await who()));
  check("連戦：3体討伐すると盾が1つ戻る", (await p.$$(".shield .off")).length === 0);
  for (let i = 0; i < 3; i++) { await answer(p, false); await nextBtn(p); }
  check("連戦：盾が尽きると連戦おわり", (await p.textContent(".win")).includes("連戦おわり"));
  await p.click("#go");
  const s = await st(p);
  check("連戦の結果：討伐した数と最高を出し、記録 ebest に残す（日ごとの記録には入れない）", (await p.textContent(".win .big")).includes("3") && s.ebest === 3 && !Object.keys(s.days || {}).length && !!(await p.$("#again")));
  const links = await p.$$eval(".shares a", (es) => es.map((e) => decodeURIComponent(e.href)).join(""));
  check("連戦の結果：シェアの文に魔物・条文の名前を出さない", !names.some((n) => links.includes(n)) && links.includes("連戦"));
  check("連戦の結果：はみ出さない・押せる所は44px以上", (await noOverflow(p)) && (await smallTaps(p)).length === 0, (await smallTaps(p)).join(","));
  await ctx.close();
}

// G. 今週の大魔の技：盾くだき（盾2つ）・名隠し（札に名前を出さない）
for (const [day, art] of [["2026-11-12", "guard"], ["2026-11-19", "text"]]) {
  const { ctx, open } = await newCtx(day + "T03:00:00Z");
  const p = await open(); await p.click("#howto-ok");
  await p.evaluate((d) => { const s = { v: 1, tut: true, days: {} }; s.days[d] = { st: [3, 3, 3, 3, 3] }; localStorage.setItem("tobatsu-v1", JSON.stringify(s)); }, day);
  await p.reload(); await p.click("#go-h");
  if (art === "guard") check("今週の技「盾くだき」：盾が2つから", (await p.$$(".shield span")).length === 2 && (await p.textContent(".wart")).includes("盾くだき"));
  else { const nm = await p.$$eval(".card .nm", (es) => es.map((e) => e.textContent)); const ids = await p.$$eval(".card", (es) => es.map((e) => e.dataset.id));
    check("今週の技「名隠し」：札に条文の名前が出ず、書き出しだけ（答えたあとは名前を出す）", ids.every((id, i) => { const t = L[id].text.split("…")[0]; return nm[i] === (t.length > 26 ? t.slice(0, 26) + "…" : t) && nm[i] !== L[id].name; }) && (await p.$$(".card .nm.tx")).length === 4);
    await answer(p, true); check("名隠し：答えたあとは名前を出す", (await p.$$(".card .nm.tx")).length === 0); }
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
  await nextBtn(a);
  await b.reload(); await b.click("#go-d"); // b は今の問題を出したまま
  for (let i = 0; i < 6 && !(await a.$(".win")); i++) { await answer(a, true); await nextBtn(a); }
  await b.click("#hint"); await b.waitForTimeout(100);
  check("討伐の画面のあいだに古いタブで見抜くを押しても、次の魔物の見抜くは消えない（2026-11-05 CodeRabbit）", !!(await a.$(".win")) && !(await st(a)).runs.d.cur.hint);
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
  check("あとから：その日の今日の5体と同じ問題", (await deed(p)) === M[plan[0].m].qs[plan[0].order[0]].s && (await p.textContent("h1")).includes("11/6"));
  // 1体目は外して逃げられる
  for (let i = 0; i < 3; i++) { await answer(p, false); await nextBtn(p); }
  await p.click("#go"); for (let i = 0; i < 4; i++) { await beat(p); await p.click("#go"); }
  const s = await st(p);
  check("あとからの記録は pdays に入り、逃げられた体は0", JSON.stringify(s.pdays["2026-11-06"]) === JSON.stringify({ st: [0, 3, 3, 3, 3] }) && !s.days["2026-11-06"]);
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
  await p.click("#go"); for (let i = 0; i < 4; i++) { await beat(p); await p.click("#go"); }
  check("逃げられた体は ⬛ でシェアする", (await p.textContent(".share")).includes("⬛🟩🟩🟩🟩"));
  check("全部★3でないときは Ko-fi の1行を出さない", (await p.$$("text=Ko-fi で応援")).length === 1);
  await ctx.close();
}

// F. 色だけで分けない（shared-workflows routines/game-dev.md A1）・知らせを #live に文字で出す（A7）・動きを減らす（A8）
{
  const { ctx, open } = await newCtx();
  const p = await open(); await p.click("#howto-ok");
  await p.evaluate(() => { window.__vib = 0; Object.defineProperty(navigator, "vibrate", { configurable: true, value: () => { window.__vib++; return true; } }); });
  await p.click("#go-d");
  const live = () => p.evaluate(() => document.getElementById("live").textContent);
  const waitLive = (re) => p.waitForFunction((s) => new RegExp(s).test(document.getElementById("live").textContent), re.source, { timeout: 3000 }).then(() => true, () => false);
  const dots = await p.$eval(".dots", (e) => ({ l: e.getAttribute("aria-label"), on: e.querySelector("i.on").getBoundingClientRect().height, rest: e.querySelector("i:not(.on)").getBoundingClientRect().height, b: getComputedStyle(e.querySelector("i:not(.on)")).borderTopStyle }));
  check("進み具合の点は色だけでなく形でも分かる（今の体は大きく、まだの体は枠だけ）・読み上げで「何体目」", dots.l === "5体のうち1体目" && dots.on > dots.rest && dots.b === "solid", JSON.stringify(dots));
  const w = await answer(p, false);
  const cardOf = (sel) => p.$eval(sel, (e) => ({ t: e.textContent, l: e.getAttribute("aria-label"), b: getComputedStyle(e).borderTopStyle }));
  const right = await cardOf(`.card.right[data-id="${w.q.a}"]`), wrong = await cardOf(`.card.wrong[data-id="${w.id}"]`);
  check("札の正しい・まちがいは色だけでなく ✓/✕ の印・破線・読み上げの名前でも出す", right.t.includes("✓") && right.l.includes("正しい条文") && wrong.t.includes("✕") && wrong.l.includes("まちがい") && wrong.b === "dashed", JSON.stringify([right, wrong]));
  check("外したときの見出しは「✕ 反撃」（色だけにしない）", (await p.textContent("#law .hd b")).includes("✕ 反撃"));
  check("外したことを #live（role=status）に文字で知らせる（正しい条文の名前と盾の数）", (await waitLive(/反撃/)) && (await live()).includes(L[w.q.a].name) && (await live()).includes("盾 2/3"), await live());
  check("減った盾には ✕ の印（明るさだけにしない）", (await p.$eval(".shield .off", (e) => getComputedStyle(e, "::after").content)).includes("✕"));
  check("音のほかに #live の文字・画面の文字でも知らせ、振動はふだんは使う", (await p.evaluate(() => window.__vib)) > 0);
  await nextBtn(p);
  await p.click("#hint");
  const gone = await p.$eval(".card.gone", (e) => ({ l: e.getAttribute("aria-label"), d: getComputedStyle(e.querySelector(".nm") || e).textDecorationLine + getComputedStyle(e).textDecorationLine }));
  check("見抜いて消した札は取り消し線と読み上げの名前「消した」でも分かる・#live で知らせる", gone.l.includes("見抜いて消した") && gone.d.includes("line-through") && (await waitLive(/見抜いた/)), JSON.stringify(gone));
  const h1 = await answer(p, true);
  check("当てたら「✓ 命中」と #live に条文の名前・魔物の体力", (await p.textContent("#law .hd b")).includes("✓ 命中") && (await waitLive(/命中/)) && (await live()).includes(L[h1.q.a].name) && (await live()).includes("体力 2/3"), await live());
  const hp = await p.$$eval(".hpbar i", (es) => es.map((e) => getComputedStyle(e).backgroundImage !== "none" || getComputedStyle(e).backgroundColor !== "rgba(0, 0, 0, 0)"));
  check("体力の残りは塗り・減った分は枠だけ（色だけにしない）", hp.filter((x) => x).length === 2 && hp.filter((x) => !x).length === 1, JSON.stringify(hp));
  await nextBtn(p); await beat(p);
  check("取れなかった星は ☆（形でも分かる）・討伐を #live で知らせる", (await p.textContent(".win .stars .off")) === "☆☆" && (await waitLive(/討伐/)), await p.textContent(".win .stars"));
  await ctx.close();
}
{ // 色の見分けを助ける（html.a11y-cvd）：青と朱の組に替える。動きを減らす：振動しない。カレンダーの上級は▲と読み上げの名前
  const { ctx, open } = await newCtx();
  const p = await open();
  await p.evaluate(() => { localStorage.setItem("a11y-v1", JSON.stringify({ cvd: true, calm: true })); localStorage.setItem("tobatsu-v1", JSON.stringify({ v: 1, tut: true, days: { "2026-11-04": { st: [3, 3, 2, 1, 0] } }, hdays: { "2026-11-04": { st: [2] } } })); });
  await p.reload();
  await p.evaluate(() => { window.__vib = 0; Object.defineProperty(navigator, "vibrate", { configurable: true, value: () => { window.__vib++; return true; } }); });
  await p.click("#go-d");
  const w = await answer(p, false);
  const col = await p.evaluate((ids) => [`.card.right[data-id="${ids[0]}"]`, `.card.wrong[data-id="${ids[1]}"]`].map((s) => getComputedStyle(document.querySelector(s)).borderTopColor), [w.q.a, w.id]);
  check("「色の見分けを助ける」で、正しい札は青（#0072B2）・まちがいは朱（#D55E00）の縁に替わる", (await p.evaluate(() => document.documentElement.classList.contains("a11y-cvd"))) && col[0] === "rgb(0, 114, 178)" && col[1] === "rgb(213, 94, 0)", col.join(" "));
  check("「動きを減らす」では振動しない（navigator.vibrate を呼ばない）", (await p.evaluate(() => window.__vib)) === 0);
  await p.click("#back"); await p.click("#go-cal");
  const cell = await p.$eval('[data-k="2026-11-04"]', (e) => ({ l: e.getAttribute("aria-label"), cp: e.querySelector(".h") && getComputedStyle(e.querySelector(".h")).clipPath }));
  check("カレンダー：上級の日は▲の形（色の点だけにしない）と読み上げの名前「上級」・凡例も▲", cell.l.includes("上級") && /polygon/.test(cell.cp || "") && (await p.textContent(".legend")).includes("▲：上級"), JSON.stringify(cell));
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

// 引き継ぎコード（別の端末へ記録を移す。shared-workflows template/transfer.js）
await checkTransfer({ browser, url, game: "jobun-tobatsu", sample: { "tobatsu-v1": JSON.stringify({ v: 1, tut: true, days: { "2026-11-04": { st: [3, 2, 1, 3, 3] } }, dex: { kasume: { w: 2, b: 3 } }, laws: { k235: 2 }, xp: 2, seen: { kasume: 1 } }), "tobatsu-v1-snd": "0" }, check, open: async (p) => { await p.evaluate(() => { const d = document.getElementById("howto"); if (d && d.open) document.getElementById("howto-ok").click(); }); } });
check("ページのエラーが出ない", errors.length === 0, errors.slice(0, 3).join(" / "));
await browser.close();

{ // 見やすさ・読みやすさ・偏り（shared-workflows template/qa/a11y.mjs の写し。routines/game-dev.md「だれでも遊べるように」）
  const { spawnSync } = await import("node:child_process");
  const a = spawnSync(process.execPath, [path.join(root, "qa", "a11y.mjs")], { encoding: "utf8", env: process.env });
  check("見やすさ・読みやすさの検査（qa/a11y.mjs。中身は qa-report/a11y.md）", a.status === 0, (a.stdout.match(/^- ❌.*$/gm) || []).join(" / ") || (a.status ? a.stderr.slice(-300) : ""));
}

const fail = results.filter((r) => !r.ok);
const md = `# 条文討伐 QA\n\n${results.length - fail.length}/${results.length} 通過\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.ok || !r.detail ? "" : `（${r.detail}）`}`).join("\n")}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(fail.length ? 1 : 0);
