#!/usr/bin/env python3
"""Build matching English and Libyan Arabic A4 Tazdan reference PDFs.

The source chapter text is in tazdan_content.py. Inventories are regenerated
from the repository at build time. No production network or database is used.
"""
from __future__ import annotations

import math
import re
import sys
from collections import Counter
from functools import lru_cache
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from arabic_reshaper import reshape
from bidi.algorithm import get_display

from tazdan_content import CHAPTERS, RISK_ROWS, GLOSSARY, REFERENCES

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "pdf"
SOURCE = ROOT / "output" / "source"
W, H = A4
L, R, TOP, BOT = 49, 49, 55, 48
CW = W - L - R
NAVY = colors.HexColor("#10263B")
BLUE = colors.HexColor("#2A8FC8")
PALE = colors.HexColor("#E8F4FA")
INK = colors.HexColor("#1C2A35")
MUTED = colors.HexColor("#607382")
LINE = colors.HexColor("#CFDEE7")
WHITE = colors.white

# Keep the layout's font alias; Tahoma covers the shaped Arabic glyphs ReportLab needs.
pdfmetrics.registerFont(TTFont("Cairo", "/System/Library/Fonts/Supplemental/Tahoma.ttf"))
pdfmetrics.registerFont(TTFont("Cairo-Bold", "/System/Library/Fonts/Supplemental/Tahoma Bold.ttf"))
pdfmetrics.registerFont(TTFont("DejaVu", "/System/Library/Fonts/Supplemental/Arial.ttf"))
pdfmetrics.registerFontFamily("Cairo", normal="Cairo", bold="Cairo-Bold")

def label(en: str, ar: str, lang: str) -> str:
    return ar if lang == "ar" else en

@lru_cache(maxsize=50000)
def shown(text: str, lang: str) -> str:
    return get_display(reshape(text)) if lang == "ar" and re.search(r"[\u0600-\u06ff]", text) else text

@lru_cache(maxsize=50000)
def text_width(text: str, font: str, size: float, lang: str) -> float:
    return pdfmetrics.stringWidth(shown(text, lang), font, size)

@lru_cache(maxsize=20000)
def wrap(text: str, width: float, font: str, size: float, lang: str) -> list[str]:
    text = str(text).replace("\n", " ").strip()
    if not text:
        return [""]
    words = text.split()
    lines, cur = [], ""
    for word in words:
        # Split long URLs even when a preceding word already occupies the line.
        parts, part = [], ""
        if text_width(word, font, size, lang) <= width:
            parts = [word]
        else:
            for ch in word:
                if part and text_width(part + ch, font, size, lang) > width:
                    parts.append(part)
                    part = ch
                else:
                    part += ch
            if part:
                parts.append(part)
        for j, segment in enumerate(parts):
            if j and cur:
                lines.append(cur)
                cur = segment
                continue
            candidate = segment if not cur else cur + " " + segment
            if text_width(candidate, font, size, lang) <= width:
                cur = candidate
            else:
                if cur:
                    lines.append(cur)
                cur = segment
    if cur:
        lines.append(cur)
    return lines

MOUNTS = {
 "auth":"/api/auth", "user":"/api/users", "wallet":"/api/wallets",
 "deposit":"/api/deposits", "withdrawal":"/api/withdrawals", "admin":"/api/admin",
 "exchange":"/api/exchange", "bankAccount":"/api/bank-accounts",
 "linkedWallet":"/api/linked-wallets", "transfer":"/api/transfers",
 "whatsapp":"/api/whatsapp", "profile":"/api/profile", "p2p":"/api/p2p",
 "messages":"/api/messages", "referral":"/api/referrals",
 "notification":"/api/notifications", "news":"/api/news",
 "claimLink":"/api/claim-links", "security":"/api/security",
 "apikey":"/api/api-keys", "export":"/api/export", "card":"/api/cards",
 "markets":"/api/markets", "transactions":"/api/transactions",
 "activities":"/api/activities", "geo":"/api/countries",
 "platformBanks":"/api/platform-banks", "cryptoWallet":"/api/wallet",
 "cryptoWithdrawal":"/api/withdrawal", "rates":"/api/rates",
 "recurringBuy":"/api/recurring-buys", "budget":"/api/budgets",
 "assetDiscussion":"/api/asset-discussions", "waitlist":"/api/waitlist",
}

def inventory():
    route_pattern = re.compile(r"\b(?:\w+Router|router)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*['\"]([^'\"]+)['\"]", re.I)
    endpoints = []
    for stem, prefix in MOUNTS.items():
        path = ROOT / "server" / "src" / "routes" / (stem + ".ts")
        src = path.read_text()
        src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
        src = re.sub(r"^\s*//.*$", "", src, flags=re.M)
        global_auth = bool(re.search(r"(?:router|\w+Router)\.use\(authenticate", src))
        for m in route_pattern.finditer(src):
            local = src[m.end():src.find(";", m.end()) if src.find(";", m.end()) > 0 else m.end()+180]
            path_str = prefix + ("" if m.group(2) == "/" else m.group(2))
            access = "admin" if stem == "admin" else "auth" if global_auth or "authenticate" in local else "public/conditional"
            if "/webhook/" in path_str: access = "signed webhook"
            endpoints.append((stem, m.group(1).upper(), path_str, access, f"server/src/routes/{stem}.ts"))
    endpoints.extend([("core","GET","/api/features","public","server/src/index.ts"),
                      ("core","GET","/api/health","conditional","server/src/index.ts")])
    schema = (ROOT / "server/prisma/schema.prisma").read_text()
    models = []
    for m in re.finditer(r"^model\s+(\w+)\s*\{(.*?)^\}", schema, re.M|re.S):
        fields = []
        for row in m.group(2).splitlines():
            row = row.strip()
            if not row or row.startswith(("//", "@")): continue
            bits = row.split()
            if len(bits) >= 2 and not bits[0].startswith("//"):
                fields.append(bits[0])
        models.append((m.group(1), len(fields), ", ".join(fields[:6]) + ("…" if len(fields)>6 else "")))
    enums = []
    for m in re.finditer(r"^enum\s+(\w+)\s*\{(.*?)^\}", schema, re.M|re.S):
        values = [x.strip().split()[0] for x in m.group(2).splitlines() if x.strip() and not x.strip().startswith("//")]
        enums.append((m.group(1), ", ".join(values)))
    screens = [p.relative_to(ROOT).as_posix() for p in (ROOT / "mobile/app").rglob("*.tsx") if not p.name.startswith("_")]
    return endpoints, models, enums, sorted(screens)

ENDPOINTS, MODELS, ENUMS, SCREENS = inventory()

SCENARIO_INPUTS = {
 "Conservative": {
  1:(15000,3000,20,2.0,120,.014,.35,1.2,18,.12),
  3:(70000,20000,150,2.5,140,.013,.40,2.4,35,.18),
  5:(150000,55000,450,3.0,160,.012,.50,5.0,65,.22),
  10:(500000,180000,1800,3.5,210,.010,.55,14.0,170,.30)},
 "Base": {
  1:(30000,6000,50,2.5,150,.015,.45,1.5,22,.16),
  3:(180000,55000,500,3.0,180,.013,.50,4.0,55,.23),
  5:(500000,170000,2000,3.5,220,.011,.55,10.0,120,.30),
  10:(1500000,650000,9000,4.0,260,.010,.64,40.0,400,.36)},
 "Upside": {
  1:(50000,11000,100,2.8,160,.016,.45,1.8,28,.18),
  3:(300000,110000,1200,3.5,200,.014,.54,6.0,80,.28),
  5:(900000,350000,5000,4.0,240,.012,.60,17.0,190,.36),
  10:(2800000,1150000,20000,4.6,290,.010,.68,70.0,700,.42)},
}

def financial_rows(name: str):
    rows = []
    for year, vals in SCENARIO_INPUTS[name].items():
        users, mau, biz, freq, ticket, take, gm, opex_m, staff, remshare = vals
        volume_m = mau*freq*ticket*12/1e6
        revenue_m = volume_m*take
        gp_m = revenue_m*gm
        ebitda_m = gp_m-opex_m
        net_m = ebitda_m - .06*revenue_m - max(0, ebitda_m-.06*revenue_m)*.20
        rows.append(dict(year=year,users=users,mau=mau,biz=biz,freq=freq,ticket=ticket,
                         take=take,gm=gm,opex_m=opex_m,staff=staff,remshare=remshare,
                         volume_m=volume_m,remit_m=volume_m*remshare,revenue_m=revenue_m,
                         gp_m=gp_m,ebitda_m=ebitda_m,net_m=net_m,
                         tech_m=opex_m*.18,compliance_m=opex_m*.16,marketing_m=opex_m*.20,
                         partner_m=revenue_m-gp_m,
                         liquidity_m=volume_m*remshare/12*.20,
                         capital_m=max(0, -ebitda_m)+volume_m*remshare/12*.20+opex_m*.25))
    return rows

class Book:
    def __init__(self, path: Path, lang: str, toc: dict | None = None):
        self.path, self.lang, self.toc = path, lang, toc or {}
        self.c = canvas.Canvas(str(path), pagesize=A4, pageCompression=1)
        self.c.setTitle(label("The Tazdan Manifesto - English Edition", "مانيفستو تزدان - النسخة الليبية",lang))
        self.page = 0
        self.y = H-TOP
        self.chapter_pages = {}
        self.figures = []
        self.tables = []
        self.figure_no = 0
        self.table_no = 0
        self.current_chapter = ""

    def new(self, title: str = ""):
        if self.page:
            self._footer()
            self.c.showPage()
        self.page += 1
        self.y = H-TOP
        self.current_chapter = title or self.current_chapter
        if self.page > 1:
            self.c.setFillColor(BLUE)
            self.c.rect(L, H-29, 22, 2, fill=1, stroke=0)
            self.c.setFillColor(MUTED)
            self.c.setFont("Cairo" if self.lang=="ar" else "Helvetica", 8)
            hdr = self.current_chapter[:58]
            if self.lang=="ar":
                self.c.drawRightString(W-R, H-27, shown(hdr,self.lang))
            else:
                self.c.drawString(L+32, H-27, hdr)

    def _footer(self):
        if self.page == 1: return
        self.c.setStrokeColor(LINE)
        self.c.line(L, BOT-14, W-R, BOT-14)
        self.c.setFillColor(MUTED)
        self.c.setFont("Cairo" if self.lang=="ar" else "Helvetica", 7)
        self.c.drawString(L, BOT-27, "TAZDAN  |  CONFIDENTIAL  |  06 OCT 2026")
        self.c.drawRightString(W-R, BOT-27, str(self.page))

    def need(self, height: float):
        if self.y-height < BOT+12: self.new()

    def line(self, txt: str, x: float, y: float, size=10, bold=False, color=INK, right=None):
        font = ("Cairo-Bold" if bold else "Cairo") if self.lang=="ar" else ("Helvetica-Bold" if bold else "Helvetica")
        self.c.setFont(font,size); self.c.setFillColor(color)
        if right is None: right = self.lang=="ar"
        if right: self.c.drawRightString(x,y,shown(txt,self.lang))
        else: self.c.drawString(x,y,shown(txt,self.lang))

    def para(self, txt: str, size=9.5, leading=None, color=INK, gap=10, indent=0, bold=False):
        if self.lang=="ar" and size==9.5:
            size=10.2
        leading = leading or (size*1.65 if self.lang=="ar" else size*1.45)
        font = ("Cairo-Bold" if bold else "Cairo") if self.lang=="ar" else ("Helvetica-Bold" if bold else "Helvetica")
        lines = wrap(txt, CW-indent, font,size,self.lang)
        required_height = (len(lines)-1)*leading+size*.35 if gap==0 else len(lines)*leading+gap
        self.need(required_height)
        for v in lines:
            self.line(v, W-R-indent if self.lang=="ar" else L+indent, self.y, size,bold,color)
            self.y -= leading
        self.y -= gap

    def source(self, txt: str):
        if not txt:return
        prefix = "EVIDENCE  "
        # Latin paths and URLs remain left-to-right in both editions.
        parts = wrap(prefix+txt,CW,"Helvetica",6.5,"en")
        self.need(len(parts)*9+7)
        self.c.setFont("Helvetica",6.5);self.c.setFillColor(MUTED)
        for p in parts:
            self.c.drawString(L,self.y,p);self.y-=9
        self.y-=7

    def h1(self,en,ar,index=None):
        title=label(en,ar,self.lang)
        self.new(title)
        if index is not None: self.chapter_pages[index]=self.page
        self.c.setFillColor(PALE)
        self.c.rect(L,self.y-76,CW,76,fill=1,stroke=0)
        self.c.setFillColor(BLUE)
        self.c.rect(W-R-5 if self.lang=="ar" else L,self.y-76,5,76,fill=1,stroke=0)
        self.y-=27
        self.para(title,size=18 if self.lang=="ar" else 19,leading=29,gap=23,bold=True,indent=13)
        self.y-=25

    def h2(self,en,ar):
        txt=label(en,ar,self.lang)
        self.need(44)
        self.y-=5
        self.line(txt,W-R if self.lang=="ar" else L,self.y,12.5,True,NAVY)
        self.y-=16
        self.c.setStrokeColor(LINE);self.c.line(L,self.y,W-R,self.y)
        self.y-=16

    def table(self, headers, rows, src="", small=False, compact=False):
        self.table_no+=1
        caption=label("Table", "جدول", self.lang)+f" {self.table_no}"
        if self.lang=="ar":
            headers=list(reversed(headers));rows=[list(reversed(r)) for r in rows]
        n=len(headers)
        widths=[CW/n]*n
        if n==2: widths=[CW*.37,CW*.63]
        if n==3: widths=[CW*.27,CW*.35,CW*.38]
        if n==4: widths=[CW*.23,CW*.27,CW*.27,CW*.23]
        font="Cairo" if self.lang=="ar" else "Helvetica"
        fs=8.0 if self.lang=="ar" else (7.2 if small else 8.0)
        lead=13.5 if self.lang=="ar" else (10.2 if small else 11.8)
        def row_layout(cells):
            cell_lines=[wrap(str(t),widths[i]-11,font,fs,self.lang) for i,t in enumerate(cells)]
            return cell_lines, max(len(v) for v in cell_lines)*lead+(8 if compact else 11)
        self.need(16+row_layout(headers)[1]+(row_layout(rows[0])[1] if rows else 0))
        self.tables.append((caption,self.page))
        self.line(caption,W-R if self.lang=="ar" else L,self.y,8,True,BLUE)
        self.y-=16
        def drawrow(cells,head=False):
            nonlocal widths
            cell_lines,height=row_layout(cells)
            self.need(height)
            x=L
            self.c.setFillColor(NAVY if head else (PALE if (self.table_no+int(self.y))%2==0 else WHITE))
            self.c.rect(L,self.y-height,CW,height,fill=1,stroke=0)
            self.c.setStrokeColor(LINE);self.c.line(L,self.y-height,W-R,self.y-height)
            for i,lines in enumerate(cell_lines):
                xx=x+widths[i]-6 if self.lang=="ar" else x+6
                yy=self.y-(7 if compact else 8)-lead*.75
                for ln in lines:
                    self.line(ln,xx,yy,fs,head,WHITE if head else INK)
                    yy-=lead
                x+=widths[i]
            self.y-=height
        drawrow(headers,True)
        for row in rows:
            if self.y-row_layout(row)[1]< BOT+12:
                self.new();drawrow(headers,True)
            drawrow(row)
        self.y-=8 if compact else 10
        self.source(src)

    def flow(self,title,labels,src="",note=""):
        self.figure_no+=1
        self.need(155)
        caption=label("Figure", "شكل", self.lang)+f" {self.figure_no}  |  "+title
        self.figures.append((caption,self.page))
        self.line(caption,W-R if self.lang=="ar" else L,self.y,8,True,BLUE)
        self.y-=18
        cols=min(4,len(labels)); bw=(CW-(cols-1)*10)/cols
        rows=math.ceil(len(labels)/cols)
        order=list(reversed(labels)) if self.lang=="ar" else labels
        for ri in range(rows):
            batch=order[ri*cols:(ri+1)*cols]
            yy=self.y-ri*56
            for ci,item in enumerate(batch):
                x=L+ci*(bw+10)
                self.c.setFillColor(PALE);self.c.roundRect(x,yy-37,bw,38,4,fill=1,stroke=0)
                self.c.setStrokeColor(BLUE);self.c.line(x,yy-37,x,yy+1)
                bits=wrap(item,bw-12,"Cairo" if self.lang=="ar" else "Helvetica",7.5,self.lang)
                for j,t in enumerate(bits[:3]):
                    self.line(t,x+bw-6 if self.lang=="ar" else x+6,yy-14-j*10,7.5,False,NAVY)
                if ci < len(batch)-1:
                    self.c.setStrokeColor(BLUE);self.c.line(x+bw+1,yy-18,x+bw+9,yy-18)
        self.y-=rows*56+8
        if note:self.para(note,size=7.6,color=MUTED,gap=3)
        self.source(src)

    def chart(self,title,values,unit,src=""):
        self.figure_no+=1
        self.need(155)
        caption=label("Figure","شكل",self.lang)+f" {self.figure_no}  |  "+title
        self.figures.append((caption,self.page))
        self.line(caption,W-R if self.lang=="ar" else L,self.y,8,True,BLUE)
        self.y-=20
        plot_y=self.y-94
        self.c.setStrokeColor(LINE);self.c.line(L+10,plot_y,W-R-10,plot_y)
        maxv=max(1,max(abs(v) for v in values))
        bw=65;gap=(CW-4*bw)/5
        for i,(year,v) in enumerate(zip([1,3,5,10],values)):
            x=L+gap+(bw+gap)*i
            bh=65*abs(v)/maxv
            if v>=0:
                self.c.setFillColor(BLUE);self.c.rect(x,plot_y,bw,bh,fill=1,stroke=0)
            else:
                self.c.setFillColor(colors.HexColor("#D87870"));self.c.rect(x,plot_y-10,bw,10,fill=1,stroke=0)
            value=f"{v:,.1f}{unit}"
            self.line(value,x+bw/2,plot_y+bh+7 if v>=0 else plot_y-18,7,True,INK,right=False)
            self.line(f"Y{year}",x+bw/2,plot_y-31,7,False,MUTED,right=False)
        self.y=plot_y-44
        self.source(src)

    def close(self):
        self._footer();self.c.save()

def render_cover(b):
    lang=b.lang
    # Cover
    b.new()
    b.c.setFillColor(NAVY);b.c.rect(0,0,W,H,fill=1,stroke=0)
    b.c.setFillColor(BLUE);b.c.rect(0,H-18,W,18,fill=1,stroke=0)
    logo=ROOT/"client/public/text-logo-color.png"
    if logo.exists(): b.c.drawImage(str(logo),L,H-160,width=210,height=53,preserveAspectRatio=True,mask="auto")
    b.y=H-255
    b.line("TAZDAN",W-R if lang=="ar" else L,b.y,38,True,WHITE);b.y-=59
    b.para(label("Financial Infrastructure for Libya and Beyond","بنية مالية لليبيا وما بعدها",lang),19,31,WHITE,32,True)
    b.para(label("The Tazdan Manifesto","مانيفستو تزدان",lang),25,38,WHITE,12,True)
    b.para(label("Technology, Product, Payments, Remittance, Financial Infrastructure and Growth Strategy",
                 "البنية التقنية، المنتج، المدفوعات، الحوالات، البنية المالية واستراتيجية النمو",lang),13,24,WHITE,45)
    b.line(label("ENGLISH EDITION","النسخة الليبية العربية",lang),W-R if lang=="ar" else L,b.y,10,True,colors.HexColor("#A8DFF6"));b.y-=30
    b.line("06 OCT 2026  |  VERSION 1.0",W-R if lang=="ar" else L,b.y,9,False,WHITE);b.y-=20
    b.line("CONFIDENTIAL / INVESTOR & STRATEGIC REVIEW",W-R if lang=="ar" else L,b.y,8,True,WHITE)

def render(path:Path,lang:str,toc=None):
    b=Book(path,lang,toc)
    render_cover(b)
    # Inside cover and notices
    b.new(label("Purpose and notices","الغرض والتنبيهات",lang))
    b.h2("Purpose and notices","الغرض والتنبيهات")
    b.para(label("This book assesses Tazdan as a technology and potential regulated operating system. It separates reviewed code, public claims, proposals and assumptions. It is not an audit opinion, legal advice, offering memorandum, licence confirmation or guarantee of future performance.",
                 "يقيّم هذا الكتاب تزدان كتقنية ونظام تشغيل مالي محتمل تحت التنظيم. ويفصل بين الشفرة المراجعة وادعاءات الموقع والمقترحات والافتراضات. ليس رأي تدقيق أو استشارة قانونية أو مذكرة طرح أو إثبات ترخيص أو ضمان أداء مستقبلي.",lang))
    b.para(label("Review cut-off: 6 October 2026; repository commit 01de005. Public pages were read on that date. No production credentials, live transaction database, contracts or licensing certificates were supplied. Financial figures are illustrative unless explicitly sourced.",
                 "تاريخ إقفال المراجعة: 6 أكتوبر 2026، والالتزام 01de005. قُرئت الصفحات العامة في ذلك التاريخ. لم تتوفر بيانات إنتاج أو قاعدة عمليات حية أو عقود أو شهادات ترخيص. كل رقم مالي توضيحي ما لم يذكر مصدره صراحة.",lang))
    b.h2("How to read","طريقة القراءة")
    b.para(label("Read the executive summary first, then the claim audit and gaps. Technical readers can use the generated model, enum and API appendices. A file path after a paragraph points to the evidence. PROPOSAL and ASSUMPTION identify non-operational designs and forecasts.",
                 "ابدأ بالملخص، ثم راجع تدقيق الادعاءات والفجوات. يمكن للفريق التقني استخدام ملاحق النماذج والتعدادات والواجهات المولدة. مسار الملف بعد الفقرة يدل على الدليل. وسم مقترح أو افتراض يعني أن الوصف ليس تشغيلًا حالياً.",lang))
    b.h2("Key facts","حقائق أساسية")
    rows=[
      ("Prisma models","نماذج Prisma",str(len(MODELS))),
      ("Enums","تعدادات",str(len(ENUMS))),
      ("Route declarations","تعريفات المسارات",str(len(ENDPOINTS))),
      ("Expo route files","ملفات مسارات الهاتف",str(len(SCREENS))),
      ("Status","الحالة",label("Pre-launch; licensing and partners unverified","قبل الإطلاق؛ الترخيص والشركاء غير مثبتين",lang)),
    ]
    b.table([label("Metric","المقياس",lang),label("Reading","القراءة",lang)],
            [[label(a,aa,lang),v] for a,aa,v in rows],"server/prisma/schema.prisma; server/src/index.ts; mobile/app")
    # Fixed two pages for front matter lists.
    b.new(label("Contents","المحتويات",lang));b.h2("Contents","المحتويات")
    toc=toc or {}
    chapter_toc=toc.get("chapters",{})
    for i,ch in enumerate(CHAPTERS,1):
        title=label(ch["en"],ch["ar"],lang)
        b.need(29)
        b.line(f"{i:02d}",W-R if lang=="ar" else L,b.y,8,True,BLUE)
        b.line(title,W-R-35 if lang=="ar" else L+35,b.y,9.3,False,INK)
        b.line(str(chapter_toc.get(i,"--")),L+3 if lang=="ar" else W-R,b.y,9,True,NAVY,right=lang!="ar")
        b.y-=26
    b.new(label("Figures and tables","الأشكال والجداول",lang));b.h2("Figures and tables","الأشكال والجداول")
    b.para(label("Figures and tables are numbered at their place of use. All figures distinguish verified code from proposed flows.",
                 "ترقم الأشكال والجداول عند موضعها. وتفرق الرسوم بين ما تثبته الشفرة والمسارات المقترحة.",lang),8.5)
    for item in (toc.get("figures",[])[:10]):
        b.para(item[0]+"  " + str(item[1]),8.2,gap=5)
    b.h2("Table guide","دليل الجداول")
    for item in (toc.get("tables",[])[:12]):
        b.para(item[0]+"  " + str(item[1]),8.2,gap=5)
    # Chapters
    for i,ch in enumerate(CHAPTERS,1):
        b.h1(ch["en"],ch["ar"],i)
        for block in ch["blocks"]:
            if block["kind"]=="p":
                b.para(block[lang],gap=block.get("gap",10));b.source(block.get("src",""))
            elif block["kind"]=="h":b.h2(block["en"],block["ar"])
            elif block["kind"]=="flow":
                b.flow(block["en_title"] if lang=="en" else block["ar_title"],
                       block["en_labels"] if lang=="en" else block["ar_labels"],
                       block.get("src",""),block.get("note_en","") if lang=="en" else block.get("note_ar",""))
            elif block["kind"]=="table":
                headers=block["en_headers"] if lang=="en" else block["ar_headers"]
                rows=[list(r[0] if lang=="en" else r[1]) for r in block["rows"]]
                b.table(headers,rows,block.get("src",""),compact=block.get("compact",False))
        if ch["en"]=="Financial scenarios and capital": financial_append(b,lang)
        if ch["en"]=="Investment thesis, roadmap and risk": risk_append(b,lang)
    appendices(b,lang)
    result={"chapters":b.chapter_pages,"figures":b.figures,"tables":b.tables,"pages":b.page}
    b.close()
    return result

def financial_append(b:Book,lang:str):
    b.h2("Scenario assumptions","افتراضات السيناريوهات")
    b.para(label("Inputs below are illustrative and use USD equivalents. International remittance is a share of total volume, not additional volume. Partner costs are the variable-cost difference between revenue and gross profit. Operating expense includes technology, compliance and marketing; remaining expense covers people, operations, legal and overhead.",
                 "المدخلات التالية توضيحية وبمعادل الدولار. حجم الحوالات الدولية جزء من الحجم الكلي وليس إضافة عليه. كلفة الشركاء والمتغيرات هي الفرق بين الإيراد والربح الإجمالي. تشمل المصاريف التشغيلية التقنية والامتثال والتسويق؛ والباقي للموظفين والتشغيل والقانون والمصاريف العامة.",lang),8.7)
    for name,arname in [("Conservative","متحفظ"),("Base","أساسي"),("Upside","متفائل")]:
        b.h2(name+" scenario", "السيناريو "+arname)
        rr=financial_rows(name)
        heads=label(["Metric","Y1","Y3","Y5","Y10"],["المقياس","س1","س3","س5","س10"],lang)
        metrics=[
          ("Registered users","المستخدمون المسجلون",lambda r:f"{r['users']:,}"),
          ("Monthly active","النشطون شهرياً",lambda r:f"{r['mau']:,}"),
          ("Business accounts","حسابات الأعمال",lambda r:f"{r['biz']:,}"),
          ("Tx / active / month","عمليات / نشط / شهر",lambda r:f"{r['freq']:.1f}"),
          ("Avg ticket USD","متوسط USD",lambda r:f"{r['ticket']:.0f}"),
          ("Annual volume USD m","حجم سنوي مليون USD",lambda r:f"{r['volume_m']:,.1f}"),
          ("Remittance USD m","حوالات مليون USD",lambda r:f"{r['remit_m']:,.1f}"),
          ("Take rate","نسبة العائد",lambda r:f"{r['take']*100:.1f}%"),
          ("Revenue USD m","إيراد مليون USD",lambda r:f"{r['revenue_m']:,.2f}"),
          ("Gross profit USD m","ربح إجمالي مليون USD",lambda r:f"{r['gp_m']:,.2f}"),
          ("Operating expense USD m","تشغيل مليون USD",lambda r:f"{r['opex_m']:,.2f}"),
          ("EBITDA USD m","EBITDA مليون USD",lambda r:f"{r['ebitda_m']:,.2f}"),
          ("Net income USD m","صافي مليون USD",lambda r:f"{r['net_m']:,.2f}"),
          ("Employees","الموظفون",lambda r:f"{r['staff']:,}"),
          ("Partner costs USD m","كلفة شركاء مليون USD",lambda r:f"{r['partner_m']:,.2f}"),
          ("Technology USD m","تقنية مليون USD",lambda r:f"{r['tech_m']:,.2f}"),
          ("Compliance USD m","امتثال مليون USD",lambda r:f"{r['compliance_m']:,.2f}"),
          ("Marketing USD m","تسويق مليون USD",lambda r:f"{r['marketing_m']:,.2f}"),
          ("Liquidity USD m","سيولة مليون USD",lambda r:f"{r['liquidity_m']:,.2f}"),
          ("Indicative capital USD m","رأس مال تقريبي مليون USD",lambda r:f"{r['capital_m']:,.2f}"),
        ]
        rows=[[label(en,ar,lang)]+[fn(r) for r in rr] for en,ar,fn in metrics]
        b.table(heads,rows,label("ASSUMPTION: calculated model; no historical performance implied.","افتراض: نموذج محسوب؛ لا يعني أداءً تاريخياً.",lang),True)
    b.h2("Base-case trajectory","مسار السيناريو الأساسي")
    base=financial_rows("Base")
    for en,ar,key,unit in [
        ("Revenue","الإيراد","revenue_m","m"),("Gross profit","الربح الإجمالي","gp_m","m"),
        ("EBITDA","EBITDA","ebitda_m","m"),("Monthly active users","المستخدمون النشطون شهرياً","mau",""),
        ("Annual payment volume","حجم المدفوعات السنوي","volume_m","m"),("International remittance volume","حجم الحوالات الدولية","remit_m","m"),
    ]:
        vals=[r[key]/1000 if key=="mau" else r[key] for r in base]
        u="k" if key=="mau" else unit
        b.chart(label(en,ar,lang),vals,u,"ASSUMPTION: base-case formula in scenario tables")
    b.h2("Capital by milestone","رأس المال حسب المرحلة")
    cap=[
      (("Lean pilot","USD 1.5-3m","One corridor, legal, controls, small prefund"),("تجربة محدودة","1.5-3 ملايين USD","ممر واحد وقانون وضوابط وسيولة صغيرة")),
      (("Regulated Libya launch","USD 4-8m","Licensing, team, partner ops, domestic float"),("إطلاق منظم بليبيا","4-8 ملايين USD","ترخيص وفريق وشركاء وسيولة محلية")),
      (("Multi-corridor","USD 10-20m","Payout prefund, compliance, redundancy"),("عدة ممرات","10-20 مليون USD","سيولة دفع وامتثال وتكرار بنية")),
      (("Regional expansion","USD 25-50m","New jurisdictions, sales, liquidity, acquisitions"),("توسع إقليمي","25-50 مليون USD","اختصاصات ومبيعات وسيولة واستحواذات")),
    ]
    b.table(label(["Stage","Indicative need","Main uses"],["المرحلة","حاجة تقريبية","أوجه الصرف"],lang),
            [list(x[0] if lang=="en" else x[1]) for x in cap],"ASSUMPTION: gross capital planning ranges, not an offer")
    b.h2("Market sizing sensitivity","حساسية تقدير السوق")
    b.para(label("Illustration only: 7.46m people × eligible active share × 2 payments per month × USD 150 × 12. A serviceable market would then be the legally reachable share; obtainable volume depends on actual distribution. No measured corridor TAM is asserted.",
                 "مثال فقط: 7.46 مليون نسمة × حصة نشطة مؤهلة × دفعتين شهرياً × 150 دولار × 12. السوق القابل للخدمة هو الجزء الممكن قانوناً، والممكن كسبه يعتمد على التوزيع الفعلي. لا ندعي وجود TAM مقاس للممرات.",lang),8.7)
    sens=[]
    for share in [.10,.20,.30]:
        vol=7.46e6*share*2*150*12/1e9
        sens.append([f"{share*100:.0f}%",f"{vol:.2f}",f"{vol*.2:.2f}",f"{vol*.2*.05:.2f}"])
    b.table(label(["Eligible share","TAM USD bn","SAM at 20% bn","SOM at 5% bn"],["حصة مؤهلة","TAM مليار USD","SAM عند 20%","SOM عند 5%"],lang),sens,
            "ASSUMPTION; population baseline: https://data.worldbank.org/country/libya")

def risk_append(b:Book,lang:str):
    b.h2("Qualitative risk register","سجل المخاطر النوعي")
    heads=label(["Risk","Likelihood","Impact","Mitigation","Residual"],["الخطر","الاحتمال","الأثر","المعالجة","المتبقي"],lang)
    rows=[]
    for en,ar,le,la,ie,ia,me,ma,re,ra in RISK_ROWS:
        rows.append([en,le,ie,me,re] if lang=="en" else [ar,la,ia,ma,ra])
    b.table(heads,rows,"ASSUMPTION: qualitative judgement; not observed loss frequencies")

def appendices(b:Book,lang:str):
    b.h1("Appendices and inventories","الملاحق والجرد")
    b.h2("A. Repository and technical stack","أ. المستودع والمكونات")
    b.para(label("Mobile: Expo 54, React Native 0.81, Expo Router, Zustand and React Query. Web: Next.js 14, React 18, Chakra/MUI. Server: Express 4, TypeScript, Prisma 5, PostgreSQL, Redis, Socket.IO, Sentry. Deployment manifests: Docker Compose, nginx and backup scripts. Versions are package-manifest declarations, not a production bill of materials.",
                 "الهاتف: Expo 54 وReact Native 0.81 وExpo Router وZustand وReact Query. الويب: Next.js 14 وReact 18 وChakra/MUI. الخادم: Express 4 وTypeScript وPrisma 5 وPostgreSQL وRedis وSocket.IO وSentry. توجد ملفات Docker Compose وnginx ونسخ احتياطي. الإصدارات من ملفات الحزم ولا تثبت مكونات الإنتاج الفعلية.",lang),8.6)
    b.source("server/package.json; mobile/package.json; client/package.json; docker-compose.prod.yml")
    b.h2("B. Database model inventory","ب. جرد نماذج قاعدة البيانات")
    b.table(label(["Model","Fields","Selected fields"],["النموذج","الحقول","حقول مختارة"],lang),
            [[n,str(count),fields] for n,count,fields in MODELS],"server/prisma/schema.prisma",True)
    b.h2("C. Enum inventory","ج. جرد التعدادات")
    b.table(label(["Enum","Values"],["التعداد","القيم"],lang),[[n,v] for n,v in ENUMS],"server/prisma/schema.prisma",True)
    b.h2("D. API route inventory","د. جرد مسارات API")
    b.para(label("Static declarations include routes that may be feature-gated or provider-dependent. Access is inferred from route middleware; inspect controller checks before exposing any endpoint.",
                 "هذا جرد لتعريفات ساكنة، وبعضها مقيد بخاصية أو مزود. صُنّف الوصول من وسائط المسار؛ ويجب فحص المتحكم قبل نشر أي واجهة.",lang),8.4)
    counts=Counter(x[0] for x in ENDPOINTS)
    b.table(label(["Domain","Routes"],["المجال","المسارات"],lang),[[k,str(v)] for k,v in sorted(counts.items())],"server/src/routes; server/src/index.ts",True)
    for domain in sorted(counts):
        b.need(130)
        b.h2(domain,domain)
        b.table(label(["Method","Path","Access"],["الطريقة","المسار","الوصول"],lang),
                [[m,p,a] for d,m,p,a,_ in ENDPOINTS if d==domain],f"server/src/routes/{domain}.ts" if domain!="core" else "server/src/index.ts",True)
    b.h2("E. Mobile route inventory","هـ. جرد مسارات الهاتف")
    b.table(label(["Route file","Route file"],["ملف المسار","ملف المسار"],lang),
            [[SCREENS[i], SCREENS[i+1] if i+1<len(SCREENS) else ""] for i in range(0,len(SCREENS),2)],"mobile/app",True)
    b.h2("F. Controls, tests and integration gaps","و. الضوابط والاختبارات والفجوات")
    rows=[
      ("Ledger", "ledger.service; reconcile; fundIntegrity; ledger/concurrency/financialFlows tests", "الدفتر", "خدمة الدفتر والمطابقة وسلامة الأموال واختبارات التزامن"),
      ("Provider", "KYC Sumsub adapter; Stripe/Checkout on-ramp; mock off-ramp; mock card issuer", "المزودون", "موصل Sumsub وStripe/Checkout للإيداع؛ صرف ومُصدر بطاقة تجريبيان"),
      ("Security", "rate limiters, JWT, 2FA, KMS option, step-up, audit logs", "الأمن", "حدود طلبات وJWT وتحقق ثنائي وخيار KMS وتحقق إضافي وتدقيق"),
      ("Readiness", "daily-close, provider failure, stale FX and hot-wallet alerts", "الجاهزية", "إقفال يومي وأعطال مزود وسعر قديم وحد محفظة ساخنة"),
      ("Unverified", "licences, contracts, bank safeguarding, telemetry, penetration attestation", "غير مثبت", "تراخيص وعقود وحماية مصرفية وقياسات إنتاج وتدقيق اختراق"),
    ]
    b.table(label(["Area","Current evidence"],["المجال","الدليل الحالي"],lang),
            [[a,bb] if lang=="en" else [aa,bbb] for a,bb,aa,bbb in rows],"server/src; docs/runbooks; https://www.tazdan.com/trust")
    b.h2("G. Glossary and acronyms","ز. المصطلحات والاختصارات")
    b.table(label(["Term","Meaning","Arabic"],["المصطلح","المعنى الإنجليزي","العربي"],lang),
            [[a,bb,aa] for a,bb,aa in GLOSSARY],"Editorial definitions")
    b.h2("H. References","ح. المراجع")
    b.table(label(["ID","Source","Location"],["رمز","المصدر","الموقع"],lang),
            [[a,bb,cc] for a,bb,cc in REFERENCES],"Sources accessed 6 October 2026",True)
    b.h2("I. Index","ط. الفهرس الموضوعي")
    index_terms=[("Architecture","البنية"),("Business","الأعمال"),("Compliance","الامتثال"),
                 ("Custody","الحفظ"),("Financial model","النموذج المالي"),("Ledger","الدفتر"),
                 ("Market","السوق"),("Remittance","الحوالات"),("Risk","المخاطر"),("Treasury","الخزينة")]
    targets=[4,3,10,11,16,6,14,7,18,9]
    b.table(label(["Subject","Chapter page"],["الموضوع","صفحة الفصل"],lang),
            [[label(en,ar,lang),str(b.chapter_pages.get(idx,"--"))] for (en,ar),idx in zip(index_terms,targets)],"Generated from this edition")

def export_markdown(lang:str,path:Path):
    lines=["# "+label("The Tazdan Manifesto - English Edition","مانيفستو تزدان - النسخة الليبية العربية",lang),"", "6 October 2026 | Version 1.0 | Confidential", ""]
    for i,ch in enumerate(CHAPTERS,1):
        lines += [f"## {i}. {ch[lang]}",""]
        for block in ch["blocks"]:
            k=block["kind"]
            if k=="p":lines += [block[lang],"",label("Evidence: ","الدليل: ",lang)+block.get("src",""),""]
            elif k=="h":lines += ["### "+block[lang],""]
            elif k=="flow":lines += ["**"+block[lang+"_title"]+"**", " → ".join(block[lang+"_labels"]), ""]
            elif k=="table":
                heads=block[lang+"_headers"]
                lines += ["|"+"|".join(heads)+"|","|"+"|".join(["---"]*len(heads))+"|"]
                for pair in block["rows"]: lines.append("|"+"|".join(pair[0] if lang=="en" else pair[1])+"|")
                lines += ["",label("Evidence: ","الدليل: ",lang)+block.get("src",""),""]
    lines += ["## Appendices", "", "Model, enum, route, mobile and financial inventories are generated by build_tazdan_manifesto.py from the reviewed repository.",""]
    path.write_text("\n".join(lines),encoding="utf-8")

def rebrand_existing(path:Path,lang:str):
    """Update the cover and metadata while preserving the reviewed report body."""
    from pypdf import PdfReader, PdfWriter
    cover_path=path.with_name('.cover-'+path.name)
    replacement=path.with_name('.replacement-'+path.name)
    book=Book(cover_path,lang)
    render_cover(book)
    book.close()
    original=PdfReader(path)
    writer=PdfWriter()
    writer.clone_document_from_reader(original)
    writer.remove_page(0)
    writer.insert_page(PdfReader(cover_path).pages[0],0)
    writer.add_metadata({'/Title':label('The Tazdan Manifesto - English Edition','مانيفستو تزدان - النسخة الليبية',lang)})
    with replacement.open('wb') as stream:
        writer.write(stream)
    result=PdfReader(replacement)
    assert len(result.pages)==len(original.pages)
    assert all(a.extract_text()==b.extract_text() for a,b in zip(original.pages[1:],result.pages[1:])), 'Reviewed report body changed'
    replacement.replace(path)
    cover_path.unlink()
    print(lang,len(result.pages),path,'(branding updated; reviewed body preserved)')

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    if '--branding-only' in sys.argv:
        for lang,name in [('en','Tazdan_Manifesto_English.pdf'),('ar','Tazdan_Manifesto_Libyan_Arabic.pdf')]:
            rebrand_existing(OUT/name,lang)
        return
    print(f"Inventory: {len(MODELS)} models, {len(ENUMS)} enums, {len(ENDPOINTS)} endpoints, {len(SCREENS)} mobile routes")
    for lang,name in [("en","Tazdan_Manifesto_English.pdf"),("ar","Tazdan_Manifesto_Libyan_Arabic.pdf")]:
        target=OUT/name
        scratch=OUT/(".pass1-"+name)
        first=render(scratch,lang)
        final=render(target,lang,first)
        scratch.unlink(missing_ok=True)
        export_markdown(lang,SOURCE/("Tazdan_Manifesto_"+("English" if lang=="en" else "Libyan_Arabic")+".md"))
        print(lang,final["pages"],target)

if __name__=="__main__":main()
