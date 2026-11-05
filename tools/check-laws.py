#!/usr/bin/env python3
"""data.js の条文（text・cap）が e-Gov 法令検索の本文と同じか確かめる。
使い方: python3 tools/check-laws.py   （ネットが要る。CI では動かさず、条文を足した・直したときに手元で回す）
text は「…」で区切ったそれぞれが、その条の本文（空白を除く）にそのままあること。cap は見出し（括弧の中）と同じこと。"""
import json, re, subprocess, sys, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
IDS = {"刑法": "140AC0000000045", "民法": "129AC0000000089", "憲法": "321CONSTITUTION", "労働基準法": "322AC0000000049",
       "特定商取引法": "351AC0000000057", "消費者契約法": "412AC0000000061"}
laws = json.loads(subprocess.check_output(["node", "-e", "process.stdout.write(JSON.stringify(require('./data.js').LAWS))"]))
bad = 0
for k, L in laws.items():
    art = L["no"].replace("条", "", 1) if L["no"].endswith("条") else L["no"].replace("条", "")
    url = f"https://laws.e-gov.go.jp/api/1/articles;lawId={IDS[L['law']]};article={urllib.parse.quote(art)}"
    try: root = ET.fromstring(urllib.request.urlopen(url, timeout=30).read())
    except Exception as e: print("✗", k, L["law"], L["no"], "読めない:", e); bad += 1; continue
    if root.findtext(".//Code") != "0" or root.find(".//Paragraph") is None: print("✗", k, "条が見つからない"); bad += 1; continue
    for rt in list(root.iter()):  # ふりがな（Rt）は外す
        for c in list(rt):
            if c.tag == "Rt": c.text = ""
    ce = root.find(".//ArticleCaption")
    cap = "".join(ce.itertext()).strip().strip("（）") if ce is not None else ""
    body = re.sub(r"\s", "", "".join(t for p in root.iter("Paragraph") for t in p.itertext()))
    miss = [seg for seg in L["text"].split("…") if seg and seg not in body]
    if miss: print("✗", k, L["law"], L["no"], "本文に無い:", miss); bad += 1
    if L["cap"] and cap != L["cap"]: print("✗", k, "見出しがちがう:", cap, "≠", L["cap"]); bad += 1
    if not L["cap"] and cap: print("✗", k, "見出しがある:", cap); bad += 1
print("条文", len(laws), "件、ちがい", bad, "件")
sys.exit(1 if bad else 0)
