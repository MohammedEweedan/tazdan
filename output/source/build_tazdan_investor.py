from pathlib import Path
import json, math, re
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from PIL import Image

ROOT=Path('/Users/moe/Downloads/promrkts')
OUT=ROOT/'output/pdf/Tazdan_Investor_Investment_Memorandum.pdf'
SRC=ROOT/'output/source'
TMP=ROOT/'tmp/pdfs'
for p in (OUT.parent,SRC,TMP):p.mkdir(parents=True,exist_ok=True)
fonts=Path('/System/Library/Fonts/Supplemental')
for name,f in [('Body','Arial.ttf'),('Bold','Arial Bold.ttf'),('Italic','Arial Italic.ttf')]:pdfmetrics.registerFont(TTFont(name,str(fonts/f)))
W,H=A4; M=44; CW=W-2*M
INK=colors.HexColor('#172D42'); BLUE=colors.HexColor('#039CCD'); SKY=colors.HexColor('#DFF3FA'); PALE=colors.HexColor('#F3F7FA'); GRAY=colors.HexColor('#526575'); LINE=colors.HexColor('#D7E2E9'); WHITE=colors.white; GREEN=colors.HexColor('#227567'); RED=colors.HexColor('#9C4949')
styles={}
for name,fs,lead,col,font in [('body',10.4,15.2,INK,'Body'),('small',8.5,11.8,GRAY,'Body'),('tiny',7.5,10.1,GRAY,'Body'),('head',15,19,INK,'Bold'),('cell',9.1,12.2,INK,'Body'),('cellsmall',8.25,11,INK,'Body')]:styles[name]=ParagraphStyle(name,fontName=font,fontSize=fs,leading=lead,textColor=col,spaceAfter=0)
c=canvas.Canvas(str(OUT),pagesize=A4,pageCompression=1)
c.setTitle('Tazdan | Investor Investment Memorandum | $2m for 10%')
c.setAuthor('Tazdan')
c.setSubject('Pre-revenue funding proposal; product, technology and 12-month 5000 MAU scenario')
page=0; y=0; current=''

def para(text,x=None,top=None,w=None,style='body'):
    global y
    x=M if x is None else x; top=y if top is None else top;w=CW if w is None else w
    p=Paragraph(text,styles[style]);pw,ph=p.wrap(w,900)
    p.drawOn(c,x,top-ph)
    if x==M and w==CW:y=top-ph-10
    return top-ph

def rule(top=None):
    global y
    top=y if top is None else top
    c.setStrokeColor(LINE);c.setLineWidth(.65);c.line(M,top,W-M,top);y=top-16

def heading(text):
    global y
    para(text,style='head');y-=2

def small(text):para(text,style='small')

def bullet(text):para('<font color="#039CCD">•</font> '+text)

def table(headers,rows,widths=None,fs='cell',lastbold=False):
    global y
    widths=widths or [CW/len(headers)]*len(headers)
    assert abs(sum(widths)-CW)<.1
    data=[headers]+rows
    for ix,row in enumerate(data):
        pars=[];heights=[]
        for cell,width in zip(row,widths):
            st=styles[fs]
            pp=Paragraph(('<b>'+str(cell)+'</b>') if ix==0 or(lastbold and ix==len(data)-1) else str(cell),st)
            pp.wrap(width-14,900);pars.append(pp);heights.append(pp.height)
        rh=max(heights)+14
        if y-rh<66:raise RuntimeError(f'Table overflow page {page} {current} y={y} row {ix}')
        c.setFillColor(SKY if ix==0 else (PALE if ix%2 else WHITE));c.rect(M,y-rh,CW,rh,fill=1,stroke=0)
        xx=M
        for pp,width in zip(pars,widths):pp.drawOn(c,xx+7,y-7-pp.height);xx+=width
        c.setStrokeColor(LINE);c.setLineWidth(.35);c.line(M,y-rh,W-M,y-rh)
        y-=rh
    y-=14

def callout(text,bg=SKY):
    global y
    p=Paragraph(text,styles['body']);p.wrap(CW-28,900);h=p.height+26
    c.setFillColor(bg);c.roundRect(M,y-h,CW,h,8,fill=1,stroke=0);p.drawOn(c,M+14,y-13-p.height);y-=h+17

def metric_strip(items,top=None):
    global y
    top=y if top is None else top;ww=CW/len(items)
    for i,(val,lbl) in enumerate(items):
        xx=M+i*ww
        c.setFillColor(BLUE);c.setFont('Bold',25);c.drawString(xx,top-26,val)
        pp=Paragraph(lbl,styles['small']);pp.wrap(ww-15,80);pp.drawOn(c,xx,top-39-pp.height)
    y=top-89

def start(title,kicker,sub=''):
    global y,page,current
    if page and current!='Cover':
        if y<60:raise RuntimeError(f'Body overflow page{page}: {current}: {y}')
        footer();c.showPage()
    page+=1;current=title
    c.setFillColor(BLUE);c.rect(0,H-8,W,8,fill=1,stroke=0)
    c.setFillColor(GRAY);c.setFont('Bold',8);c.drawString(M,H-39,'TAZDAN  /  INVESTOR MEMORANDUM')
    c.setFont('Body',8);c.drawRightString(W-M,H-39,kicker.upper())
    pp=Paragraph(title,ParagraphStyle('title',fontName='Bold',fontSize=27,leading=31,textColor=INK));pp.wrap(CW,100);pp.drawOn(c,M,H-73-pp.height)
    y=H-73-pp.height-16
    if sub:para(sub,style='small');y-=4

def footer():
    c.setStrokeColor(LINE);c.setLineWidth(.5);c.line(M,49,W-M,49)
    c.setFillColor(GRAY);c.setFont('Body',7.5);c.drawString(M,34,'Confidential  |  13 October 2026  |  All financial figures in USD')
    c.setFont('Bold',8);c.drawRightString(W-M,34,f'{page:02d}')

def screen_row(names,labels,top=None):
    global y
    top=y if top is None else top
    gap=20;slot=(CW-gap*(len(names)-1))/len(names);hh=min(310,slot*1280/590);ww=hh*590/1280
    for i,(name,label) in enumerate(zip(names,labels)):
        xx=M+i*(slot+gap)+(slot-ww)/2
        p=ROOT/'client/public/app/screens/en-light'/f'{name}.webp'
        target=TMP/f'{name}.png';Image.open(p).save(target)
        c.setFillColor(PALE);c.roundRect(xx-3,top-hh-3,ww+6,hh+6,12,fill=1,stroke=0)
        c.drawImage(str(target),xx,top-hh,ww,hh,mask='auto')
        pp=Paragraph(label,styles['small']);pp.wrap(ww,100);pp.drawOn(c,xx,top-hh-13-pp.height)
    y=top-hh-66

def growth_chart(maus):
    global y
    height=160;left=M+36;right=W-M-5;top=y;bottom=top-height
    for v in [0,2500,5000]:
        yy=bottom+v/5000*(height-14);c.setStrokeColor(LINE);c.setLineWidth(.4);c.line(left,yy,right,yy)
        c.setFillColor(GRAY);c.setFont('Body',8);c.drawRightString(left-7,yy-3,f'{v:,}')
    pts=[]
    for i,a in enumerate(maus):
        xx=left+i*(right-left)/11;yy=bottom+a/5000*(height-14);pts.append((xx,yy))
        c.setFillColor(GRAY);c.setFont('Body',7.5);c.drawCentredString(xx,bottom-17,str(i+1))
    path=c.beginPath();path.moveTo(*pts[0]);[path.lineTo(*p) for p in pts[1:]]
    c.setStrokeColor(BLUE);c.setLineWidth(2.5);c.drawPath(path)
    for xx,yy in pts:c.setFillColor(BLUE);c.circle(xx,yy,2.8,fill=1,stroke=0)
    c.setFillColor(GRAY);c.setFont('Body',8);c.drawString(left,bottom-33,'Month from funding close; live customer activity begins in M4')
    y=bottom-51

maus=[0,0,0,300,650,1100,1700,2400,3100,3800,4400,5000]
model=[];prev=0
for i,ma in enumerate(maus,1):
    activ=ma-.96*prev
    checks=activ/.75
    revs={'Remittance':ma*.45*600*.018,'LYD conversion':ma*.15*600*.005,'Crypto exchange':ma*.25*500*.025,'Withdrawals':ma*.30*3,'Business payouts':ma*.02*50*.50}
    revenue=sum(revs.values())
    remitv=ma*.45*600;lydv=ma*.15*600;cryptov=ma*.25*500
    direct={'Remittance rails':remitv*.0035+ma*.45*.4,'LYD liquidity':lydv*.001,'Crypto execution':cryptov*.0025,'Withdrawal fulfillment':ma*.30,'Business payout handling':ma*.02*50*.05,'Loss reserve':(remitv+lydv+cryptov)*.0005,'KYC':checks*2,'Monitoring':ma*.1,'Infrastructure':1000+ma*.1}
    gross=revenue-sum(direct.values())
    fixed=25000 if i<=3 else (28000 if i<=6 else 30000)
    growth=activ*12+(2000 if i==3 else 0)
    op=fixed+growth;result=gross-op
    model.append(dict(month=i,mau=ma,activated=activ,checks=checks,revenue=revenue,revenue_streams=revs,direct_costs=sum(direct.values()),cost_streams=direct,gross_profit=gross,fixed_opex=fixed,growth=growth,opex=op,operating_result=result,flow=remitv+lydv+cryptov,businesses=ma*.02))
    prev=ma
annual={key:sum(x[key] for x in model) for key in ['revenue','direct_costs','gross_profit','fixed_opex','growth','opex','operating_result','activated','checks','flow']}
(SRC/'Tazdan_Investor_Model.json').write_text(json.dumps({'maus':maus,'monthly':model,'year1':annual,'transaction':{'total_investor_commitment':2000000,'owner_secondary_proceeds':400000,'company_primary_capital':1600000,'investor_post_close_equity':.10,'secondary_post_close_equity':.02,'primary_post_close_equity':.08,'same_share_price_assumed':True,'implied_post_money':20000000,'implied_pre_money':18400000,'company_support_horizon_years':[1,3]},'company_capital_budget':{'year1_operating_cash_deficit_rounded':268000,'legal_provider_activation':250000,'incremental_engineering_assurance':200000,'corporate_prefunding':400000,'contingency':200000,'years2_3_support_reserve':282000,'total':1600000},'assumptions':{'monthly_churn':.04,'verified_to_activated':.75,'blended_activation_acquisition_spend':12,'registration_to_verified':.70,'one_time_launch_cash':450000,'corporate_prefunding':400000,'contingency':200000}},indent=2))

# 1 cover
page=1;current='Cover';y=100
c.setFillColor(INK);c.rect(0,0,W,H,fill=1,stroke=0)
c.setFillColor(BLUE);c.rect(0,H-13,W,13,fill=1,stroke=0)
c.setFillColor(WHITE);c.setFont('Bold',39);c.drawString(M,H-92,'tazdan')
c.setFont('Body',9);c.setFillColor(colors.HexColor('#B9D9E9'));c.drawString(M,H-123,'CONFIDENTIAL  /  INVESTOR & STRATEGIC REVIEW')
coverstyle=ParagraphStyle('cover',fontName='Bold',fontSize=38,leading=44,textColor=WHITE)
p=Paragraph('Your money.<br/>Your next move.',coverstyle);p.wrap(CW,300);p.drawOn(c,M,H-206-p.height)
p=Paragraph('An integrated money platform for consumers, businesses<br/>and the partners that serve them.',ParagraphStyle('cs',fontName='Body',fontSize=13,leading=20,textColor=colors.HexColor('#CFDEE7')));p.wrap(CW,100);p.drawOn(c,M,405)
c.setStrokeColor(colors.HexColor('#476277'));c.line(M,345,W-M,345)
for i,(v,l) in enumerate([('$2.0m','Total primary + secondary investment'),('10%','Total investor ownership after closing'),('5,000','Month-12 active-user target')]):
    xx=M+i*CW/3;c.setFillColor(WHITE);c.setFont('Bold',29);c.drawString(xx,294,v)
    pp=Paragraph(l,ParagraphStyle('cl',fontName='Body',fontSize=9,leading=13,textColor=colors.HexColor('#BDD2E0')));pp.wrap(CW/3-16,60);pp.drawOn(c,xx,276-pp.height)
c.setFillColor(colors.HexColor('#CFDEE7'));c.setFont('Bold',11);c.drawString(M,182,'INVESTMENT MEMORANDUM')
c.setFont('Body',9);c.drawString(M,158,'13 October 2026  |  Pre-revenue funding proposal  |  USD')
pp=Paragraph('<b>$400k to the owner for existing shares; $1.6m to Tazdan for its first 1-3 years.</b><br/>Same-price proposal: $18.4m pre-money / $20m post-money.<br/>Growth, revenue and the funding horizon are modeled objectives, conditional on costs, approvals and execution.',ParagraphStyle('cn',fontName='Body',fontSize=8.5,leading=13,textColor=colors.HexColor('#BDD2E0')));pp.wrap(CW,80);pp.drawOn(c,M,77)
# cover has its own footer
c.showPage();page=1

start('The investment in one page','01 / investment')
para('<b>Tazdan already has the integrated software foundation of a fintech platform.</b> The funding opportunity is to turn that foundation into a trusted, licensed money service with measurable customer activity and repeat transaction revenue.')
metric_strip([('$2.44m','Upper engineering reproduction-cost estimate [I1]'),('5,000','Modeled monthly active users by month 12'),('$49.2k','Base month-12 revenue; scenario, not traction')])
table(['What exists','What investment unlocks'],[
['Mobile consumer app, business payouts, public API and staff operations','Licensed partner activation, safeguarding arrangements and commercial distribution'],
['Ledger, risk, treasury, reconciliation and release controls','Independent assurance, current release acceptance and controlled real-money pilot'],
['Libya-focused FX and 12 sandbox remittance corridors','First approved live corridor, actual settlement economics and recurring customer usage']],[CW*.50,CW*.50])
heading('The proposed transaction')
para('<b>$2.0 million total for 10% ownership:</b> <b>$400,000 paid to the founder/owner</b> for existing shares and <b>$1,600,000 invested into Tazdan</b> to support its first <b>1-3 years</b>. At the same share price, this comprises 2% purchased from the owner plus 8% newly issued, measured fully diluted after closing. Implied valuation: <b>$18.4m pre-money / $20m post-money</b>; final cap table and rights to be agreed.')
heading('The business thesis')
para('Start with a focused Libya corridor and repeat users: households moving money, diaspora families supporting relatives, and businesses paying Tazdan customers. Earn disclosed spread and transaction fees; use wallets, chat and business tools to drive retention. Add corridors and issuer products only after the first economics and controls work in production.')
callout('<b>Base case at month 12:</b> $49,175 revenue, 70.2% gross margin and a $4,806 operating loss after team, compliance and acquisition spending. At the same unit economics and acquisition intensity, operating break-even is approximately 5,920 active users.')
small('Pre-revenue status is supplied in the founder brief. No verified production user, revenue, partner-contract or audit traction is represented. Technology cost estimates and the proposed equity valuation are separate measures.')

start('The app: everyday money','02 / product screenshots','Repository-supplied app captures. Displayed balances, prices and identities are sample UI data, not financial evidence.')
screen_row(['home','send','exchange'],['<b>Wallet and portfolio</b><br/>Balances, assets and activity.','<b>Send money</b><br/>Recipient and amount flow.','<b>Exchange</b><br/>Asset discovery and trading.'])
heading('One customer relationship, several repeat uses')
para('The app brings funding, wallet balances, internal payments, conversion, transaction history and support into a single interface. Local language, clear payment confirmations and a usable operations backend are part of the product value.')
para('<b>Households</b> use wallets and internal payments. <b>Diaspora families</b> use cross-border transfers after corridor activation. <b>Traders</b> use quoted conversion within approved products and risk limits.',style='small')
small('Screens show the product experience; code implementation and UI presence do not establish a live licensed service. Production money features are explicitly gated. [I2-I5]')

start('Business and cross-border journeys','03 / product screenshots','Actual app assets supplied with the repository. The remittance flow currently operates against sandbox rails.')
screen_row(['business-home','business-bulk','remit'],['<b>Business dashboard</b><br/>Account and payment activity.','<b>Bulk payouts</b><br/>Pay multiple Tazdan users.','<b>Send abroad</b><br/>Partner activation required.'])
heading('Business volume can deepen the customer network')
para('Businesses have KYB review, teams, approval workflows and batch payouts. A business can pay workers, suppliers or other recipients who are Tazdan customers. The public API supports integration with business systems; signed webhooks report payout outcomes.')
para('The cross-border engine adds beneficiary records, auditable quotes, screening, routing, treasury reservations, payout status, refunds and reconciliation. Twelve corridor configurations cover Libya in both directions with the UK, euro area, Egypt, Turkey, UAE and Tunisia.')

small('Screenshot assets: client/public/app/screens/en-light/{business-home,business-bulk,remit}.webp. Business capabilities [I4]; cross-border state and pricing [I5].')

start('How the business will operate','04 / operating model')
steps=[('1','Acquire and verify','A customer registers, completes required checks and agrees the approved terms.'),('2','Fund and quote','A supported bank or approved rail funds the wallet; Tazdan presents the executable price and fee.'),('3','Reserve and route','The ledger reserves funds; risk and limits determine whether to proceed or review.'),('4','Deliver and record','Internal credit or activated partner payout completes; earned fees and spread are recorded.'),('5','Reconcile and retain','Provider statements and ledgers reconcile; support, history and repeat use close the loop.')]
for no,title,desc in steps:
    c.setFillColor(BLUE);c.circle(M+13,y-15,13,fill=1,stroke=0);c.setFillColor(WHITE);c.setFont('Bold',11);c.drawCentredString(M+13,y-19,no)
    bottom=para('<b>'+title+'</b><br/>'+desc,x=M+40,top=y,w=CW-40);y=bottom-22
heading('The proposed launch structure')
para('Tazdan operates the product, technology, customer journey and control workflows. Authorised entities and contracted banks, payout providers and liquidity venues perform the regulated activities within their agreed legal scope. Entity structure, allocation of compliance duties and customer-fund ownership must be fixed in contracts before activation.')
heading('Money and revenue are accounted for separately')
para('Customer balances and transfer principal are obligations or settlement flows. Revenue consists of earned fees and spread, not the value of money passing through the system. Corporate capital funds operating expenses and prefunding; customer funds are not a source of business profit or funding.')
small('This is the proposed commercial operating model, not a statement that approvals or contracts already exist. Manual bank confirmation and payout operations require named staff, cutoffs and daily close procedures. [I3-I6]')

start('Technology worth building on','05 / proprietary platform')
metric_strip([('97','Prisma data models'),('85','Mobile route files, excluding layouts'),('55','Web page routes; 33 in admin')])
para('Current static review also finds <b>57 migrations and approximately 139,000 application source lines</b> across server, mobile and web, including tests. Breadth is supported by the workflows and controls below; line count is not a valuation method.')
table(['Layer','Integrated capabilities','Commercial implication'],[
['Customer surfaces','Expo iOS/Android; Next.js web; business and staff interfaces','Several customer segments share one financial core.'],
['Money core','PostgreSQL-enforced double entry; holds; conditional transitions; append-only evidence','Money movement can be traced and operational exceptions investigated.'],
['FX and delivery','Fulus-referenced LYD maker; immutable quotes; provider routing; treasury and reconciliation','Pricing and delivery can be managed independently of a single rail.'],
['Risk and operations','17-rule risk engine; screening; cases; 12 staff roles/49 permissions; dual control','Operational and compliance work is embedded in the platform.'],
['Release and recovery','Production evidence gates; kill switches; monitoring; migration and recovery tools','Controlled activation rather than broad automatic enablement.']],[85,228,CW-313],fs='cellsmall')
heading('The premium is integration and time saved')
para('A new entrant would need to assemble consumer experience, accounting, settlement, risk, support and staff workflows together. Tazdan gives an investor an existing integrated starting point. Provider flexibility, local product knowledge and business APIs support a premium positioning; distribution and liquidity network effects still need to be earned.')
small('Counts are a 13 October 2026 working-tree inventory, not a production benchmark. Historical 151 passing server tests were reported on 7 October; tests and capacity were not rerun for this memorandum. [I1-I3,I6-I8]')

start('A strong technology value case','06 / valuation rationale')
para('<b>Up to approximately $2.4 million estimated engineering reproduction cost</b> provides a substantial, documented foundation for the technology discussion. It excludes licences, live partner activation and independent assurance, all of which can add to the cost of recreating a commercial platform.')
table(['Reproduction scenario','Effort × fully loaded cost','Estimated cost'],[['Lower','72 engineer-months × $12,000','$864,000'],['Midpoint illustration','97 engineer-months × $16,000','$1,552,000'],['Upper','122 engineer-months × $20,000','$2,440,000']],[CW*.29,CW*.45,CW*.26])
small('Source: internal engineering effort estimate [I1]. Effort is judgement-based, not time-sheet expenditure. International specialist-team economics are assumed; local or AI-assisted delivery may cost less. U.S. BLS reports a $133,080 median developer wage for May 2024, a salary benchmark rather than a turnkey fintech build quote. [E1]')
heading('What the investor is buying exposure to')
bullet('<b>An integrated platform:</b> ledger, customer apps, business tools, operator controls and provider orchestration.')
bullet('<b>A faster commercial starting point:</b> the study estimates 12-18 elapsed months for a six-to-eight-person build team, subject to sequencing.')
bullet('<b>Several growth paths:</b> consumer transfers, business payouts, additional corridors and future platform licensing after validation.')
heading('The proposed $18.4 million pre-money price')
para('The same-price primary/secondary proposal implies $20m post-money less $1.6m of new company capital = <b>$18.4m pre-money</b>. The $400k owner share purchase is paid to the owner. This venture price reflects future potential; reproduction cost alone does not establish it. Legal access, delivery economics, reliable operations and repeat usage support the premium case.')
callout('<b>Proposed funding structure:</b> $2m for 10% in total, split into $400k owner liquidity and $1.6m company support for the first 1-3 years. Support the price with partner commitments, independent security evidence and pilot cohorts; deploy company capital against reviewed milestones.')
small('Contributor IP assignments, licence terms of dependencies and chain of title should be confirmed in diligence. No comparable funding transaction, audited IP appraisal or investor return is asserted. [I7]')

start('How Tazdan earns revenue','07 / base monetisation')
para('The base scenario monetises transactions after permitted features and partners go live. Each activity below is counted once. The same customer may use several products; the underlying transaction principal is separated to avoid double-counting.')
table(['Month-12 stream','Illustrative usage and price','Monthly revenue'],[
['Cross-border transfers','2,250 users × $600 volume × 1.8% blended fee + spread','$24,300'],
['Standalone LYD conversion','750 users × $600 × 0.5% effective gross yield','$2,250'],
['Separate crypto exchange','1,250 users × $500 × 2.5% effective gross yield','$15,625'],
['Withdrawals','1,500 chargeable withdrawals × $3 fee','$4,500'],
['Internal business payouts','100 business accounts × 50 payments × $0.50','$2,500'],
['Total','5,000 MAU; blended revenue of $9.835 per MAU','$49,175']],[CW*.25,CW*.54,CW*.21],fs='cellsmall',lastbold=True)
heading('Pricing is a commercial assumption')
para('Remittance corridors have configurable spread, fixed and percentage fees; the model uses a 1.8% blended realised fee/spread yield and does not add seeded flat fees. The LYD market maker uses pips, not a fixed 2.5% conversion charge: a 0.05 LYD half-spread would be 0.5% at a purely illustrative 10 LYD/USD reference. Actual capture changes with rates, skew and inventory.')
para('The crypto 2.5%, withdrawal $3 and business $0.50 are modeled realised pricing. They require approved tariffs and correctly charged, reconciled fee postings. Business fees are configurable and can currently default to zero. LYD swap margin journal wiring and testing are a launch prerequisite for that revenue line.')
callout('<b>Excluded from base revenue:</b> P2P escrow fees (currently zero), cards/interchange, subscriptions, customer-balance yield, group-wallet or pool returns, DEX execution fees and white-label licensing. These are optional future upside, not assumed cash flow.')
small('Month-12 distinct remittance/FX/crypto volume: $2.425m; business payouts $0.500m are tracked separately. Fee revenue is not transaction principal. [I4,I5,I9,I10]')

start('Margins and unit economics','08 / profit drivers')
metric_strip([('$9.84','Revenue per MAU in the base case'),('70.2%','Month-12 gross margin'),('-9.8%','Month-12 operating margin')])
table(['Direct cost, month 12','Assumption','Monthly cost'],[
['Remittance fulfilment','0.35% of volume + $0.40 per transfer','$5,625'],
['LYD / crypto execution','0.10% / 0.25% of separate volumes','$2,013'],
['Withdrawal / business handling','$1 withdrawal / $0.05 business payment','$1,750'],
['Loss reserve','0.05% of remittance + LYD + crypto volume','$1,213'],
['KYC verification','~1,035 checks × $2','$2,069'],
['Monitoring and infrastructure','$0.10/MAU monitoring; $1,000 + $0.10/MAU infra','$2,000'],
['Total direct costs','Rounded components; exact total shown','$14,669']],[CW*.32,CW*.48,CW*.20],fs='cellsmall',lastbold=True)
heading('Gross margin becomes profit only after operating costs')
para('Month-12 gross profit is <b>$34,506</b>. Fixed operating costs of <b>$30,000</b> and growth spending of <b>$9,312</b> produce a <b>$4,806 operating loss</b>. Fixed costs cover engineering/product ($10k), founder/business ($4k), compliance/legal ($6k), support/ops ($6k), and security/custody/insurance/admin ($4k).')
para('At the same 5,000 users in a steady state with only 4% monthly churn replacement, modeled KYC and acquisition costs fall. The result becomes approximately <b>$3,642 operating profit, or 7.4% margin</b>. This requires stable activity, pricing and costs; it is not the month-12 growth case.')
small('Gross margin = (revenue - direct costs) / revenue. Operating margin includes recurring team and growth costs, before tax, interest, depreciation and $450k assumed one-time launch spending. Bank/local funding is assumed; card processing is excluded. Partner/insurance costs are not contracted. Sumsub lists a $1.85 compliance check with a $299 minimum; the model allows $2/check but excludes separately negotiated KYB/monitoring extras. [E2]')

start('The route to 5,000 active users','09 / acquisition plan')
para('<b>Active means a customer completing at least one genuine permitted money transaction in the preceding 30 days.</b> Downloads, registrations, chat-only visits and sandbox transactions do not count. Business owners are included in the total MAU; 100 active business accounts is a month-12 subset target.')
growth_chart(maus)
table(['Acquisition assumptions','Base target'],[['Monthly active-user retention','96% (4% monthly churn), an unvalidated assumption'],['Gross first-time activations during year 1','5,698; includes replacing customers who leave the active cohort'],['Verified accounts needed','~7,597 at 75% verified-to-active conversion'],['Registrations needed','~10,853 if 70% of registrations verify'],['Acquisition spend','60% paid at $20 CAC, 40% organic; $12 blended spend per activation'],['Year-1 acquisition budget in forecast','$70,376, including $2,000 prelaunch spend']],[CW*.50,CW*.50],fs='cellsmall')
heading('Distribution starts with trust and repeat need')
para('Proposed channels: community referrals and recipient claim links; targeted diaspora and local-market campaigns; and direct onboarding of employers, merchants and supplier-payment businesses. Measure activation, first-to-second transaction conversion, cohort retention, cost per activated user and revenue per cohort weekly.')
small('The channel split is a spending assumption, not secured distribution or measured CAC. Ramp begins only if release gates and the first corridor are accepted by the end of month 3. Delay shifts the revenue curve and consumes runway.')

start('The 12-month financial scenario','10 / base forecast','Months run from funding close. M1-M3 are preparation; all subsequent revenue is conditional on approved launch in M4.')
rows=[]
for d in model:
    fmt=lambda n:f'{n:,.0f}' if n>=0 else f'({abs(n):,.0f})'
    rows.append([str(d['month']),f"{d['mau']:,}",fmt(d['revenue']),fmt(d['direct_costs']),fmt(d['gross_profit']),fmt(d['opex']),fmt(d['operating_result'])])
rows.append(['Year 1','5,000¹',f"{annual['revenue']:,.0f}",f"{annual['direct_costs']:,.0f}",f"{annual['gross_profit']:,.0f}",f"{annual['opex']:,.0f}",f"({abs(annual['operating_result']):,.0f})"])
table(['Month','MAU','Revenue','Direct<br/>costs','Gross<br/>profit','Operating<br/>costs','Operating<br/>result'],rows,[39,46,81,78,80,90,CW-414],fs='cellsmall',lastbold=True)
metric_strip([('$220.8k','Year-1 earned revenue'),('64.1%','Year-1 weighted gross margin'),('($267.9k)','Year-1 recurring operating result')])
heading('Read the ramp correctly')
para('Month-12 revenue annualised is <b>$590,100</b>. This is an exit run rate, not year-1 revenue, contracted recurring revenue or SaaS ARR. The ramp produces less revenue in the earlier months and carries preparation costs before the first transaction.')
para('If the assumed $450,000 one-time launch budget is fully expensed, modeled year-1 loss before tax is <b>$717,859</b>. No after-tax net profit is forecast.')
small('¹ Month-12 endpoint, not a sum of monthly users. Figures are rounded; exact values reconcile in the saved model. Direct costs include prelaunch infrastructure; operating costs include acquisition. No regulatory minimum capital, taxes or financing costs are assumed.')

start('Profit potential and sensitivity','11 / scenarios')
para('The 5,000-user goal does not guarantee profitability. Transaction frequency, corridor economics, fee capture and retention determine whether the platform turns activity into cash contribution.')
# Scenario calculations at month12 use revenue sensitivity and all direct costs plus growth intensity
base=model[-1]
down_rev=21562.50;down_cost=14975;down_opex=40800
up_rev=71225;up_cost=18481.8333333333;up_opex=39312
scens=[('Downside',down_rev,down_cost,down_opex),('Base',base['revenue'],base['direct_costs'],base['opex']),('Upside',up_rev,up_cost,up_opex)]
rows=[]
for name,r,d,o in scens:
    gp=r-d;profit=gp-o
    rows.append([name,f'${r:,.0f}',f'{gp/r*100:.1f}%',f'${profit:,.0f}' if profit>=0 else f'(${abs(profit):,.0f})',f'{profit/r*100:.1f}%'])
table(['At 5,000 MAU','Revenue','Gross margin','Operating result','Operating margin'],rows,[94,89,99,116,CW-398],fs='cellsmall')
table(['Scenario','What must be true'],[['Downside','30% remit users at $450/1.6%; 15% LYD at $450/0.3%; 15% crypto at $350/2%; 1,250 withdrawals; 50 businesses × 30 payouts. Higher execution costs/losses and 900 new activations.'],['Base','The activity and yields on page 8 hold; model partner costs and retention are achieved.'],['Upside','55% remit users at $700/1.9%; 15% LYD at $700/0.6%; 30% crypto at $600/2.5%; 1,750 withdrawals; 125 businesses × 60 payouts. Base cost rates and acquisition spending.']],[94,CW-94],fs='cellsmall')
heading('Two routes to operating break-even')
bullet('<b>Grow beyond the initial target:</b> approximately 5,920 MAU at base unit economics and the month-12 new-activation rate per user, with fixed operating costs unchanged.')
bullet('<b>Improve repeat economics:</b> stable 5,000-MAU activity can generate a modeled 7.4% operating margin when growth spending falls to churn replacement.')
heading('The fee and volume levers')
para('At base month-12 volumes, 0.1 percentage point less remittance yield reduces monthly revenue by $1,350; 0.1 point less crypto yield reduces it by $625. A one-point rise in total fulfilment cost on the $1.35m remittance volume costs $13,500 - larger than the base operating loss.')
small('Downside direct costs assume remittance 0.6% + $1, LYD 0.2%, crypto 0.4%, withdrawal $1.50, business $0.10, and a 0.10% loss reserve. Other monitoring/infra rates stay at base. Scenarios are not probability-weighted; tax and one-time launch spending are excluded.')

start('Funding the first 1-3 years','12 / capital plan')
para('Of the <b>$2m total commitment</b>, <b>$400k buys existing shares from the founder/owner</b> and is paid to the owner. The remaining <b>$1.6m goes into Tazdan</b> to support operations, launch and growth over its first <b>1-3 years</b>. The company allocation below excludes the owner payment.')
table(['Company capital use','Proposed amount','Share of $1.6m'],[['Year-1 recurring operating cash deficit¹','$268,000','16.8%'],['One-time legal and provider activation','$250,000','15.6%'],['Incremental engineering, release and independent assurance','$200,000','12.5%'],['Corporate settlement/prefunding liquidity²','$400,000','25.0%'],['Contingency','$200,000','12.5%'],['Years 2-3 support and expansion reserve','$282,000','17.6%'],['Total new company capital','$1,600,000','100.0%']],[CW*.60,CW*.23,CW*.17],fs='cellsmall',lastbold=True)
heading('What remains after the first year')
para('From the $1.6m company capital, base year-1 cash deployment is about <b>$718k</b> for recurring burn and one-time launch spending. Earmarking <b>$400k</b> for corporate prefunding leaves approximately <b>$482k</b>: $200k contingency plus $282k for subsequent support. Prefunding remains corporate liquidity.')
heading('Release capital against evidence')
para('Milestone 1: approved legal scope, bank/safeguarding arrangements and contracted first rail. Milestone 2: independent security and money-path acceptance plus recovery/device testing. Milestone 3: controlled live pilot with clean reconciliation. Milestone 4: scale acquisition only after cohort retention and contribution margins meet agreed thresholds.')
callout('<b>1-3 year support objective:</b> deploy the $1.6m company funding in reviewed stages. Support through years 2-3 depends on actual spending, launch timing and earned revenue; 36 months of runway is not guaranteed. Settle the separate $400k owner share purchase under the agreed closing terms.')
small('¹ Rounded from $267,859 forecast loss, including growth spend. ² Corporate capital only; customer principal is excluded. Budgets and proceeds are gross planning amounts; deal costs, regulatory minimum capital and partner collateral need confirmation. Primary capital goes to the company; secondary proceeds go to the selling owner. [E3]')

start('Execution, readiness and risk','13 / activation milestones')
table(['Timing','Acceptance objective'],[['Months 1-3','Legal approval for scope; partner and banking contracts; independent review; current release money/device/recovery evidence.'],['Months 4-6','Capped live pilot; daily reconciliation; 300 to 1,100 active users; support and complaints ownership.'],['Months 7-9','1,700 to 3,100 MAU; repeat-cohort economics; business activation; contracted rail reliability.'],['Months 10-12','5,000 MAU and 100 business accounts; measured cost and retention; capacity evidence before further corridors.']],[94,CW-94],fs='cellsmall')
heading('Risks that determine the investment outcome')
table(['Risk','Mitigation and evidence required'],[['Regulatory / partner access','Issued authorisation for exact activities; signed contracts; approved currencies and corridors.'],['Customer funds / cyber / custody','Independent pentest and mobile review; money-path race/replay/reversal tests; isolated custody; recovery drill and daily close.'],['Liquidity / FX / venue exposure','Position and prefunding limits; stale-quote stopping; contracted hedging; treasury stress tests.'],['Unit economics / acquisition','Tariff acceptance; provider invoices; measured active-user cohorts and losses; pause spend if contribution fails.'],['Operational / deployment reliability','Named on-call owners; measured alerts and recovery; scoped kill switches; production capacity acceptance.']],[CW*.32,CW*.68],fs='cellsmall')
callout('<b>Current status:</b> substantial implementation exists, but a broad real-money launch is not evidenced. Remittance rails are sandbox, issuer/PSP activation is pending and money features default to gated/off configurations. Production access is conditional on release-bound evidence and explicit feature scope.')
small('Schedule assumes approvals and partners by month 3, a planning assumption rather than an approval timetable. One first corridor can launch while other features stay gated. Historical readiness reports are supplemented by the current scoped-release runbook. [I2,I3,I8]')

start('Feature catalogue: customer money','14 / full inventory','Implemented means source workflows exist. Live availability still depends on approved release scope, configuration and any stated external dependency.')
table(['Capability group','Features and practical scope'],[
['Account and security','Registration/login; email verification and recovery; TOTP 2FA/recovery; device/session management; biometric app access; risk-based confirmation; security preferences. SMS/WhatsApp needs activation.'],
['Wallets and portfolio','Fiat USD/EUR/GBP/AED/SAR/EGP/LYD and crypto/stablecoin balances; portfolio valuation; activity/history; supported currency views; balance privacy.'],
['Internal payments','Payments to eligible Tazdan users; handles/contact lookup; notes; chat payments; receipts/history; minimum and risk limits.'],
['Claim links','Public preview before account creation; optional PIN; protected claim; expiry; cancellation and refunds.'],
['Bank money movement','Customer bank accounts; deposits to staff-entered platform accounts with confirmation; screened withdrawals and staff approval/manual payout. Requires real bank accounts and operating process.'],
['Crypto funding','Deposit addresses; detection/confirmation for supported networks; linked external-wallet records; on-chain withdrawals subject to custody, RPC and release activation.'],
['Savings and habits','Budget wallets/goals; contributions/withdrawals; scheduled contributions; recurring crypto purchases depend on trading activation.'],
['Records and service','Statements; CSV/JSON exports; portfolio history; notification preferences; in-app/push/email notices; guides; support escalation.'],
['Account lifecycle','Profile settings; public profiles/search; obligations checks; confirmed account closure and retention/anonymisation workflow.']],[CW*.26,CW*.74],fs='cell')
small('Customer-money evidence: mobile/app and mobile/src; server routes for auth, wallets, transfers, messages, claim links, bank accounts, deposits, withdrawals, crypto wallets, budgets, recurring buys, exports and account closure. Feature states reviewed against current code, not just the older matrix. [I2,I3]')

start('Feature catalogue: exchange and reach','15 / full inventory')
table(['Capability group','Features and availability'],[
['Trading and conversion','Own-wallet conversion; executable buy/sell pricing; previews and minimum received; locked single-use crypto quotes; fee/spread disclosure; idempotent execution; orders and recurring buys. Trading activation and real hedge venue required.'],
['LYD pricing engine','Fulus reference; pip-based bid/ask; flow-sensitive skew; netting and per-user caps; stale-rate widening/stopping; shared Redis coordination; maker-checker configuration; cockpit visibility. Swap fee journal completion remains required.'],
['P2P marketplace','Offers/listings, distance sort, escrow, payment confirmation, cancellation, disputes and merchant reputation. Production gated; current escrow fee is zero.'],
['Market and social','Asset search/data/charts/news; authenticated asset discussions, replies, likes, reporting and moderation; direct chat, read status, edit/delete, block/report and privacy controls.'],
['Remittance experience','12 sandbox corridor configurations; beneficiaries and bank validation; locked quotes; fixed/percentage fees, spreads and tier discounts; limits, purpose and source-of-funds thresholds; neutral status tracking.'],
['Remittance execution','23-state lifecycle; screening/manual review; route ranking; treasury reservation/prefund; callbacks/polling; unknown outcomes; retries/cancellation/refunds/returns; provider-statement reconciliation. All external rails await activation.'],
['Cards and card funding','Virtual/physical card interfaces; tiers, controls, freeze/cancel, top-up/order, activity/cashback and budget funding. PSP adapters and mobile pay configuration exist. Issuer/PSP contracts and production adapters required.'],
['Reach and experience','Referral/reward workflows; light/dark/monochrome themes; nine locale dictionaries including Arabic; contact discovery and announcements. Localisation acceptance still requires device QA.']],[CW*.26,CW*.74],fs='cell')
small('Supported withdrawal broadcast paths include ETH/USDT-ERC20, BTC and SOL, subject to isolated remote custody and release acceptance. TRON withdrawal broadcasting is incomplete; not every tradable asset is withdrawable. Read-only DEX quotes are not an executable DEX product. [I2,I3,I5,I9,I10]')

start('Feature catalogue: business and staff','16 / full inventory')
table(['Capability group','Features and practical scope'],[
['Business onboarding','Business profile/dashboard; KYB submission and compliance review; payout verification gate. Automated vendor checks require activation; company-document upload is not represented as complete.'],
['Teams','Invitations/acceptance/removal; OWNER, ADMIN, DEVELOPER and ANALYST permissions; API keys tied to current member roles.'],
['Business payouts','Preview/validation/fees; reserve full batches; maker-checker; single-signatory step-up; human approval for API batches; compliance holds/release; cancellation; atomic lines and partial outcomes. Internal Tazdan recipients only.'],
['Developer platform','Hashed/scoped/expiring/revocable keys; public balances/rates and single/bulk payouts/status APIs; write idempotency; webhook management; signed delivery, retries/backoff, dead-letter state and network restrictions.'],
['Customer operations','Staff overview/search/Customer 360; PII masking; customer freezes/session revocation; business review; transaction detail; deposit/withdrawal/KYC queues; support assignment/reply/resolution.'],
['Money operations','Ledger accounts/journals; remittance queue/retry/refunds/corridors; FX prices/overrides; treasury pools/movements/thresholds; reconciliation exceptions and approvals.'],
['Risk operations','17 default risk rules; screening/name matching and Arabic normalisation; watchlist import; cases, evidence, owners and SLAs; fraud/linked-account/device views and withdrawal review. Screening data must be activated.'],
['Platform operations','Providers/mode/health/circuit breakers/call logs; finance/take-rate/cost views; statistical forecasts with sufficient data; health/security/audit views; staff roles; mobile admin.'],
['Dual control and AI','12 staff roles/49 permissions; privileged-action audit; sensitive adjustments/refunds/FX require separate approval; scoped kill switches. Optional read-only AI assistant, 13 tools, case/support drafts with human acceptance; off by default.']],[CW*.26,CW*.74],fs='cell')
small('External-bank business payouts are not built as a separate service and would use activated remittance rails. Statistical projections need actual historical activity. AI is optional and subject to provider agreement, permissions and privacy configuration. [I4,I6,I11]')

start('Feature catalogue: financial controls','17 / full inventory')
table(['Control group','Built mechanisms / limits'],[
['Accounting integrity','Double-entry journals checked at database commit; customer, settlement and corporate classifications; fees, holds/reservations; asset ledger; continuous reconciliation and trading halt on drift.'],
['Evidence and state','Append-only ledger/audit/security/treasury/lifecycle evidence; immutable quotes; conditional transitions; idempotent remittance/business/API writes and operation references.'],
['Provider safety','Explicit live/sandbox/mock registry; production guards; circuit breakers; callbacks, polling, retry and reconciliation; an unavailable outcome is resolved before another payout.'],
['Identity and surface','TOTP/step-up, credentials/session controls, permission checks, rate limits, guarded webhooks, upload controls, API key scopes and PII masking. These require independent assurance, not implied certification.'],
['Custody and crypto risk','Key/seed-protection and custody interfaces; production remote-custody requirements; withdrawal screening/approvals; configured principal crypto exposure limits. Venue availability and key recovery require acceptance.'],
['Deployment and continuity','Docker/TLS; CI dependency/secret/migration checks; live/ready/metrics endpoints; backup/recovery/PITR and rollback tooling; release-scoped evidence manifest. Recovery and notification drills still required.'],
['Release governance','Legal/provider/security/money-path/device/recovery/operations evidence bound to release SHA; dated reviews and scope; feature/currency/corridor/provider/customer controls; fail-closed new-money access.']],[CW*.28,CW*.72],fs='cell')
heading('Development opportunities excluded from base claims')
para('Group-wallet/liquidity-pool controllers are unmounted; passkey/FIDO2 server support is not evidenced; executable DEX swaps, complete automated safeguarding reconciliation, automated SAR/STR or Travel Rule messaging, and second-region failover are not represented as delivered. Future subscriptions and platform licensing need product and customer validation.')
small('No SOC 2/ISO certification, completed independent audit, operating licence, confirmed partner network or audited traction is implied. Source controls are valuable; their effectiveness in live operations must be established with current independent evidence. [I3,I7,I8,I11]')

start('Evidence and model notes','18 / diligence references')
small('Internal sources below are available in the project data room. Current code is an uncommitted working-tree review dated 13 October 2026; written October 7 assessments are historical. No current production deployment or contracts were inspected.')
refs=[
('I1','docs/dataroom/21_REPLACEMENT_COST.md','72-122 engineer-month assumption; reproduction scope and exclusions.'),
('I2','docs/audit/FEATURE_MATRIX.md','Historical state matrix; current source spot-checks override stale claims.'),
('I3','docs/runbooks/launch-readiness.md','Current release gates, required acceptance evidence and pilot scope.'),
('I4','docs/BUSINESS.md; server/src/services/business/','KYB, internal payouts, roles, API and fee implementation.'),
('I5','docs/REMITTANCE.md; server/src/services/remittance/','Sandbox corridors, pricing, state lifecycle and revenue recognition.'),
('I6','docs/CONTROL_COCKPIT.md; docs/LEDGER.md','Staff operations, permissions and money controls.'),
('I7','docs/dataroom/03_IP_INVENTORY.md; docs/dataroom/18_SCALABILITY.md','IP/title checks and capacity limitations.'),
('I8','server/prisma/schema.prisma; server/prisma/migrations/','Current static counts and ledger/evidence constraints.'),
('I9','docs/FX.md; server/src/services/exchange/','Current pip pricing, principal exposure and fee capture.'),
('I10','server/src/controllers/p2p.controller.ts','Current zero-fee escrow implementation.'),
('I11','docs/AI_AUTOMATION.md; server/src/services/platform/','AI permission boundaries, controls and configuration.')]
for code,path,desc in refs:
    para(f'<b>{code}</b>  {path}<br/>{desc}',style='tiny')
heading('External checks - accessed 13 October 2026')
para('<b>E1</b>  U.S. Bureau of Labor Statistics, Software Developers (May 2024 wage data).<br/><link href="https://www.bls.gov/ooh/computer-and-information-technology/software-developers.htm" color="#039CCD">bls.gov/ooh/computer-and-information-technology/software-developers.htm</link>',style='tiny')
para('<b>E2</b>  Sumsub published pricing: Compliance $1.85/check, $299 monthly minimum.<br/><link href="https://sumsub.com/pricing/" color="#039CCD">sumsub.com/pricing/</link> - reference cost only; no partnership or jurisdictional eligibility asserted.',style='tiny')
para('<b>E3</b>  Carta, The secondary market, explained: primary proceeds fund the company; secondary proceeds belong to the selling shareholder.<br/><link href="https://carta.com/learn/equity/liquidity-events/secondary-transactions/" color="#039CCD">carta.com/learn/equity/liquidity-events/secondary-transactions/</link>',style='tiny')
heading('Interpretation of the financial model')
para('Every forecast input is an illustrative planning assumption. Fractions of users/checks are expected averages, not actual people. Revenue is earned fees and spread; all principal, balances, card income, subscriptions and P2P fees are excluded unless explicitly modeled. Proposed tariffs and fee posting must be accepted before launch. Reported margins exclude tax, financing and depreciation; one-time launch costs are shown separately. Investor ownership and returns depend on definitive terms and future dilution.',style='small')
small('Screenshots are unaltered repository app captures, resized for print. They illustrate UI rather than verified account values, live delivery or customer traction. The saved build source and exact monthly model allow the projections to be revised when partner quotations and pilot evidence arrive.')
footer();c.save()
print(OUT)
print(f'Pages: {page}')
print(json.dumps(annual,indent=2))
