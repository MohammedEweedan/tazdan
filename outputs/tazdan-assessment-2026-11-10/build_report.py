from pathlib import Path
import json, math, re, html
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, KeepTogether
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.graphics.shapes import Drawing, String, Line
from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics import renderSVG

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
OUT = REPO / 'output/pdf'
OUT.mkdir(parents=True, exist_ok=True)
DATA = json.loads((ROOT/'model-results.json').read_text())
SENS = json.loads((ROOT/'model-sensitivity.json').read_text())
FEATURES = json.loads((ROOT/'features.json').read_text())
SOURCES = json.loads((ROOT/'sources.json').read_text())
METRICS = json.loads((ROOT/'evidence-metrics.json').read_text())
BASE = DATA['scenarios'][1]
NAVY = '#24384F'
TEAL = '#187D8D'
ORANGE = '#B96028'
MUTED = '#566579'
LIGHT = '#EAF0F6'
STYLES = getSampleStyleSheet()
STYLES.add(ParagraphStyle(name='TitleX',fontName='Helvetica-Bold',fontSize=26,leading=30,textColor=colors.HexColor(NAVY),spaceAfter=16))
STYLES.add(ParagraphStyle(name='SubX',fontName='Helvetica',fontSize=12,leading=17,textColor=colors.HexColor(MUTED),spaceAfter=16))
STYLES.add(ParagraphStyle(name='H1X',fontName='Helvetica-Bold',fontSize=18,leading=22,textColor=colors.HexColor(NAVY),spaceAfter=12))
STYLES.add(ParagraphStyle(name='H2X',fontName='Helvetica-Bold',fontSize=11.3,leading=15,textColor=colors.HexColor(NAVY),spaceBefore=9,spaceAfter=5))
STYLES.add(ParagraphStyle(name='BodyX',fontName='Helvetica',fontSize=9.4,leading=13.1,textColor=colors.HexColor('#203247'),spaceAfter=8))
STYLES.add(ParagraphStyle(name='SmallX',fontName='Helvetica',fontSize=8,leading=10.8,textColor=colors.HexColor(MUTED),spaceAfter=6,splitLongWords=True))
STYLES.add(ParagraphStyle(name='CellX',fontName='Helvetica',fontSize=8.4,leading=11,textColor=colors.HexColor('#203247')))
STYLES.add(ParagraphStyle(name='HeadX',fontName='Helvetica-Bold',fontSize=8.2,leading=10.8,textColor=colors.white))
STYLES.add(ParagraphStyle(name='CallX',fontName='Helvetica-Bold',fontSize=12,leading=17,textColor=colors.HexColor(NAVY),spaceAfter=26,backColor=colors.HexColor(LIGHT),borderPadding=12))
story=[]
md=[]
def esc(s): return html.escape(str(s))
def plain(s): return re.sub('<[^>]+>', '', s)
def p(s,style='BodyX'):
    assert all(ord(c)<128 for c in s),repr(s)
    story.append(Paragraph(s,STYLES[style]));md.append(plain(s)+'\n')
def h(s): p(s,'H2X');md[-1]='### '+md[-1]
def page(title):
    if story: story.append(PageBreak())
    p(title,'H1X');md[-1]='## '+md[-1]
def table(headers,rows,widths=None):
    cells=[[Paragraph(esc(v),STYLES['HeadX']) for v in headers]]+[[Paragraph(esc(v),STYLES['CellX']) for v in r] for r in rows]
    t=Table(cells,colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor(NAVY)),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#F2F5F8')]),('LINEBELOW',(0,-1),(-1,-1),.6,colors.HexColor('#B4C0CE'))]))
    story.append(t);story.append(Spacer(1,10))
    md.append('| '+' | '.join(headers)+' |\n| '+' | '.join(['---']*len(headers))+' |\n'+'\n'.join('| '+' | '.join(map(str,r))+' |' for r in rows)+'\n')
def money(x): return ('($'+format(-x,',.0f')+')') if x<0 else '$'+format(x,',.0f')
def count(x): return format(x,',.0f')
def millions(x): return f'${x/1e6:,.2f}m'
def source(ids): p('Sources: '+ids+'. Figures and assumptions as of 10 November 2026.','SmallX')
def chart(path,caption,w=505,hh=205):
    story.append(revenue_chart);p(caption,'SmallX');md.append(f'![{caption}]({path.name})\n')

revenue_chart=Drawing(505,205)
lp=LinePlot();lp.x=43;lp.y=51;lp.width=450;lp.height=125
lp.data=[[(r['month'],r['revenue']/1000) for r in s['rows']] for s in DATA['scenarios']]
lp.xValueAxis.valueMin=0;lp.xValueAxis.valueMax=36;lp.xValueAxis.valueStep=6
lp.yValueAxis.valueMin=0;lp.yValueAxis.valueMax=math.ceil(max(y for s in lp.data for x,y in s)/25)*25;lp.yValueAxis.valueStep=25
for axis in [lp.xValueAxis,lp.yValueAxis]:
    axis.labels.fontName='Helvetica';axis.labels.fontSize=8;axis.strokeColor=colors.HexColor('#B4C0CE')
lp.yValueAxis.visibleGrid=True;lp.yValueAxis.gridStrokeColor=colors.HexColor('#E2E8F0')
for i,(s,c) in enumerate(zip(DATA['scenarios'],['#8A98A8',TEAL,ORANGE])):
    lp.lines[i].strokeColor=colors.HexColor(c);lp.lines[i].strokeWidth=1.5
    x=115+i*105;revenue_chart.add(Line(x,13,x+16,13,strokeColor=colors.HexColor(c),strokeWidth=2));revenue_chart.add(String(x+21,10,s['name'],fontName='Helvetica',fontSize=8,fillColor=colors.HexColor(NAVY)))
revenue_chart.add(lp)
revenue_chart.add(String(43,190,'Monthly management net revenue ($000)',fontName='Helvetica',fontSize=9,fillColor=colors.HexColor(NAVY)))
revenue_chart.add(String(250,27,'Months after funding',fontName='Helvetica',fontSize=8,fillColor=colors.HexColor(MUTED)))
renderSVG.drawToFile(revenue_chart,str(ROOT/'revenue-cases.svg'))

page('Tazdan: investment assessment')
p('Product, commercial viability and the sale of 33%','TitleX')
p('Prepared for the founder | 10 November 2026\n<br/>Source review, isolated software checks and a 36-month conditional financial model.','SubX')
p('Current negotiating view: $0.75m-$1.50m pre-money, with low confidence. A concrete proposal to test is $650,000 for 33%: $600,000 to the company and $50,000 gross to you.','CallX')
p('This is a negotiation judgment, not an independently certified fair-market valuation or an indication that a buyer will pay it. No priced offer, local comparable sale, paid pilot or production banking agreement establishes a market price today. The company could receive a lower offer or no offer.')
h('The software has substance; the business is still unproven')
p('The current source contains substantial wallet, ledger, business-payment and operational software. Fresh checks passed 415 server tests across 53 suites and server, web and mobile type checks. That supports a controlled pilot discussion. It does not establish commercial launch authority, live financial-provider execution, national operating capacity or willingness to pay.')
p('The strongest initial business is a narrow business-payment workflow or institution operations/reconciliation product. Charge for approvals, reporting, integration and support after proving a customer benefit. A broad consumer wallet, crypto exchange, card issuer and international transfer platform would multiply licensing, liquidity, partner and execution demands before demand is known.')
table(['Year 3 conditional outcome','Base','Upside'],[
 ['Month-end transacting consumers',count(BASE['annual'][2]['users']),count(DATA['scenarios'][2]['annual'][2]['users'])],
 ['Paying businesses / institutions','245 / 4','971 / 10'],
 ['Annual management net revenue',money(BASE['annual'][2]['revenue']),money(DATA['scenarios'][2]['annual'][2]['revenue'])],
 ['Annual operating result',money(BASE['annual'][2]['ebitda']),money(DATA['scenarios'][2]['annual'][2]['ebitda'])],
], [265,120,120])
p('The base plan remains loss-making in year 3. It needs approximately $557,000 through month 18 and $1.27m through month 36 including a 20% contingency, before unknown regulatory capital, guarantees, tax and transaction costs. The upside requires materially stronger distribution and more settlement cash. Neither is measured demand.','SmallX')
source('S1, S13; model and analyst judgment')

page('1. What exists, and what has not been established')
table(['Business evidence today','Assessment implication'],[
 ['No paying users, revenue or signed commercial/licensing partners reported','No observed acquisition cost, retention, margin or accepted selling price.'],
 ['Verbal assurance from a CBL official','Useful access; no written permission, product scope, licence or right to launch established.'],
 ['Founder alone; practically zero cash; no current monthly cash cost reported','The model requires funded staff. Unpaid founder time is an economic cost and key-person dependency.'],
 ['Single-digit interested audience, merchants and investors in total','Interest does not establish an active user base or an investable sales pipeline.'],
 ['Libyan incorporated company, about two years old','Cap table, IP assignment, accounts, tax, debts and contingent claims still need document review.'],
 ['Merger approach: team, SF investor connection, CBL relationships','Potential execution help. No committed investment, signed bank contract or customer distribution evidenced.'],
], [245,260])
h('Evidence standard')
p('Source code establishes implemented logic, not production adoption. Automated tests establish behavior within their environment, including mocks. Bank/provider credentials, a feature flag, a price feed or a corridor configuration do not establish a working, lawful and commercially accepted financial service. A verbal regulatory assurance receives no contracted revenue or licence value in this model.')
h('Verification completed')
p('All 61 database migrations applied to a new disposable PostgreSQL 18 cluster on a random loopback port. The server suite passed 415 tests with none skipped. Server, client and mobile TypeScript checks passed. The existing user database and production services were not used. The prior iOS build and native widget storage handoff were verified earlier in this chat.')
h('Boundaries of this assessment')
p('This is not a security audit, regulatory opinion, source-ownership audit, production load certification, financial statement audit or independent bank settlement test. No live customer balances, provider contracts, bank statements or regulator documents were supplied. The review includes modified working files, not only the last Git commit. No numerical probability of national-scale success can be responsibly estimated from this evidence.')
source('S1, S13')

for start,title in [(0,'2. Feature assessment: payments and distribution'),(6,'3. Feature assessment: financial products'),(12,'4. Feature assessment: controls and operations')]:
    page(title)
    p('Implementation status, commercial use and the remaining dependency are assessed separately. "Implemented" is not a claim of production certification. Evidence references E1-E18 are indexed on page 15.','SmallX')
    for i,f in enumerate(FEATURES[start:start+6],start+1):
        h(f'E{i}. {esc(f["feature"])}')
        p('<b>Status:</b> '+esc(f['state'])+'. <b>Commercial use:</b> '+esc(f['commercial'])+' <b>Dependency:</b> '+esc(f['gap']))
    source('S13; current working source')

page('5. Market opportunity and competitive position')
h('A real payment market already has operators and rails')
p('CBL reported approximately LYD865bn of broad electronic transaction value through September 2026. This supports the existence of large system activity, not the number of people Tazdan can acquire or the fees it can retain. CBL financial inclusion strategy prioritises interoperability and digital business/government payments. It does not commit procurement or customers to Tazdan. [S2, S3]')
p('LYPay describes Moamalat as operating the instant-payment infrastructure under CBL assignment. The CBL developer portal specifies NUMO QR formatting and payment execution. Tazdan currently produces its own payment URL; no implementation evidence establishes national QR interoperability. The commercial route is likely to require integration and an approved role alongside existing operators. [S5, S6, S13]')
p('CBL lists payment companies by service and decision; current scope and validity must be checked directly because the directory includes older dates. Dafa markets seven local methods and offers either a 3% indirect-collection price or direct collection with a subscription. That is competitor advertising, not verified volume or profit, and it does not establish Tazdan pricing or a statutory fee ceiling. [S4, S7]')
h('Three plausible entry markets')
table(['Buyer / problem to validate','Offer to test','Evidence required'],[
 ['Small and mid-size employers: approvals, payroll/vendor files, audit trail','Paid workflow subscription with a defined supported payment route','Paid pilot, measured staff time saved and confirmed recipient cash-out.'],
 ['Merchants: collection, receipts, reconciliation and integration','Subscription plus a permitted collection fee','Approved rail, settled cash, repeat use and margin after all partner charges.'],
 ['Banks/payment institutions: operations and reconciliation backlog','Scoped isolated software deployment and support contract','Named sponsor, security review, acceptance criteria, implementation budget and renewal.'],
],[158,155,192])
h('What cannot be used as Tazdan demand')
p('CBL bank FX-use totals include corporate activity; the reported $19.34bn total and $2.68bn transfer category are not addressable retail-remittance revenue. World Bank notes Libya used an abridged 2024 survey with omitted receiving-payment fields, limiting comparisons. Bank accounts, cards and transaction events also cannot be summed into unique people. This assessment therefore uses a bottom-up acquisition model rather than an asserted share of national totals. [S8, S9]')
p('Potential differentiation is a reliable business workflow, easy integration, accepted controls and customer service. Code breadth alone is reproducible. Defensibility would come from contracted distribution, approved integrations, trusted settlement operations, retained customers and the cost of replacing an embedded workflow. None is yet measured.')
source('S2-S9, S13; entry-market selection is analyst judgment')

page('6. How the company could earn money')
table(['Revenue stream','Proposed base price','Present evidence / treatment'],[
 ['Business workflow subscription','$40 / $45 / $50 per month in years 1 / 2 / 3','Proposed, untested. Billing and commercial entitlement operations still needed.'],
 ['Domestic merchant collections','0.5% gross fee on chargeable payments','Only 35% / 40% / 45% of retail payments chargeable. Partner costs deducted.'],
 ['Business payouts','$0.15 gross per successful payout','Code defaults to zero unless configured. Requires accepted commercial terms.'],
 ['Institution operations software','$2,000 monthly plus $10,000 accepted setup','No contract signed. Setup is one-time; no institution churn assumed, an optimistic renewal assumption.'],
 ['Crypto, cards, LYDT, remittance, custody yield','Zero in the core forecast','Regulatory, execution, counterparty and commercial dependencies unresolved.'],
],[150,157,198])
h('Unit economics: retained income is much smaller than payment value')
p('<b>$35 merchant payment:</b> a 0.5% fee earns $0.175. A partner cost of 0.15% plus $0.02 consumes $0.0725. Retained fees are $0.1025; a 0.02% loss allowance leaves $0.0955 before customer support, verification and fixed staff. Ten thousand such payments contribute only about $955 before those costs. These are assumed terms, not quoted margins.')
p('<b>$50 business subscription:</b> after a 10% direct-vendor allowance, $45 remains. Forty monthly payout attempts at 98% completion add $4.90 after a $0.025 partner cost against the $0.15 fee. Payout-loss allowance removes about $0.94 at a $120 ticket. About $49 remains before fixed staff, acquisition and related consumer costs. A $120 cash onboarding cost plus payroll needs retention to pay back.')
p('<b>$2,000 institution contract:</b> a 20% vendor allowance leaves $1,600 monthly before fixed team costs. A $10,000 setup fee at 60% external delivery cost leaves $4,000 once. Scope creep, custom support and slow collection could consume that contribution.')
h('Accounting and products outside the forecast')
p('Management net revenue is platform fees after partner pass-through costs, plus business subscriptions, institution recurring fees and accepted setup fees. Actual statutory gross/net presentation depends on principal/agent contract analysis. Customer payment principal and safeguarded funds are never revenue, company capital or unrestricted spending cash.')
p('Remittance spread is not automatically profit: on an illustrative $750 transfer, a 0.5% fee is $3.75; assumed provider FX cost of 0.35%, a $1 fixed charge and a 0.03% loss allowance leave negative $0.10 before operations. A 1.2% fee would leave $5.15 on the same assumptions. This is a sensitivity illustration only; no such corridor economics are established. FX feeds, token reserves and card interchange are assigned no current earnings value.')
source('S1, S10, S13; all prices and costs here are analyst hypotheses')

page('7. User acquisition, retention and activity')
p('There is no defensible statistical expected user count today. The following are conditional planning cases, not probability-weighted forecasts. Funding, written permissions, an operating team, supported rails and workable funding/redemption are prerequisites. Without them, modeled payment activity is zero.')
table(['Acquisition / activity driver','Downside','Base','Upside'],[
 ['Months before operating launch','12','6','3'],
 ['Qualified business leads/month, Y1 / Y2 / Y3','15 / 25 / 40','40 / 80 / 140','80 / 180 / 350'],
 ['Lead to paid activation','5%','10%','15%'],
 ['Monthly business churn','2.5%','1.5%','0.8%'],
 ['Consumer prospects per new business','10','20','30'],
 ['Unique funded share of those prospects','50%','70%','80%'],
 ['Monthly consumer churn','10%','7%','5%'],
 ['Retail payment attempts/user/month, Y3','3','6','9'],
 ['Payment completion assumption','95%','98%','99.5%'],
],[227,92,93,93])
h('How the counts are constructed')
p('New businesses equal qualified leads times paid conversion. Paying businesses roll forward after monthly churn. New transacting consumers come from activated businesses, paid acquisition and deduplicated referrals; consumer churn removes inactive cohorts. Businesses/users are expected cohort counts, so internal calculations may be fractional. Transactions use average opening/closing customers in each month; end-of-year customer counts are not multiplied across the full year.')
p('Base consumer acquisition spend rises from $500 to $1,500 per month; assumed funded-customer cash acquisition cost falls from $25 to $20. Merchant and paid channels are assumed to introduce distinct people. The model infers registrations from a 35% registration-to-funded conversion; registrations are cumulative, not monthly active users. Referrals assume 1% of prior active consumers each month. None of these rates has been observed.')
table(['End of year 3 / activity during year 3','Downside','Base','Upside'],[
 ['Transacting consumers',*[count(s['annual'][2]['users']) for s in DATA['scenarios']]],
 ['Cumulative inferred registrations',*[count(s['annual'][2]['registrations']) for s in DATA['scenarios']]],
 ['Paying businesses / institution contracts','31 / 1','245 / 4','971 / 10'],
 ['Annual successful payment events',*[count(s['annual'][2]['payments']) for s in DATA['scenarios']]],
 ['Annual principal processed',*[millions(s['annual'][2]['volume']) for s in DATA['scenarios']]],
],[227,92,93,93])
p('Retail transfers and business payouts are separate events; deposits, withdrawals, receipt notifications and ledger legs are not counted again. Single-digit current prospects do not yet support the assumed lead volumes. The acquisition plan must be rebuilt from an actual named pipeline.','SmallX')

page('8. Revenue and operating results over 36 months')
rows=[]
for s in DATA['scenarios']:
    for a in s['annual']:
        rows.append([s['name'] if a['year']==1 else '',str(a['year']),money(a['revenue']),money(a['ebitda']),count(a['users']),count(a['business'])])
table(['Case','Year','Net revenue','Operating result','End users','End businesses'],rows,[73,35,107,111,85,94])
chart(ROOT/'revenue-cases.svg','Conditional monthly net revenue; peaks include one-time accepted institution setup fees.')
h('Base revenue mix in year 3')
a=BASE['annual'][2]
p(f'Retained payment fees: {money(a["retained"])}; business subscriptions: {money(a["subscriptions"])}; institution recurring fees: {money(a["institutionRecurring"])}; one-time setup: {money(a["setup"])}. Subscriptions and institutional delivery supply most income. In contrast, {millions(a["volume"])} in payment principal is not company revenue.')
p('Operating result is before tax, depreciation/amortisation, financing and one-time launch-preparation cash. The base case never reaches monthly operating breakeven in 36 months. The upside first has a positive month at M23, then becomes negative again as costs step up; it remains positive from M29 through M36 in this model. A positive month does not eliminate liquidity funding needs. No terminal value or success probability is assumed.')
source('Analyst model, evaluated 10 November 2026; periods are relative to funding, not calendar years')

page('9. Staffing, runway and settlement capital')
table(['Base monthly economic cost','Year 1, after launch','Year 2','Year 3'],[
 ['Engineering FTE x loaded monthly pay','2.5 x $3,500','3 x $4,000','4 x $4,500'],
 ['Compliance/finance FTE x loaded pay','1 x $2,500','1.5 x $3,000','2 x $3,500'],
 ['Sales/support/operations FTE x loaded pay','2 x $1,500','3 x $1,750','4 x $2,000'],
 ['Total payroll','$14,250','$21,750','$33,000'],
 ['Fixed hosting/legal/admin','$3,250','$5,000','$7,000'],
],[230,95,90,90])
p('The founder is included in engineering. Prelaunch payroll is 70% of planned payroll; base launch preparation is a separate $100,000 cash allowance in month 1. These are unquoted budgets, not observed current expenses. Fractional FTE implies part-time/contract capacity. Vendor, compliance, audit, incident-response and hiring quotes may change the budget substantially.')
table(['Cash requirement with 20% contingency','Downside','Base','Upside'],[
 ['Through month 18',*[money(s['required18']) for s in DATA['scenarios']]],
 ['Through month 36',*[money(s['required36']) for s in DATA['scenarios']]],
 ['Restricted own liquidity at M36, no contingency',*[money(s['annual'][2]['ownLiquidity']) for s in DATA['scenarios']]],
],[227,92,93,93])
h('Customer money and settlement liquidity have different owners')
p('The model reserves the company\'s own settlement liquidity against chargeable merchant and business-payout principal: monthly principal / 30 x prefunding days x a 1.5 stress factor. Base and upside use two days; downside uses five. This is a planning allowance, not a finding that all internal transfers require prefunding. Actual bank/net-settlement contracts could make it smaller or larger. It is restricted cash, not an operating expense. Customer safeguarding obligations must be calculated separately, by currency and legal owner.')
h('What a $600,000 company investment buys')
p('The base 18-month funding floor is about $557,000 including contingency. At $600,000 primary funding, modeled free cash is about $307,000 at M12, negative $8,000 at M24 and negative $455,000 at M36. The forecast continues after cash runs out to display the shortfall; it does not assume new money appears. A later raise or a materially leaner, better-priced plan is required.')
p('If launch never receives permission within 36 months but the modeled prelaunch team is retained, all activity/revenue remain zero; modeled cash use including launch preparation reaches $862,600, before contingency. That is a warning to gate spending and hiring against permission and paid demand, not a recommendation to continue spending for three years.')
p('<b>Excluded and still unknown:</b> licence-specific paid-up capital, regulatory guarantees, any reserve/collateral obligations, tax, financing fees, old liabilities and actual settlement/FX contract terms. Neither the funding estimate nor the valuation should be closed before these are quantified. More required regulatory capital is a funding use; it does not automatically increase the value of existing shares.')

page('10. What changes the economics most')
table(['Single change from base','Year 3 revenue','Year 3 operating result','36-month funding'],[[s['name'],money(s['year3']['revenue']),money(s['year3']['ebitda']),money(s['required36'])] for s in SENS],[212,93,103,97])
p('Static sensitivities evaluated on 10 November 2026 using the same monthly method and assumptions as the workbook. They change one stated input, holding others fixed. These are not simultaneous live spreadsheet outputs. The editable workbook has one scenario selector and one monthly forecast.','SmallX')
h('Interpretation')
p('Removing prefunding reduces capital needs without improving operating profit. Five prefunding days raise the base 18-month need to about $601,000, leaving no contingency room in a $600,000 company check. A settlement agreement matters as much as headline payment volume.')
p('Halving business conversion hurts revenue and operating results, while tying up less settlement cash. A slightly lower funding requirement in that sensitivity is not better business performance. Delaying launch suppresses early payroll and activity together; lower short-term cash use is not evidence that delay is beneficial.')
p('A $75 business price in every year improves revenue under unchanged demand assumptions but still leaves an approximately $293,000 year-3 operating loss. Demand elasticity, churn and buyer resistance are not modeled because they have not been measured. Higher pricing needs paid validation.')
h('Breakeven requires a different commercial result')
p('At M36 the base operating shortfall is approximately $25,200 per month. At an assumed 80% recurring contribution, roughly 16 additional $2,000 institution contracts would cover that gap before any extra delivery, sales or support staff. At about $49 business contribution, more than 500 extra paying businesses would be an optimistic alternative. Neither is a credible plan without acquisition capacity and servicing-cost evidence.')
p('A lean operations-software pilot may therefore be more attractive than the full base staffing plan. Price to a measurable customer benefit, cap bespoke implementation scope, invoice accepted milestones, and negotiate settlement terms before adding broad consumer acquisition.')
h('Workbook checks')
p('All three scenario outputs were reconciled against an independent calculation. Changing a later-year price updates results; blank inputs in an unselected case do not break the active case, while selecting a missing input exposes it. Zero company funding produces a cash deficit. Formula-error scanning found none. Visual review covered every sheet. Native Microsoft Excel recalculation was not tested; calculations were checked in the artifact engine.')

page('11. Current valuation: what can be defended')
p('$750,000-$1,500,000 pre-money is a low-confidence negotiating range to test, subject to clean ownership and liabilities, a defined product scope, and an executable funded plan. It is not a measured market value. The strongest evidence available today is substantial software and testable operating logic; the largest discounts arise from absent demand, written permissions, live banking execution, team and cash.','CallX')
h('Why there is no precise fair-value calculation yet')
p('There are no earnings to capitalise and no supplied paid contracts from which to estimate dependable recurring revenue. A discounted-cash-flow value would be dominated by guessed launch timing, adoption, costs, country/FX risk and terminal value. The scenario model is useful for funding and commercial decisions; it does not prove a valuation. No verified comparable Libyan fintech equity sale was identified in the reviewed sources.')
p('A replacement-cost quote could help a strategic buyer assess time saved, but historical engineering effort is not an asset buyer must reimburse. No independent rebuild quote, transferable IP audit or integration acceptance is available. Do not add replacement cost to a future earnings valuation: that would count the same product twice. Repository model, route and test counts establish scope, not a price.')
p('US pre-seed funding data are a different population, geography and instrument, with selection toward funded startups and substantial AI concentration. Carta SAFE/note statistics are not a direct comparable for a priced minority stake in this Libyan company. Founder asking prices in old investor documents are also not transaction evidence. [S11]')
h('What could support the upper end or a later increase')
table(['Evidence','Why a buyer could pay more'],[
 ['Clean IP ownership, source transfer and deployable scoped product','Reduces legal and integration uncertainty.'],
 ['Written product-specific permission and an executable bank/rail agreement','Turns regulatory access into a usable route to launch; must include costs and responsibilities.'],
 ['Paid pilots, repeat use and renewals','Demonstrates willingness to pay and validates unit costs, conversion and retention.'],
 ['Committed team with accountable delivery and realistic burn','Reduces founder dependency and execution risk.'],
 ['Competing written offers from credible buyers','Provides observable price discovery instead of an analyst anchor.'],
],[239,266])
p('No fixed milestone valuation is assigned in advance. Reprice once contracts and evidence exist, using retained recurring revenue, contribution, actual growth, cash needs and buyer alternatives. A strategic buyer could pay above this range for specific synergies; that premium must come from its own savings or contracted opportunity, not from national-market arithmetic.')
source('S1, S11, S13; current range is analyst judgment, not a comparable-based appraisal')

page('12. Selling 33%: price, allocation and control')
table(['Transaction at equal per-share economics','Working proposal','Your $9m proposal'],[
 ['Total investor check','$650,000','$9,000,000'],
 ['New company capital (primary)','$600,000','$5,000,000'],
 ['Founder gross proceeds (secondary)','$50,000','$4,000,000'],
 ['Post-money equity value','$1,969,697','$27,272,727'],
 ['Pre-money equity value','$1,369,697','$22,272,727'],
 ['Investor stake from new shares','30.4615%','18.3333%'],
 ['Investor stake bought from founder','2.5385%','14.6667%'],
 ['Founder final stake','67%','67%'],
],[243,131,131])
p('Assumes the founder owns 100% before closing, no options/convertibles/other claims, and identical per-share economics for primary and secondary. Final investor stake = total check / post-money value; pre-money = post-money minus primary funding only. Secondary money does not fund company expenses. Taxes and transaction costs can reduce founder net proceeds. [S12]')
h('A practical negotiation')
p('Test an opening around $700,000 total for 33% with $650,000 company capital and $50,000 founder liquidity; that implies about $1.47m pre-money. A $650,000 closing example implies about $1.37m pre-money and leaves $600,000 for the company. This is a proposed structure to negotiate, not evidence that an investor has accepted it. Founder liquidity may be reduced or deferred if the investor will fund only primary shares.')
p('At the same 12:1 primary/secondary allocation as the $650,000 example, the $0.75m-$1.50m pre-money range corresponds to roughly $356,000-$712,000 total for 33%, with $329,000-$657,000 going to the company. The lower end does not fund the modeled base plan for 18 months. Do not sell 33% for a check that leaves the agreed launch plan unfunded; narrow the plan, obtain paid pilots, raise in stages or negotiate a different stake.')
h('Why $9m is not supported today')
p('The proposed $4m personal payout is 44.4% of the check while the company has no proven demand or written route to market. A $22.27m pre-money valuation is far beyond the evidence here. A large budget or a licence capital requirement does not establish that value for existing shares. Keep the $9m idea as a conditional strategic outcome only if a buyer can document exceptional contracted value; it is not the current base negotiating case.')
h('An investor return test, not an exit prediction')
p('If 33% dilutes by 20% to 26.4%, a 3x gross return on a $650,000 check requires approximately $7.39m company equity value at exit. The same test on $9m requires $102.27m. At an illustrative 3x annual net-revenue exit multiple, those imply $2.46m versus $34.09m annual net revenue. The multiple is an assumption, not an observed market comparable; preferences, tax, timing and IRR are not modeled.')
p('Ownership alone does not determine control. Review board seats, vetoes, liquidation preferences, anti-dilution, option pool timing, founder vesting, transfer rights and treatment of secondary shares before agreeing economics. These terms can materially change the value of a nominal 33% stake.')

page('13. Merger option and the next 90 days')
h('What the proposed partner contributes today')
p('A team and relevant relationships could close an important execution gap. An SF investor connection is not committed financing; CBL relationships are not transferable approval. No merger value should be assigned to customers, licence, bank contracts or investment that have not been established. The team also brings payroll, management and integration costs.')
p('Compare the merger against hiring/contracting the same committed capacity. Obtain names, roles, time commitments, demonstrated shipped work, salary expectations, ownership of contributed IP, liabilities and references. Seek a written investor indication with amount, conditions and pricing; a discussion or introduction has no cash value in the budget.')
p('An earned equity arrangement tied to continued service and delivery is more defensible than a large permanent grant for introductions. For illustration, giving the partner 30% before selling 33% to an investor leaves you with 46.9%; a subsequent proportional 10% option pool leaves 42.21%. These are dilution examples, not recommended merger terms or a legal control analysis.')
table(['Period','Required commercial and operating work','Decision gate'],[
 ['Days 1-30','Choose one workflow; interview named employers/merchants or institutions; offer paid pilot terms. Obtain written regulatory-scope advice, bank/rail requirements and full fee/settlement quotes. Reconcile company ownership, IP and liabilities.','No broad launch commitment until the permitted role, partner route, pilot buyer and cost owner are named.'],
 ['Days 31-60','Run an authorised scoped pilot with defined acceptance, complaint/refund and reconciliation procedures. Instrument funding success, completed payments, support cost, review time, losses and customer benefit.','Collect payment for the service or a signed paid acceptance commitment; stop unprofitable acquisition.'],
 ['Days 61-90','Measure repeat use and at least one renewal/continued paid usage where timing permits; obtain independent security and restore evidence; replace model inputs with actual cohort and contract data.','Rebuild runway and financing terms from verified demand and costs; negotiate investment/merger on that evidence.'],
],[61,296,148])
h('Operating dashboard before scaling')
p('Track unique funded and transacting consumers, paying businesses, retained cohorts, successful/failed settlement, time to redemption, net revenue per stream, partner costs, fraud/chargeback loss, support minutes, compliance exceptions, reconciliation breaks, restricted versus free cash and cash runway. Agree target values before the pilot; no universal local benchmark is assumed here.')
p('The current evidence supports pursuing a narrow, paid pilot. It does not support estimating a reliable probability of becoming national financial infrastructure. Sustained adoption, interoperability, approved operations, capital, institutional trust and repeated delivery would all have to be demonstrated. The immediate investment proposition is to fund that validation, with measurable spending gates.')

page('14. Technical evidence and reproducibility')
p('Snapshot: '+METRICS['gitHead']+' plus the current modified/untracked working tree. Assessment date: 10 November 2026. Selected evidence files were SHA-256 indexed in the saved assessment work folder; subsequent code changes can alter the findings.','SmallX')
table(['Verification / inventory','Result / interpretation'],[
 ['Database migration and server checks','61 migrations; 53 test suites; 415 tests passed; 0 skipped. Disposable PostgreSQL 18, no production access.'],
 ['Static typing','Server, client and mobile tsc --noEmit passed.'],
 ['Repository inventory','101 Prisma models, 124 mobile TSX route/layout component files and 73 web page.tsx files. Counts include framework/layout scope and are not unique customer features or a valuation formula.'],
 ['Not certified','External settlement/backing; provider production readiness; penetration resistance; national load capacity; multi-tenant bank-core suitability; independently witnessed disaster recovery.'],
],[162,343])
h('Feature evidence index: repository-relative paths')
for i,f in enumerate(FEATURES,1):
    # A compact authoritative starting point; every reviewed path is in the local JSON evidence index.
    selected=f['evidence'][:2]
    p('<b>E'+str(i)+':</b> '+'; '.join(esc(x) for x in selected),'SmallX')
p('The model is a planning model, not full statutory financial statements. It includes monthly customer cohorts, price/volume drivers, contribution, staffing, cash collection timing and own settlement liquidity. It excludes tax and unquoted statutory capital rather than treating them as zero obligations. All monetary amounts are USD-equivalent planning units; no executable USD/LYD rate or ability to repatriate/convert capital is asserted. Currency-specific balances and restrictions require a separate launch treasury plan.','SmallX')

page('15. Sources and how to use the deliverables')
p('Primary source review and founder confirmations are distinguished from analyst assumptions. Access date for current webpages: 10 November 2026. Linked-source statements have the limits noted below. No outside source establishes Tazdan revenue, permission or valuation.','SmallX')
for s in SOURCES:
    if s['url'].startswith('https:'):
        text=f'<b>{s["id"]}.</b> <a href="{esc(s["url"])}" color="#16677A">{esc(s["title"])}</a> ({esc(s["date"])}). '
    else: text=f'<b>{s["id"]}.</b> {esc(s["title"])} ({esc(s["date"])}). '
    # Short limits keep the bibliography readable; more detailed use restrictions appear in the report.
    limits={
     'S1':'Founder-supplied facts; not independently audited.',
     'S2':'Broad electronic value is not retail TAM or unique people.',
     'S3':'See financial inclusion implementation strategy, printed p44; priorities are not procurement.',
     'S4':'Service-specific permissions; older directory dates require fresh status confirmation.',
     'S5':'Existing operator/rail context, not Tazdan participation.',
     'S6':'QR standards and payment execution, not proof of Tazdan interoperability.',
     'S7':'Advertised prices/features; neither verified volume nor a statutory fee rule.',
     'S8':'Linked Jan-Sep 2026 FX-use report, printed p2; aggregates include business uses.',
     'S9':'Survey methodology note, printed pvi: Libya abridged questionnaire limits comparisons.',
     'S10':'Regulatory discussion; not definitive legality, a prohibition or an approval for Tazdan.',
     'S11':'US funded-startup instrument data; not used as a local valuation comparable.',
     'S12':'Primary/secondary definitions only; transaction economics are separately modeled.',
     'S13':'Current source and local checks; no production certification.'}
    p(text+esc(limits[s['id']]),'SmallX')
h('Editable model')
p('Open the Summary for active outputs and the Deal sheet for investment allocation. In Assumptions, change the single case selector D4 (1=Downside, 2=Base, 3=Upside). Blue inputs are editable; active assumptions feed one 36-month Forecast. Checks show reconciliations; Sources record provenance. Change primary capital separately from founder secondary proceeds. Scenario tables in this PDF are dated evaluations, not live links.')
p('Next review: after written regulatory/bank terms and the first paid-pilot data, or after any material funding, ownership or product-scope change. The forecast and negotiating range should be replaced when better evidence becomes available.','SmallX')

def footer(canvas,doc):
    canvas.saveState();w,hh=A4
    canvas.setStrokeColor(colors.HexColor('#B4C0CE'));canvas.setLineWidth(.5);canvas.line(45,40,w-45,40)
    canvas.setFont('Helvetica',8);canvas.setFillColor(colors.HexColor(MUTED))
    canvas.drawString(45,27,'TAZDAN | Founder assessment | 10 Nov 2026')
    canvas.drawRightString(w-45,27,str(doc.page));canvas.restoreState()

pdf=OUT/'Tazdan_Investment_Assessment_2026-11-10.pdf'
doc=SimpleDocTemplate(str(pdf),pagesize=A4,rightMargin=45,leftMargin=45,topMargin=43,bottomMargin=54,title='Tazdan - Product, commercial and investment assessment',author='Prepared for Tazdan founder')
doc.build(story,onFirstPage=footer,onLaterPages=footer)
(ROOT/'Tazdan_Investment_Assessment_2026-11-10.md').write_text('\n'.join(md))
print(pdf)
