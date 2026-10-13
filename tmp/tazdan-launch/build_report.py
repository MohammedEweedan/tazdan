from pathlib import Path
import json, html, math
from datetime import date
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

ROOT=Path('/Users/moe/Downloads/promrkts')
DATA=json.loads((ROOT/'tmp/tazdan-launch/results.json').read_text())
R={x['name']:x for x in DATA['results']}
OUT=ROOT/'output/pdf/Tazdan_Launch_Readiness_and_Returns.pdf'
OUT.parent.mkdir(parents=True,exist_ok=True)
FONT=Path('/System/Library/Fonts/Supplemental')
for n,f in [('Body','Arial.ttf'),('Bold','Arial Bold.ttf'),('Italic','Arial Italic.ttf')]:pdfmetrics.registerFont(TTFont(n,str(FONT/f)))
W,H=A4;M=43;CW=W-2*M
INK=colors.HexColor('#172D42');BLUE=colors.HexColor('#039CCD');PALE=colors.HexColor('#EAF5FA');GRAY=colors.HexColor('#526575');LINE=colors.HexColor('#D7E2E9');GREEN=colors.HexColor('#16745C');RED=colors.HexColor('#A13232')
ST={n:ParagraphStyle(n,fontName=font,fontSize=sz,leading=lead,textColor=color) for n,font,sz,lead,color in [('body','Body',10.4,15.1,INK),('small','Body',9,12.6,GRAY),('cell','Body',9.3,12.7,INK),('head','Bold',14,18,INK)]}
c=canvas.Canvas(str(OUT),pagesize=A4,pageCompression=1);c.setTitle('Tazdan | Launch readiness and returns | $1.6m capital');c.setAuthor('Tazdan');c.setSubject('Evidence review and conditional bank partnership financial scenarios, 13 October 2026')
page=0;y=0;current='';all_text=[]
def txt(s):return html.escape(str(s))
def money(v,dec=0):return ('('+f'${abs(v):,.{dec}f}'+')') if v<0 else f'${v:,.{dec}f}'
def short(v):return ('('+f'${abs(v)/1e6:.2f}m'+')') if v<0 else (f'${v/1e6:.2f}m' if v>=1e6 else money(v))
def date_for(m):
    if not m:return 'Not reached in 60 months'
    num=2026*12+9+(m-1);return date(num//12,num%12+1,1).strftime('%b %Y')
def footer():
    c.setStrokeColor(LINE);c.setLineWidth(.5);c.line(M,47,W-M,47)
    c.setFillColor(GRAY);c.setFont('Body',7.6);c.drawString(M,31,'13 October 2026  |  Company capital: $1.6m  |  Forecasts in USD')
    c.setFont('Bold',8);c.drawRightString(W-M,31,f'{page:02d} / 10')
def start(title,kicker):
    global page,y,current
    if page:
        if y<62:raise RuntimeError(f'Overflow page {page} {current}: {y}')
        footer();c.showPage()
    page+=1;current=title
    c.setFillColor(BLUE);c.rect(0,H-7,W,7,fill=1,stroke=0)
    c.setFillColor(GRAY);c.setFont('Bold',8);c.drawString(M,H-36,'TAZDAN / LAUNCH & INVESTMENT REVIEW')
    c.setFont('Body',8);c.drawRightString(W-M,H-36,kicker.upper())
    p=Paragraph(txt(title),ParagraphStyle('title',fontName='Bold',fontSize=27,leading=32,textColor=INK));p.wrap(CW,150);p.drawOn(c,M,H-66-p.height);y=H-66-p.height-17
    all_text.append('\n\n'+title+'\n')
def para(text,style='body',width=None,x=None):
    global y
    pp=Paragraph(text,ST[style]);pp.wrap(width or CW,1200)
    if y-pp.height<63:raise RuntimeError(f'Paragraph overflow on {page}: {text[:60]}')
    pp.drawOn(c,x or M,y-pp.height);y-=pp.height+10;all_text.append(text)
def heading(text):para(txt(text),'head')
def callout(text):
    global y
    pp=Paragraph(text,ST['body']);pp.wrap(CW-26,1200);hh=pp.height+24
    if y-hh<62:raise RuntimeError(f'Callout overflow on {page}')
    c.setFillColor(PALE);c.roundRect(M,y-hh,CW,hh,6,fill=1,stroke=0);pp.drawOn(c,M+13,y-12-pp.height);y-=hh+14;all_text.append(text)
def table(headers,body,widths):
    global y
    assert abs(sum(widths)-CW)<1
    for i,row in enumerate([headers]+body):
        pp=[]
        for vv,ww in zip(row,widths):
            p=Paragraph(('<b>'+str(vv)+'</b>') if i==0 else str(vv),ST['cell']);p.wrap(ww-14,1000);pp.append(p)
        rh=max(p.height for p in pp)+14
        if y-rh<64:raise RuntimeError(f'Table overflow page {page} row {i}')
        c.setFillColor(PALE if i==0 else (colors.HexColor('#F5F8FA') if i%2 else colors.white));c.rect(M,y-rh,CW,rh,fill=1,stroke=0)
        xx=M
        for p,ww in zip(pp,widths):p.drawOn(c,xx+7,y-7-p.height);xx+=ww
        c.setStrokeColor(LINE);c.setLineWidth(.35);c.line(M,y-rh,W-M,y-rh);y-=rh
        all_text.append(' | '.join(map(str,row)))
    y-=14
def chart_cash():
    global y
    top=y;hh=185;bottom=top-hh;left=M+42;right=W-M-4
    lo=-.6;hi=6
    def yy(v):return bottom+(v/1e6-lo)/(hi-lo)*hh
    for tick in [0,2,4,6]:
        z=yy(tick*1e6);c.setStrokeColor(LINE);c.setLineWidth(.5);c.line(left,z,right,z)
        c.setFillColor(GRAY);c.setFont('Body',8);c.drawRightString(left-7,z-3,f'${tick}m')
    c.setStrokeColor(colors.HexColor('#BD5353'));c.setLineWidth(.8);c.line(left,yy(0),right,yy(0))
    for key,color in [('Base',GRAY),('Bank-supported',GREEN),('Upside',BLUE)]:
        pp=c.beginPath()
        for j,v in enumerate(R[key]['months']):
            xx=left+j/59*(right-left);z=yy(v['cash'])
            if j==0:pp.moveTo(xx,z)
            else:pp.lineTo(xx,z)
        c.setStrokeColor(color);c.setLineWidth(1.9);c.drawPath(pp)
    for m in [1,12,24,36,48,60]:
        xx=left+(m-1)/59*(right-left);c.setFillColor(GRAY);c.setFont('Body',8);c.drawCentredString(xx,bottom-15,f'M{m}')
    for i,(label,color) in enumerate([('Base',GRAY),('Bank-supported',GREEN),('Upside',BLUE)]):
        xx=M+55+i*145;c.setStrokeColor(color);c.setLineWidth(2);c.line(xx,bottom-35,xx+17,bottom-35);c.setFillColor(INK);c.setFont('Body',8);c.drawString(xx+22,bottom-38,label)
    y=bottom-55

# 1
start('Your money.\nYour next move.','01 / decision')
para('Launch readiness, success outlook and investment returns for Tazdan. The founder reports a prospective <b>Libyan bank partner</b>; commercial terms remain unknown. This review treats $1.6m as company cash, with no founder withdrawal.','small')
callout('<b>Decision: finance a scoped partner-led pilot; do not open broad real-money services yet.</b> The build has substantial financial controls. Authorization, live contracts, security acceptance, physical-device QA and recovery evidence still need to support the exact launch scope.')
table(['Question','Finding'],[
 ['Ready to launch?','Not ready for a public real-money launch. Prepare one approved product/corridor for a controlled pilot.'],
 ['Can $1.6m be enough?','Yes under the conditional Bank-supported cost profile. Under standard Base costs, an extra '+money(R['Base']['peakFundingDeficit']+200000)+' is required to preserve the $200k reserve.'],
 ['When is operating break-even?','Bank-supported: M29 ('+date_for(29)+'). Base: M44 ('+date_for(44)+'), conditional on funding the gap.'],
 ['What could the company earn?','Bank-supported: '+money(R['Bank-supported']['years'][2]['op'])+' Year-3 operating profit and '+money(R['Bank-supported']['years'][4]['op'])+' in Year 5.'],
 ['When is the full investment recovered?','Beyond 60 months in Base and Bank-supported. Upside reaches modeled free-cash payback in M50.'],
 ],[130,CW-130])
para('<b>Success judgment:</b> roughly 25–45% today for sustaining three profitable months by M36 without extra equity. A signed, workable bank agreement that enables the Bank-supported costs could raise the planning judgment to roughly 45–65%. These are subjective decision ranges, not measured probabilities.',style='small')
para('The new slogan is applied to English/Arabic website copy, mobile brand/onboarding text, and the existing investment-memorandum cover. The slogan focuses on everyday use and does not promise instant global availability or a guaranteed exchange rate.',style='small')

# 2
start('How ready is the product?','02 / release evidence')
para('Assessment date: 13 October 2026. Reviewed the current working tree at HEAD 64b590e, including uncommitted work. No production database, private launch evidence, signed provider contracts or external audit reports were inspected. A percentage-complete score would blur these missing prerequisites.')
table(['Area','Evidence now','Acceptance still needed'],[
 ['Authorization','Public trust page says not licensed; prospective bank reported by founder.','Exact bank/technology role, activity permissions and any required regulator consent.'],
 ['Providers','Adapters, production guards, remittance sandbox controls.','Signed live rails, price schedules, settlement and reconciliation callbacks.'],
 ['Security','Session, role, custody and release controls in code.','Resolve failing revocation test; independent review/pentest and credential rotation evidence.'],
 ['Money paths','Ledger, concurrency/replay test suites and control workflows.','Fresh database/API tests for each enabled rail, real statements, no unexplained balances.'],
 ['Device QA','Mobile TypeScript passes.','Signed physical iPhone/Android tests, RTL, outages and recovery; store acceptance.'],
 ['Recovery','Backup/restore runbooks and release evidence gate.','Fresh offsite restore and PITR drill with reconciled money records.'],
 ['Operations','Cockpit, limits, audit, alerts and stop rules are implemented.','Named owners, delivered alert drill, daily close and customer complaints process.']
 ],[80,192,CW-272])
callout('<b>Fresh check result:</b> server, web and mobile TypeScript passed. Server tests: 264 passed, 1 failed, 82 skipped (347 total). The same session-revocation failure reproduced in an isolated run: 7 passed, 1 failed.')
para('The test expects a reused rotated refresh token to revoke the new access token; authentication still returned “ok” in its fake-database/no-Redis harness. Treat this as a release blocker until the cause is resolved and the actual database/API path passes. Database suites were deliberately disabled for this safe local run.',style='small')

# 3
start('The bank partnership must be concrete','03 / operating structure')
para('A Libyan bank relationship could shorten the route to service launch and improve trust, distribution and settlement access. Ownership of a bank alone does not establish that every Tazdan product can operate under its authority. The bank’s compliance/legal team and regulator must confirm the precise structure.')
table(['Workstream','Proposed responsibility to agree'],[
 ['Regulated service and customer funds','Bank: permitted accounts/payment activities, funds custody/safeguarding, customer terms and required approvals. Confirm these duties in writing.'],
 ['Technology and operations','Tazdan: app, APIs, ledger orchestration, support tooling, security, incident handling and contracted service delivery.'],
 ['KYC/AML and reporting','Allocate onboarding, beneficial ownership, screening, transaction monitoring, investigations and regulatory reporting; identify the accountable officers.'],
 ['Settlement and treasury','Confirm funding currencies, liquidity owner, netting, cutoffs, failure/reversal handling, losses and independent daily reconciliation.'],
 ['Distribution and IP','Agree channels and customer ownership, integration rights, IP ownership, exclusivity, data access, termination and migration support.']
 ],[138,CW-138])
heading('Commercial terms that determine the forecast')
para('Get a signed term sheet covering the bank fee/revenue share, direct rail prices, minimum guarantees, reserves, settlement credit, fraud liability and support responsibilities. The model assumes the bank takes <b>20% of the customer fee pool</b> in Base; execution/rail costs are separate. Replace both with the actual all-in contract and avoid double counting.')
callout('<b>Bank-supported case is conditional:</b> same Base customers, prices, bank share and company prefunding. Acquisition cost falls from $25 to $12 per activation, and fixed operating costs fall to $20k / $25k / $35k / $45k / $55k per month in Years 1–5 through shared services and distribution. None of that support is currently confirmed.')
para('A minimum platform fee paid by the bank could improve downside protection. It is excluded until agreed. Cards, card funding, crypto custody and extra corridors remain outside the pilot unless their own providers and permissions are accepted.',style='small')

# 4
start('Allocate the $1.6 million carefully','04 / capital and runway')
table(['Capital purpose','Budget','Treatment'],[
 ['Legal, contracts, bank/provider onboarding','$150,000','One-time setup cash in the first six months.'],
 ['Integration, assurance, device and launch QA','$150,000','One-time setup cash; independent security work included.'],
 ['Initial corporate settlement prefunding','$300,000','Restricted operating asset; grows with external settlement volume.'],
 ['Protected contingency reserve','$200,000','Cash buffer, excluded from ordinary spending capacity.'],
 ['Operating losses, acquisition and capex','$800,000','Remaining cash after setup, initial prefunding and reserve.'],
 ['Total company investment','$1,600,000','Customer balances are never available to finance the company.']
 ],[210,90,CW-300])
heading('What the cash forecast says')
para('Base needs the contingency in <b>M23 ('+date_for(23)+')</b> and exhausts unrestricted corporate cash in <b>M30 ('+date_for(30)+')</b>. Its worst cash deficit is '+money(R['Base']['peakFundingDeficit'])+'; preserving the reserve takes about <b>$599k extra</b>. Later Base profit figures are conditional on closing that funding gap.')
para('Bank-supported reaches a minimum unrestricted corporate cash balance of <b>'+money(R['Bank-supported']['minimumCash'])+'</b>, leaving '+money(R['Bank-supported']['minimumSpendable'])+' above the protected reserve. This case fits the $1.6m investment through the modeled 60 months without new equity.')
callout('The standard Base plan needs approximately <b>$2.20m total corporate capital</b> to preserve the reserve. Secure lower bank-supported costs or an additional committed facility before adopting that plan. Do not treat expected future growth as financing.')
heading('Release capital in stages')
para('Spend the first 30 days confirming scope and commercial economics. Approve the remaining setup budget only against a bank term sheet, integration plan and evidence owners. Release growth spending after pilot repeat usage and contribution margins are measured. Keep the prefunding and contingency policies separate from marketing cash.',style='small')

# 5
start('Unit economics before scale','05 / revenue and cost drivers')
para('Worked Base example in Year 3: one paid $450 conversion/transfer. The model charges a 1.5% percentage fee plus $3, with a 20% bank share. These are pricing assumptions, not signed provider prices. The official/parallel FX gap is not Tazdan revenue.')
table(['Transaction component','USD'],[
 ['Customer principal moved','$450.00'],['Gross percentage fee (1.5%)','$6.75'],['Gross fixed transaction fee','$3.00'],['Customer fee pool','$9.75'],['Bank share (20%)','($1.95)'],['Tazdan retained revenue','$7.80'],['Direct execution cost (0.65% of principal)','($2.93)'],['Fixed fulfillment cost','($1.25)'],['Fraud/FX-loss allowance (0.10%)','($0.45)'],['Contribution before onboarding, acquisition and fixed costs','$3.18']
 ],[CW-105,105])
para('Retained revenue margin after these transaction costs is about <b>40.7%</b>. It falls further after verification, replacements for churn, acquisition, people, compliance and infrastructure. Free internal transfers and balances held generate no assumed transaction revenue.')
heading('Demand required in the Base ramp')
para('Year-end active transacting customers: 3,000 / 8,500 / 14,000 / 21,000 / 29,000. Transactions per active customer per month: 1.2 / 1.3 / 1.4 / 1.5 / 1.6. Average ticket: $400 / $425 / $450 / $475 / $500. Monthly active churn is 4%; acquisition budgets replace churn as well as adding growth.',style='small')
para('Paid business subscriptions reach 40 / 130 / 250 / 400 / 600 accounts at $40 per month, before bank share. Their subscription revenue is separate; business transaction volume is not added a second time. Validate fee acceptance and repeat paid use with pilot cohorts before scaling.',style='small')

# 6
start('How much the company could earn','06 / conditional scenarios')
para('The table shows <b>Tazdan retained revenue / operating profit before tax</b>. Operating profit includes direct rails, loss allowance, verification, acquisition and recurring operating cash costs. One-time setup, cash tax reserves, capex and additional prefunding are in the cash forecast, not this operating-profit measure.')
table(['Scenario','Year 1','Year 3','Year 5'],[
 [n,short(R[n]['years'][0]['revenue'])+'<br/>'+short(R[n]['years'][0]['op']),short(R[n]['years'][2]['revenue'])+'<br/>'+short(R[n]['years'][2]['op']),short(R[n]['years'][4]['revenue'])+'<br/>'+short(R[n]['years'][4]['op'])]
 for n in ['Downside','Base','Bank-supported','Upside']
 ],[115,(CW-115)/3,(CW-115)/3,(CW-115)/3])
heading('Interpretation')
para('<b>Downside:</b> low fee retention and higher costs make the modeled contribution negative even before fixed operations. Cash is exhausted in M25. Do not pursue volume growth at those economics; renegotiate, reprice or stop. Later figures require large new funding and are not a financed plan.')
para('<b>Base:</b> Year-3 revenue reaches $1.55m but operations still lose $225k. Year-5 revenue reaches $4.22m and operating profit $435k. Funding is needed before that growth can happen.')
para('<b>Bank-supported:</b> identical revenue to Base; lower acquisition and shared operating costs generate about $95k Year-3 operating profit and $873k in Year 5. Year-5 free cash after the tax reserve, capex and additional prefunding is about <b>$391k</b>. This is the commercially conditional path compatible with $1.6m.')
para('<b>Upside:</b> 30,000 active users by Year 3 and 60,000 by Year 5, stronger usage, better pricing and lower bank/rail costs. It produces $1.19m Year-3 operating profit and $4.65m in Year 5. This is a demanding growth scenario, not an expected result.')
callout('<b>Your personal earnings are not the company’s revenue.</b> Personal proceeds equal an approved dividend pool multiplied by your ownership percentage, plus any agreed salary or exit proceeds. No verified cap table, dividend policy or exit value is supplied, so personal take-home and investor IRR are not estimated.')

# 7
start('Break-even and investment payback','07 / timing and cash')
table(['Measure from funding','Base','Bank-supported','Upside'],[
 ['Three profitable months reached','M44','M29','M19'],['Setup and operating losses recovered','Beyond M60','M56','M33'],['Full $1.6m free-cash payback','Beyond M60','Beyond M60','M50'],['Extra capital to preserve $200k reserve',money(R['Base']['peakFundingDeficit']+200000),'$0','$0']
 ],[215,(CW-215)/3,(CW-215)/3,(CW-215)/3])
para('<b>Operating break-even</b> means three consecutive months of positive operating profit, before tax/setup/capex. Bank-supported first has a positive month at M24, then a Year-3 cost increase interrupts profitability; sustained acceptance comes at M29. Dates assume funding in October 2026.',style='small')
para('<b>Loss recovery</b> means cumulative operating cash after planning taxes, setup and capex becomes nonnegative. <b>Full payback</b> means cumulative free cash after additional settlement prefunding earns back the entire original $1.6m. No terminal liquidity release or exit valuation is counted.',style='small')
heading('Unrestricted corporate cash over 60 months')
chart_cash()
para('The Base line below zero is an unfunded projection. It requires new capital, cost cuts or shutdown. The chart excludes customer money and the $300k initial corporate prefunding; growing prefunding reduces cash. Downside is omitted from the chart because it exhausts cash earlier and has structurally negative unit economics.',style='small')
para('Bank-supported sustained break-even: '+date_for(29)+'. Base: '+date_for(44)+'. Upside: '+date_for(19)+'. Upside full payback: '+date_for(50)+'. These are scenario outputs, not promised dates.',style='small')

# 8
start('A realistic launch schedule','08 / gated rollout')
table(['Window from now','Deliverable','Release condition'],[
 ['Days 0–30<br/>Oct–Nov 2026','Bank term sheet, product scope, responsibilities, fee/rail schedule, distribution and prefunding terms.','Bank compliance/legal confirm activity authority and approvals. Assign seven evidence-gate owners.'],
 ['Days 31–90<br/>Nov 2026–Jan 2027','Close session-test issue; integrate bank and one payout route; staged migrations; security review.','Database/API replay, races, reversals, outage recovery and live callbacks reconcile.'],
 ['Days 91–150<br/>Jan–Mar 2027','Physical-device and Arabic/English QA, backup/PITR drill, incident exercise, final customer terms.','No unaccepted exploitable high/critical findings; signed acceptance tied to release SHA.'],
 ['Around M6<br/>Mar 2027','First paid, capped pilot with 100–300 approved customers and a small business cohort.','Authorization and seven gates verified for exact market, currencies, features and providers.'],
 ['M8–10<br/>May–Jul 2027','Broader Libya rollout after 60–90 days of reliable pilot service.','Measured retention, repeat paid use, settlement success, support and positive contribution.'],
 ['M12–24','Reach 3,000 then 8,500 active transacting users in Base; deepen approved business distribution.','Growth spend tracks measured contribution and CAC; expand scope only after new gate reviews.']
 ],[100,208,CW-308])
heading('Distribution should start with the partner')
para('Pilot the bank’s existing customer base, selected payroll/business users and approved family-payment use cases. Bank distribution is the assumption behind the lower $12 activation cost in Bank-supported; referrals alone do not prove that cost. Measure activation per verified customer, 30/90-day paid repeat use and net contribution by route.')
callout('This schedule assumes cooperation and timely approvals. If the bank cannot offer the intended activity or a viable all-in price by Day 90, revise the product scope and cash plan before committing the growth budget. More code does not resolve a missing regulated service or negative transaction economics.')

# 9
start('How likely is success?','09 / judgment and risks')
para('<b>Defined success:</b> at least three consecutive profitable operating months by M36, while meeting customer-money controls and avoiding additional equity funding. This is a narrower and more useful goal than “becoming a major fintech.”')
table(['Conditional milestone','Planning judgment'],[
 ['Obtain a workable bank/legal/service arrangement','60–70%'],['Deliver a safe, reliable pilot given that arrangement','80–90%'],['Achieve economics and adoption given the first two','55–70%'],['Current combined judgment','About 25–45%'],['With signed viable bank support and confirmed cost sharing','About 45–65%']
 ],[CW-135,135])
para('The first three ranges are subjective assumptions. Their conditional chain gives roughly 26–44% (0.60×0.80×0.55 to 0.70×0.90×0.70); this is not an empirical failure-rate model. With the first milestone achieved, the remaining chain is about 44–63%. Ranges are rounded for planning. There is no verified paying-customer cohort, conversion history or comparable-outcome dataset to calibrate them.',style='small')
heading('Risks that can change the answer')
table(['Risk','Practical mitigation'],[
 ['Bank terms / legal scope','Bind permitted products, costs, responsibilities and exit rights in contracts. A possible partnership is not an activated service.'],
 ['Margin compression / competition','Pilot total-price acceptance. Existing banks, instant payment systems and licensed exchange channels already serve this market.'],
 ['Security / money integrity','Resolve the reproduced test failure; complete DB rail tests, independent assurance and daily reconciliation.'],
 ['FX / settlement liquidity','Executable quotes, exposure limits, prefunding thresholds and contracted liquidity; no profit assumption from the official/parallel gap.'],
 ['Distribution / retention','Use measured bank-channel cohorts, repeat paid use and contribution. Pay only for acquired customers whose economics justify it.'],
 ['Partner concentration / capital','Termination and data portability rights, backup rail plan, reserve policy and an agreed cost-cut trigger.']
 ],[142,CW-142])
para('Treat the bank partnership as a measurable commercial advantage only when its terms deliver lower costs, reliable funding or contractual revenue. The software foundation alone is insufficient to justify a high success probability.',style='small')

# 10
start('Evidence, sources and model limits','10 / basis of review')
heading('Public sources checked on 13 October 2026')
para('1. <link href="https://www.tazdan.com/trust" color="#039CCD">Tazdan trust centre</link>: public pre-launch and licensing disclosures. Company statements, not independent certification.<br/>2. <link href="https://www.tazdan.com/" color="#039CCD">Tazdan public website</link>: product descriptions, service caveats and existing positioning.<br/>3. <link href="https://cbl.gov.ly/en/wp-content/uploads/sites/4/2026/01/Revenue-and-Expenditure-Statemen-from-1st-Jan-to-31-Dec-2025.pdf" color="#039CCD">CBL 2025 revenue/expenditure statement, page 6</link>: electronic payment instruments totaled LYD 389bn, against LYD 136bn in 2024. The reported 6.84m instant-service subscriber count is not necessarily unique people; neither figure establishes Tazdan’s reachable market.<br/>4. <link href="https://www.imf.org/en/news/articles/2026/04/10/mcs-04102026-libya-staff-concluding-statement-of-the-2026-article-iv-consultation-mission" color="#039CCD">IMF mission statement, 10 April 2026</link>: exchange-rate pressure, financial-sector constraints and digitalization. Opportunity exists alongside macro and infrastructure risk.','small')
heading('Repository evidence and fresh validation')
para('Release controls: docs/runbooks/launch-readiness.md; server/src/services/ops/launchReadiness.service.ts; docs/launch-evidence.example.json. The example leaves all seven gates pending; it does not prove the state of a private production manifest.<br/>Provider status: server/src/services/cardIssuer/index.ts; server/src/services/remittance/remittance.service.ts. Cards have mock/unconfigured adapters; remittance refuses sandbox-only corridors in production.<br/>Security finding: server/src/__tests__/identity.sessions.test.ts:62. One failure reproduced in both the full non-DB run and isolated suite. No unrelated source fix was made during this report.','small')
heading('What the financial model assumes')
para('All demand, pricing, cost and bank-share inputs are explicit assumptions. Base: launch M6; 20% bank share; 1.5% + $3 paid transaction pricing; 0.65% + $1.25 direct rail cost; 0.10% loss allowance; 4% monthly active churn; $25 CAC; $2 KYC at 75% check-to-activation. All Base years keep these rates; ticket and frequency increase as detailed on page 5. Bank-supported changes only CAC and fixed costs.','small')
para('Corporate prefunding = paid volume × 40% externally settled × 2 days / 30 × 1.3 buffer, with at least $300k held. Tax is a conservative 20% reserve on positive monthly operating profit, with no loss credits; it is not a legal tax opinion. Fixed opex includes recurring people, compliance, support, infrastructure and vendor minimums. Customer principal, card income, deposit interest, token appreciation and exit value are excluded.','small')
heading('How to use the deliverables')
para('The workbook uses one case selector and one 60-month calculation. Four cases reconcile to independent calculations. Selector, later-year input, zero and missing-input behavior were checked; no formula errors appeared in the final scan. Every sheet was rendered. Native Excel operation was not tested. Replace assumptions with signed bank quotes and pilot cohorts before relying on returns.','small')
para('This report supersedes earlier financial planning estimates for this decision. The previous investment memorandum retains its separate 12-month proposal assumptions; only its slogan was refreshed. A partner-led structure and five-year cash model explain the different results. Years run Oct–Sep from assumed funding in October 2026. No exit multiple or founder personal return is presented.','small')

if page!=10:raise RuntimeError(f'Expected 10 pages, got {page}')
if y<62:raise RuntimeError('Final page overflow')
footer();c.save()
(ROOT/'output/source/Tazdan_Launch_Readiness_and_Returns.txt').write_text('\n'.join(all_text))
print(json.dumps({'pdf':str(OUT),'pages':page,'final_body_y':y}))
