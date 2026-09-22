from pathlib import Path
import json
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
ROOT=Path('/Users/moe/Downloads/promrkts'); OUT=ROOT/'deliverables'; TMP=ROOT/'.artifacts/tazdan'
SOURCES=[
('S1','Central Bank of Libya, electronic payments and approved providers directory','https://cbl.gov.ly/electronic-payment/','Accessed 21 September 2026. Licence categories and listed expiry dates require direct reconfirmation.'),
('S2','Central Bank of Libya, National Financial Inclusion Strategy 2025–2029 announcement','https://cbl.gov.ly/en/governor-of-the-central-bank-of-libya-announces-from-tripoli-the-launch-of-the-national-financial-inclusion-strategy-and-a-number-of-transformative-projects-during-the-opening-of-the-electronic-paymen/','Accessed 21 September 2026. Policy direction does not confer authorisation on tazdan.'),
('S3','Central Bank of Libya, revenue and expenditure statement through 30 November 2025, page 6','https://cbl.gov.ly/en/wp-content/uploads/sites/4/2025/12/Revenue-and-Expenditure-Statemen-from-1st-Jan-to-30-Nov-2025.pdf','Historical baseline, not a September 2026 market count.'),
('S4','IMF, Libya 2025 Article IV Consultation, Informational Annex','https://www.elibrary.imf.org/view/journals/002/2025/148/article-A002-en.xml','Published 25 June 2025. Historical description of exchange restrictions, not a current transaction permission.'),
('S5','Central Bank of Libya, Regulatory Rules of the Libyan National Payment Scheme','https://cbl.gov.ly/micifaf/2024/01/القواعد-التنظيمية-لشبكة-الدفع-المحلية-الليبية.pdf','Published on the CBL site in January 2024. Partner scope and subsequent amendments need counsel confirmation.'),
('S7','FATF, virtual assets and virtual asset service providers','https://www.fatf-gafi.org/en/topics/virtual-assets.html','Accessed 21 September 2026. International AML standard-setting guidance, not a Libyan operating licence.'),
('S8','Libyan News Agency, financial inclusion strategy announcement','https://lana.gov.ly/post.php?id=334548&lang=en','15 June 2025. Reports preparation of a digital-currency framework, not permission to launch a crypto service.'),
('S9','Libya Herald, CBL warning on virtual currencies','https://libyaherald.com/2018/05/cbl-warns-that-dealing-in-virtual-currencies-such-as-bitcoin-are-illegal-in-libya/','17 May 2018. Historical secondary reporting. Requires current primary legal confirmation.'),
('S6','World Bank, Libya Economic Monitor release','https://www.worldbank.org/en/news/press-release/2025/12/17/libya-sustained-strong-growth-requires-structural-change-to-improve-transparency-and-public-financial-management','Published 17 December 2025. Macroeconomic context, not a forecast of payment-app revenue.')]
costs=[('Product development and engineering',2.1,1.5),('Operations and compliance personnel',2.1,2.7),('Legal, licensing work and application provision',1.0,.5),('Security assurance and external audits',.5,.4),('Cloud, software and resilience',.5,.7),('Bank and processor setup and integration',.7,.2),('Acquisition and merchant activation',1.1,.4),('Office, insurance and administration',.4,.2)]
years=[]
for i,(users,merchants,share,volume,take,fixed) in enumerate([(10000,200,.1,600,.006,8.4e6),(45000,800,.15,800,.007,6.6e6),(120000,2500,.2,1000,.008,8.4e6)],1):
 tpv=users*volume*12; sub=users*share*15*12; msub=merchants*49*12; pay=tpv*take; variable=tpv*.003+users*1.5*12+merchants*10*12
 years.append(dict(year=i,users=users,merchants=merchants,paid_share=share,volume=volume,take=take,tpv=tpv,consumer_revenue=sub,merchant_revenue=msub,payment_revenue=pay,revenue=sub+msub+pay,variable=variable,contribution=sub+msub+pay-variable,fixed=fixed,result=sub+msub+pay-variable-fixed))
assert round(sum(x[1] for x in costs),6)==8.4 and round(sum(x[2] for x in costs),6)==6.6
model={'currency':'LYD','date':'2026-09-21','assumption_status':'Planning assumptions, not quotes or forecasts','costs':costs,'years':years,'base_fixed_24m':15e6,'contingency':5.25e6,'capital_provision':5e6,'settlement_reserve':2e6,'extra_liquidity':2.75e6,'funding_target':30e6,'sources':SOURCES}
(TMP/'model.json').write_text(json.dumps(model,ensure_ascii=False,indent=2))
doc=Document(); sec=doc.sections[0];sec.page_width=Inches(8.27);sec.page_height=Inches(11.69);sec.top_margin=Inches(.72);sec.bottom_margin=Inches(.65);sec.left_margin=sec.right_margin=Inches(.78)
styles=doc.styles
for name in ['Normal','Body Text','List Bullet']:
 styles[name].font.name='Arial';styles[name].font.size=Pt(10.5);styles[name].font.color.rgb=RGBColor.from_string('27313E');styles[name].paragraph_format.space_after=Pt(7);styles[name].paragraph_format.line_spacing=1.12
for name,size in [('Title',30),('Heading 1',23),('Heading 2',13)]:
 styles[name].font.name='Arial';styles[name].font.size=Pt(size);styles[name].font.bold=True;styles[name].font.color.rgb=RGBColor.from_string('000000' if name=='Title' else '193F66');styles[name].paragraph_format.space_after=Pt(12)
footer=sec.footer.paragraphs[0];footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT
r=footer.add_run('tazdan  /  Feasibility study  /  ');r.font.size=Pt(8);r.font.color.rgb=RGBColor.from_string('6B7788')
fld=OxmlElement('w:fldSimple');fld.set(qn('w:instr'),'PAGE');footer._p.append(fld)
def p(text):doc.add_paragraph(text)
def h(text):doc.add_heading(text,2)
def page(title):doc.add_page_break();doc.add_heading(title,1)
def bullet(text):doc.add_paragraph(text,'List Bullet')
def table(headers,rows,widths=None):
 t=doc.add_table(rows=1,cols=len(headers));t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
 for i,v in enumerate(headers):
  t.rows[0].cells[i].text=str(v)
  if widths:t.columns[i].width=Inches(widths[i])
 for row in rows:
  cells=t.add_row().cells
  for i,v in enumerate(row):cells[i].text=str(v)
 for ri,row in enumerate(t.rows):
  trPr=row._tr.get_or_add_trPr();cant=OxmlElement('w:cantSplit');trPr.append(cant)
  if ri==0:rep=OxmlElement('w:tblHeader');trPr.append(rep)
  for ci,c in enumerate(row.cells):
   if widths:c.width=Inches(widths[ci])
   c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
   pr=c._tc.get_or_add_tcPr();m=OxmlElement('w:tcMar')
   for side,val in [('top','100'),('bottom','100'),('left','110'),('right','110')]:el=OxmlElement('w:'+side);el.set(qn('w:w'),val);el.set(qn('w:type'),'dxa');m.append(el)
   pr.append(m)
   shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'EAF2FA' if ri==0 else ('F7F9FC' if ri%2 else 'FFFFFF'));pr.append(shade)
   for pa in c.paragraphs:
    pa.paragraph_format.space_after=Pt(0);pa.paragraph_format.line_spacing=1.05
    for run in pa.runs:run.font.size=Pt(9);run.bold=ri==0
 doc.add_paragraph().paragraph_format.space_after=Pt(0)
 return t
def link(label,url):
 pa=doc.add_paragraph(); hyp=OxmlElement('w:hyperlink');rid=pa.part.relate_to(url,'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',is_external=True);hyp.set(qn('r:id'),rid);r=OxmlElement('w:r');pr=OxmlElement('w:rPr');col=OxmlElement('w:color');col.set(qn('w:val'),'245E97');pr.append(col);r.append(pr);tx=OxmlElement('w:t');tx.text=label;r.append(tx);hyp.append(r);pa._p.append(hyp)

doc.add_heading('tazdan Libya crypto and remittances feasibility study',0)
p('Investment planning and launch assessment | 21 September 2026')
h('Decision in brief')
p('Proceed with a gated domestic payments pilot, subject to written confirmation of the regulatory route and a bank or licensed payment partner. The proposed business connects a Libyan dinar wallet, supported crypto and international remittances. A domestic payments pilot is the initial financial foundation; crypto conversion, custody and cross-border payout need separate legal and partner approval. The product remains prelaunch. No revenue, customer traction, signed partner or licence is assumed to exist.')
p('A 30.00 million LYD funding envelope provides substantial room for licensing work, development and operational uncertainty. It includes 15.00 million LYD of planned fixed spending over 24 months, a 35% cost contingency, separate capital and settlement provisions, and additional unrestricted liquidity. These are deliberately conservative planning allowances, not supplier quotes or official licensing tariffs.')
table(['Funding use','Million LYD'],[['24 month fixed spending', '15.00'],['35% cost contingency','5.25'],['Regulatory capital provision','5.00'],['Settlement and partner collateral reserve','2.00'],['Additional unrestricted liquidity','2.75'],['Total funding envelope','30.00']],[4.8,1.85])
p('The central operating scenario reaches a positive annual operating result of 2.13 million LYD in Year 3, but only at 120,000 average monthly active customers and the assumed merchant pricing. A downside case remains loss-making. This is conditional feasibility, not proof of profitability.')
h('Scope and definitions')
p('Year 1 begins when the funded programme starts. Customer and merchant figures are full-year averages, so launch delays directly reduce revenue. All budgets, fees and projections are in LYD. Restricted capital, partner collateral and customer funds are not available to pay operating expenses. Financial results are cash operating proxies before tax, financing and accounting capitalisation.')

page('Market evidence and the initial customer')
p('Libya already has digital payment infrastructure and incumbent providers. The opportunity is to offer a coherent customer experience on authorised rails, rather than assume an empty market. The CBL’s 2025–2029 financial inclusion strategy supports wider access to financial services, but does not authorise this project. [S1, S2]')
table(['Historical indicator','CBL reported figure'],[['Electronic payment value, January–November 2025','328.0 billion LYD'],['Point of sale terminals, November 2025','150,019'],['Electronic wallets, November 2025','183,435'],['Wallet acceptance points, November 2025','6,069']],[4.8,1.85])
p('Source: CBL statement through 30 November 2025, page 6. These figures describe different instruments and are not additive. Terminal and wallet counts are not unique people. Total payment value includes flows beyond tazdan’s target segment and is not addressable revenue. [S3]')
h('Initial target segment')
p('Begin with salaried, smartphone-using adults and merchants in compact districts of Tripoli and Benghazi. Prioritise everyday retail, food and household spending. Family transfers and shared bills create recurring use. Treat freelancers and travellers as research segments until permitted international services are available.')
h('Bottom up opportunity assumption')
p('A planning serviceable market of 500,000 reachable consumers, spending 800 LYD per month through eligible merchants, implies 4.8 billion LYD annual payment value. At a hypothetical 0.7% gross take rate, that is 33.6 million LYD annual payment revenue before processing and operating costs. The 500,000 consumers and spend level are hypotheses, not measured market facts.')
p('Year 3 average usage of 120,000 customers equals 24% of that assumed reachable group. This is demanding and requires evidence before scale funding. Commission 100 consumer interviews, 30 merchant interviews and a paid pilot to validate acceptance, repeat use, price sensitivity and reachable distribution.')
h('Competition and differentiation')
p('Benchmark bank apps and instant transfer services, existing wallet providers such as those in the CBL directory, and cash. Measure onboarding time, payment completion, merchant settlement and dispute handling. Current authorisations must be checked directly, especially entries with past expiry dates. The proposed differentiation is a consistent Arabic and English experience, LYD budgeting and useful merchant records. Revolut is a product reference, not an assumed partner or operating model. [S1, S3]')

page('Product scope and commercial model')
table(['Phase','Proposed customer experience','Release condition'],[['Domestic pilot','LYD wallet, verified users, payments, receipts and support','Approved scope, partner settlement and controlled limits'],['Domestic expansion','Merchant QR or links, savings pockets and reports','Pilot economics and operational acceptance'],['Crypto and remittance option','Eligible crypto custody or conversion, partner remittances and cards','Explicit activity, custody, FX and corridor approvals']],[1.25,3.1,2.3])
p('Savings pockets allocate existing customer balances. They do not imply interest, investment returns or deposit insurance. Crypto access and remittances are central to the product vision. Exclude lending and unapproved trading, custody or foreign exchange from the initial domestic pilot. Existing app screenshots are concept assets, not evidence that those legacy features are cleared for launch.')
table(['Proposed plan','Monthly price','Included experience'],[['Everyday','0 LYD','LYD wallet, local payments and basic spending insights'],['Plus','15 LYD','Custom pockets, monthly reports and priority support'],['Business','49 LYD','Payment requests, merchant reports and onboarding support']],[1.2,1.2,4.25])
p('Subscriptions exclude separately disclosed processing, cash service and future international fees. Pricing is proposed and subject to consumer testing, regulatory requirements and partner contracts. Waitlist signup costs 0 LYD. No subscription is collected before launch.')
h('Revenue mechanics')
p('The model recognises consumer subscription revenue from paid active customers, merchant subscription revenue from active paying businesses, and an assumed percentage of eligible merchant payment value. It counts each payment once and excludes free person-to-person transfers from monetised volume. The domestic financial foundation excludes interest on customer balances, crypto spreads, international income and uncontracted interchange. The crypto and remittance option has a separate illustrative model below; it is not counted twice.')
h('Commercial validation')
p('Require signed terms for processing costs, settlement periods, minimum monthly charges, refund fees, card programme fees and FX spreads before pricing a live service. Confirm whether merchant fees can legally be charged and whether the proposed take rate is realistic. Banking partner costs may consume most of a small merchant fee.')

page('Licensing and partner feasibility')
p('The CBL publishes electronic payment regulations and a provider directory covering different activity categories. Payment scheme rules discuss payment service providers acting within delegated powers and bank-related approval arrangements. This supports investigating a partnership route, but does not establish that tazdan may operate without its own authorisation. [S1, S5]')
table(['Workstream','Evidence required before launch','Accountable role'],[['Corporate and licensing scope','Written local legal opinion and regulator engagement on wallet, processing, agency and outsourcing scope','CEO and local counsel'],['Banking and safeguarding','Executed partner agreement, segregated accounts, daily reconciliation and insolvency treatment','Finance lead'],['AML and customer due diligence','Approved onboarding policy, sanctions screening, monitoring and reporting arrangements','Compliance officer'],['Data and security','Hosting approval where required, privacy terms, access controls, incident response and independent assessment','CTO and security lead'],['International services','Issuer eligibility, approved corridors, FX access, settlement currency and scheme permissions','Partnerships and counsel']],[1.4,3.95,1.3])
h('Unpriced obligations')
p('The 1.50 million LYD legal and licensing-work allowance covers counsel, application preparation, policy work and a provisional fee allowance. It is not a published licence price. The separate 5.00 million LYD capital provision is not a verified statutory minimum. Local counsel must confirm actual capital, guarantees, ownership, governance, fit-and-proper and renewal requirements. A requirement above this provision triggers a funding revision before commitment.')
h('International constraint')
p('The IMF’s 2025 annex documents foreign exchange restrictions, including constraints affecting personal payments and some remittances. Rules and taxes can change. Obtain a dated current opinion for each intended flow, including nonresident services and destination-country obligations. International access cannot be promised from a domestic wallet approval alone. [S4]')
h('Decision gate')
p('Do not receive customer money until the approved provider, authorised scope, safeguarding approach and customer terms are clear. A partner letter of intent alone is insufficient. Seek at least two viable bank or processor options to reduce concentration risk.')

page('Crypto and international remittance feasibility')
p('The strategic proposition is a connected experience for Libyans: a LYD starting point, access to eligible digital assets and international transfers to people who matter. Product positioning can include all three; commercial availability must follow the permissions for each activity and each jurisdiction.')
h('Legal feasibility remains a stop gate')
p('Historical reporting describes a 2018 CBL warning that virtual currencies were illegal and lacked legal protection. A June 2025 Libyan News Agency report describes plans to prepare a legal and technical framework for digital and encrypted currencies. Neither establishes present permission to offer crypto custody, exchange or settlement to Libyan residents. Obtain current primary legal confirmation. If the intended activity remains prohibited, do not launch that leg of the business. An overseas company or provider does not by itself remove Libyan restrictions. [S8, S9]')
h('Proposed partner transaction route')
p('After explicit authorisation: identify and verify the sender; quote the full LYD cost and recipient amount; collect through an approved funding provider; route via a licensed remittance partner; use an approved crypto or stablecoin settlement route only where permitted; and pay the beneficiary through an authorised local payout provider. A blockchain confirmation is not proof of bank payout. Track both events and define refund handling.')
p('Evaluate Tunisia, Turkey, the UK and the UAE as research candidates, not announced coverage. Score each route for demand, lawful origination, recipient eligibility, counterparties, settlement access and total payout cost. Select one corridor first. Do not assume a foreign crypto licence permits local payout or solicitation in Libya.')
h('Controls and incremental allowances')
p('Allow 0.45 million LYD for custody and wallet-provider setup, 0.60 million for chain analytics and Travel Rule tooling, 0.75 million for corridor counsel and partner due diligence, 0.60 million for extra security assurance and 0.60 million for payout integration. These incremental estimates total 3.00 million LYD before a 35% contingency, or 4.05 million LYD including it. Keep this optional allocation outside the domestic 30.00 million LYD envelope unless the board formally re-scopes it. Combined planning envelope: 34.05 million LYD, excluding any additional required foreign capital or liquidity.')
p('Require counterparty due diligence, wallet screening, applicable originator and beneficiary information sharing, custody controls, transaction monitoring, sanctions controls, redemption checks and stablecoin concentration limits. FATF guidance informs this work, while actual duties depend on enacted local rules. Stablecoins can depeg or become difficult to redeem. [S7]')
h('Illustrative corridor economics')
p('At 5,000 transfers per month averaging 1,000 LYD, a 1.5% customer fee produces 75,000 LYD monthly revenue. At 0.9% partner, liquidity and payout costs plus 2 LYD support and expected loss per transfer, contribution is 20,000 LYD monthly before fixed costs. A 50% volume decline reduces it to 10,000 LYD. This case is not in the domestic projection and does not justify the incremental investment by itself. Quote the real corridor, minimum fees and settlement float before approval.')

page('Technology and operational design')
p('Use the existing website and mobile work as a product starting point. A marketing page and app screenshots do not validate the payment backend. Budget for a ledger and settlement review before reusing production code.')
h('Transaction integrity')
p('Use a double-entry ledger with immutable entries, idempotency keys and a defined payment state machine. Record pending, posted, failed and reversed events separately. Reconcile internal balances, bank statements and processor records daily. Never let a client-side success screen determine whether a payment posted. Introduce dual approval for manual adjustments and treasury movements.')
h('Security and privacy')
p('Separate production access from development. Use strong authentication, device risk checks, secrets management, least-privilege roles, audited admin actions and encrypted communications. Minimise card data exposure through a qualified partner. Confirm the applicable PCI scope instead of assuming outsourcing eliminates all obligations. Commission penetration testing and independent closure of high-severity findings. [S5]')
h('Reliability requirements proposed for the pilot')
table(['Measure','Planning acceptance threshold'],[['Payment success excluding customer declines','At least 99% across an agreed pilot sample'],['Reconciliation','Daily completion and no unexplained balance breaks'],['Critical security findings','None unresolved at release'],['Recovery targets','RTO within 4 hours and RPO within 15 minutes'],['Customer complaints','Traceable ticket ownership and agreed response times']],[3.45,3.2])
p('These are engineering acceptance targets, not current service claims. A disaster recovery exercise must prove restoration before public launch. Test intermittent connectivity, delayed bank responses, duplicate requests, refunded payments and interrupted identity checks on real devices.')
h('Local operating model')
p('Support Arabic and English. Establish escalation paths for failed funding, mistaken transfers, fraud, merchant disputes and account recovery. Clearly distinguish an app balance from available settlement funds. Plan redundant connectivity and power at support sites, local bank holidays, and manual continuity procedures that preserve approval controls.')

page('Team and route to market')
h('Staffing allowance')
p('The 3.60 million LYD engineering budget is equivalent to a delivery squad averaging 150,000 LYD per month for 24 months, including development, QA and technical management. The 4.80 million LYD operations payroll is a separate annualised allowance: eight roles averaging 20,000 LYD fully loaded per month plus a senior compliance or risk lead at 40,000 LYD per month. These are budget equivalents, not salary quotations.')
p('Operational roles cover customer support, merchant operations, reconciliation, finance, partnerships, risk and management. Phase hiring to milestones. Engineering payroll must not be counted again inside operations payroll. Independent audits remain in the assurance budget rather than staff costs.')
h('Launch sequence')
table(['Period from funding','Activity','Evidence needed to advance'],[['Months 0–3','Customer discovery, legal scope and partner procurement','Regulatory route, costed partner terms and demand evidence'],['Months 4–9','Build, integration and controlled testing','Reconciled ledger, security closure and compliant onboarding'],['Months 10–12','Restricted domestic pilot if authorised','Repeat use, complaint handling and merchant settlement'],['Months 13–24','Expand within proven domestic districts','Positive contribution per active customer and stable rails']],[1.35,2.75,2.55])
h('Distribution assumptions')
p('Start with neighbourhood merchant clusters and employer or community introductions. Use merchant training and referrals after successful settlement, rather than paying broadly for unverified signups. Pilot targets are 50–100 active merchants and 1,000–2,000 verified active consumers. The central Year 1 average of 10,000 active consumers requires a faster approved ramp than a late pilot would produce. Treat it as a commercial scenario, not the default launch forecast.')
p('The 1.50 million LYD acquisition budget over two years is deliberately limited until activation and retention are proven. At an illustrative 40 LYD incremental acquisition cost, it buys at most 37,500 acquired users before merchant setup and retention spend. Reaching 80,000 end-Year-2 actives therefore depends heavily on partner distribution and retained organic referrals. Validate that dependency before approving scale.')

page('Conservative cost and funding plan')
p('All amounts below are million LYD. The fixed budget deliberately allows for substantial outsourcing, compliance work and external assurance. Replace estimates with at least two quotations per material workstream. Year 1 carries most setup costs. Year 2 carries a larger recurring operations team.')
table(['Fixed spending category','Year 1','Year 2','24 months'],[[name,f'{a:.2f}',f'{b:.2f}',f'{a+b:.2f}'] for name,a,b in costs]+[['Total fixed spending','8.40','6.60','15.00']],[3.7,.95,.95,1.05])
h('Contingency and restricted funds')
p('Add 35% of fixed spending, or 5.25 million LYD, as an unallocated cost contingency. Hold a 5.00 million LYD provisional regulatory capital allowance and 2.00 million LYD for settlement, collateral or partner deposits separately. Both require contractual or regulatory confirmation. Add 2.75 million LYD of unrestricted liquidity to reach the 30.00 million LYD envelope.')
p('The 2.00 million LYD settlement reserve is only an early-stage allowance. At Year 3 modelled payment volume of 1.44 billion LYD, average daily volume is about 3.95 million LYD. Two days of full prefunding would require about 7.89 million LYD before a risk haircut. Negotiate settlement mechanics and resize reserves as volume grows.')
h('Spending controls')
p('Capital and collateral are balance-sheet funding needs, not operating expenses. Customer balances must remain fully outside the company’s spending budget. Contingency is a reserve, not a target to spend. Record forecast-to-complete monthly and require board approval for material reserve drawdowns. FX shock coverage is a sensitivity allowance; it is not an assumed official exchange rate.')

page('Three year operating scenarios')
p('The central case below is an assumption set, not a forecast. Annual averages differ from year-end active customer targets of 20,000, 80,000 and 160,000. Variable costs scale with volume and activity. Fixed spending in Years 1 and 2 reconciles to the 15.00 million LYD budget.')
table(['Operating assumption','Year 1','Year 2','Year 3'],[['Average active consumers','10,000','45,000','120,000'],['Average paying merchants','200','800','2,500'],['Consumers on Plus','10%','15%','20%'],['Eligible LYD spend per user per month','600','800','1,000'],['Gross merchant payment take rate','0.60%','0.70%','0.80%'],['Processing and loss allowance on volume','0.30%','0.30%','0.30%']],[3.65,1,1,1])
def m(v):return f'{v/1e6:,.3f}'
table(['Financial result in million LYD','Year 1','Year 2','Year 3'],[[label]+[m(y[key]) for y in years] for label,key in [('Eligible payment value','tpv'),('Consumer subscription revenue','consumer_revenue'),('Merchant subscription revenue','merchant_revenue'),('Payment revenue','payment_revenue'),('Total revenue','revenue'),('Variable service costs','variable'),('Contribution after variable costs','contribution'),('Fixed spending','fixed'),('Operating result before tax and financing','result')]],[3.65,1,1,1])
p('Revenue = users × paid share × 15 LYD × 12 + merchants × 49 LYD × 12 + eligible payment value × take rate. Eligible payment value = average users × monthly eligible spend × 12. Variable costs = 0.30% of payment value + users × 1.50 LYD × 12 + merchants × 10 LYD × 12.')
p('The payment take rate is gross revenue before processing costs. No international revenue, interest, debt service, taxation or capitalised-development accounting enters these figures. Tax and cash timing require a formal financial model before investment close. The 35% contingency is outside this central operating result.')

page('Unit economics and downside tests')
h('Central Year 3 economics')
p('Each active consumer generates 8.00 LYD of monthly gross payment revenue on 1,000 LYD eligible spend and 3.00 LYD weighted subscription revenue at 20% Plus penetration. Deduct 3.00 LYD processing and losses plus 1.50 LYD servicing to obtain 6.50 LYD monthly contribution. Each merchant contributes 39 LYD monthly subscription margin after 10 LYD servicing.')
p('At 2,500 merchants, monthly merchant contribution is 97,500 LYD. With fixed spending of 700,000 LYD per month, operating break-even requires about 92,693 average active consumers: (700,000 − 97,500) ÷ 6.50. This holds merchant count fixed. An illustrative 40 LYD consumer acquisition cost has a 6.2 month simple payback at mature contribution, before churn and ramp-up.')
table(['Year 3 sensitivity','Revenue','Operating result'],[['Central case, million LYD','17.310','+2.130'],['Downside: 60,000 users, 1,250 merchants, 600 LYD spend, 10% paid, 0.6% take','4.407','−6.951'],['Upside: 180,000 users, 3,750 merchants, 1,200 LYD spend, 25% paid, 0.8% take','31.041','+7.575']],[4.0,1.25,1.4])
p('Downside uses a 0.40% processing/loss allowance and 8.40 million LYD fixed spending. Upside uses a 0.30% allowance and 12.00 million LYD fixed spending to support expansion. Both retain 1.50 LYD consumer and 10 LYD merchant monthly servicing costs. Outcomes are illustrative and unweighted, not probabilities.')
h('Delay and cost shock')
p('A six-month delay at the average fixed burn of 625,000 LYD per month uses 3.75 million LYD. A 25% price shock affecting 40% of the 15.00 million LYD fixed budget adds 1.50 million LYD. Together they use the entire 5.25 million LYD contingency, leaving the 2.75 million LYD unrestricted headroom. The 7.00 million LYD restricted provisions remain unavailable for operating spend.')
p('With no revenue and no activity-dependent variable cost, 23.00 million LYD unrestricted funding covers about 36.8 months at the average fixed burn. This is a static sensitivity, not promised runway. Hiring changes, taxes, minimum partner fees and larger capital requirements can shorten it.')

page('Investment gates and principal risks')
table(['Risk','Response and release condition'],[['Regulatory route or capital exceeds budget','Secure a dated local opinion. Rebudget before accepting obligations or customer funds.'],['Bank or processor will not support the model','Maintain alternatives. Agree limits, prefunding, outages and exit migration.'],['Low adoption or willingness to pay','Use a restricted paid pilot. Measure activated customers, repeat payments and contribution.'],['Fraud, account takeover or reconciliation gaps','Limit early transactions, monitor exceptions and test recovery. Halt scale on unexplained breaks.'],['FX access, liquidity or corridor restrictions','Keep international services outside the domestic revenue case. Approve corridors individually.'],['Power, connectivity and service interruptions','Redundant infrastructure, bank status handling and documented continuity procedures.'],['Customer complaints and loss of trust','Clear LYD fees, accessible support, dispute ownership and published provider details.']],[2.25,4.4])
h('Proposed funding releases')
p('Tranche A: 5.00 million LYD for discovery, counsel, partner selection and early engineering. Tranche B: 10.00 million LYD only after a viable regulatory route, costed partner arrangements and approved technical design. Tranche C: 15.00 million LYD after security acceptance, approval to run the pilot and confirmed capital requirements. Reallocate between restricted and unrestricted uses only against written requirements. These are proposed gates, not committed financing.')
h('First ninety days')
p('The CEO and counsel own the licensing memorandum and regulator meeting. The partnerships lead obtains bank and processor term sheets. The CTO completes a ledger, security and mobile readiness audit. Product and operations complete customer interviews, merchant pilots without real-money movement where approval is pending, and a service manual. Finance replaces provisions with quotations and builds a monthly cash model including taxes and working capital.')
h('Conclusion')
p('The domestic foundation warrants structured validation; crypto and remittances require an additional legal and commercial gate. The project becomes investable when authorised access, reliable settlement and retained paying usage support the economics. A 30.00 million LYD envelope gives negotiating room and delay protection, but cannot guarantee that every licensing route or international programme fits. Scale should follow evidence, not the size of the reserve.')

page('Sources and assumption register')
p('Primary sources below support the market and regulatory context. Access date: 21 September 2026. Historical statistics retain their reporting periods. Public information cannot replace written local legal advice, partner due diligence or executed commercial terms.')
for sid,title,url,note in SOURCES:
 link(f'{sid}  {title}',url);p(note)
h('Assumptions requiring validation')
p('All tazdan budgets, customer counts, merchant counts, conversion rates, prices, payment volumes, acquisition costs and operating results are planning assumptions. No supplier quote, regulatory fee schedule, licence, partnership, verified demand survey, signed customer or historical tazdan financial statement underpins them.')
p('Priority replacements: official licensing and capital requirements; legal and tax opinions; bank and processor pricing; permitted fee structures; issuer and FX corridor terms; staff and contractor quotes; cloud/security tenders; pilot retention and monetised volume; and a monthly cash forecast with restricted funds separated.')
p('The website’s 0, 15 and 49 LYD proposed monthly plans match this study. Existing app screenshots remain visual concepts and may contain legacy currency examples. The model excludes revenue from legacy crypto functions and from international services until independently authorised and costed.')
for st in doc.styles:
 for border in list(st.element.iter(qn('w:pBdr'))):border.getparent().remove(border)
OUT.mkdir(exist_ok=True);doc.save(OUT/'tazdan-feasibility-study.docx');print(json.dumps(years,indent=2));print('Wrote feasibility study')
