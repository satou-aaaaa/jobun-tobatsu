// アイコン（icon-192.png・icon-512.png）と SNS 用の絵（og.png 1200×630）を作る。今日の魔物（答え）は入れず、見本の魔物だけ。
// 使い方: node tools/make-art.cjs（qa/ の playwright を使う。魔物の絵は index.html の monSvg をそのまま使う）
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
const out = (f) => path.join(__dirname, "..", f);
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.goto(pathToFileURL(out("index.html")).href);
  const mon = await p.evaluate(() => [monSvg(TOBATSU.BOSS, { flat: true }), monSvg(TOBATSU.MONSTERS[0], { flat: true }), monSvg(TOBATSU.MONSTERS[8], { flat: true }), swordSvg(3)]);
  const bg = "radial-gradient(120% 90% at 50% 0%,#2c2560 0%,#14122b 65%)";
  for (const s of [192, 512]) {
    await p.setViewportSize({ width: s, height: s });
    await p.setContent(`<body style="margin:0"><div style="width:${s}px;height:${s}px;background:${bg};display:grid;place-items:center;position:relative;overflow:hidden">
      <div style="width:${s * 0.62}px;height:${s * 0.62}px;margin-top:${s * 0.06}px">${mon[0].replace("<svg ", '<svg style="width:100%;height:100%;overflow:visible" ')}</div>
      <div style="position:absolute;width:${s * 0.9}px;height:${s * 0.035}px;left:${s * 0.05}px;top:${s * 0.48}px;background:linear-gradient(90deg,transparent,#fff,#ffe9a6,transparent);transform:rotate(-32deg);box-shadow:0 0 ${s * 0.05}px #ffe39a;border-radius:9px"></div></div></body>`);
    await p.screenshot({ path: out(`icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await p.setViewportSize({ width: 1200, height: 630 });
  const sv = (i, w) => mon[i].replace("<svg ", `<svg style="width:${w}px;height:${w}px;overflow:visible" `);
  await p.setContent(`<body style="margin:0;font-family:'Noto Serif CJK JP','Noto Sans CJK JP',serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:70px 80px;background:${bg};color:#f3eee2;position:relative;overflow:hidden">
    <div style="font-size:32px;color:#e6b84c;letter-spacing:.12em">本物の条文で戦う・1日5体</div>
    <div style="font-size:120px;font-weight:900;margin-top:10px;letter-spacing:.12em;color:#f6d77e;text-shadow:0 0 30px #e6b84c66">条文討伐</div>
    <div style="font-size:40px;margin-top:14px;line-height:1.5;color:#e9e2f5">その悪事、<br>どの条文で斬る？</div>
    <div style="position:absolute;right:70px;top:110px">${sv(0, 400)}</div>
    <div style="position:absolute;right:420px;top:400px;opacity:.9">${sv(1, 170)}</div>
    <div style="position:absolute;right:20px;top:440px;opacity:.9">${sv(2, 150)}</div>
    <div style="position:absolute;width:640px;height:10px;right:40px;top:300px;background:linear-gradient(90deg,transparent,#fff,#ffe9a6,transparent);transform:rotate(-32deg);box-shadow:0 0 30px #ffe39a;border-radius:9px"></div>
  </div></body>`);
  await p.screenshot({ path: out("og.png") });
  await b.close();
})();
