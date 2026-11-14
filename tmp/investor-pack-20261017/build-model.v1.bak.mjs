import fs from 'node:fs/promises';
import path from 'node:path';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const base=path.dirname(new URL(import.meta.url).pathname), root=path.resolve(base,'../..');
const out=path.join(root,'deliverables/Tazdan_Investor_Pack_2026-10-17/04_Financial_Model');
const wb=Workbook.create();
const names=['Summary','Assumptions','Forecast','Fee calculator','Acquisition','Deal structure','CBL actuals','Review','Model guide'];
const sh=Object.fromEntries(names.map(n=>[n,wb.worksheets.add(n)]));
const ink='#132B38',green='#08754D',blue='#175DDC',pale='#EDF3F5',amber='#FFF1CA';
const money='$#,##0;($#,##0);"-"',num='#,##0.0;(#,##0.0);"-"',pct='0.00%;(0.00%);"-"',cents='$0.00;($0.00);"-"';
function put(s,a,v){sh[s].getRange(a).values=[[v]];}
function f(s,a,v){sh[s].getRange(a).formulas=[[v]];sh[s].getRange(a).format.font.color=/!/.test(v)?green:'#111111';}
function title(s,t){put(s,'C2',t);sh[s].getRange('C2').format.font={name:'Arial',size:16,bold:true,color:ink};}
function note(s,a,t){put(s,a,t);sh[s].getRange(a).format.font={name:'Arial',size:10,italic:true,color:'#526372'};}
function band(s,r,end='J'){sh[s].getRange(`C${r}:${end}${r}`).format.fill=pale;sh[s].getRange(`C${r}:${end}${r}`).format.font.bold=true;}
for(const n of names){const s=sh[n];s.showGridLines=false;s.getRange('A1:AR100').format.font={name:'Arial',size:10,color:ink};s.getRange('A1:AR100').format.rowHeight=23;s.getRange('A:B').format.columnWidth=2;s.getRange('C:C').format.columnWidth=45;s.getRange('D:AR').format.columnWidth=16;s.getRange('C1:AR100').format.verticalAlignment='center';}
sh.Summary.tabColor=ink;sh.Assumptions.tabColor='#4A6C80';
title('Assumptions','Tazdan forecast assumptions');
put('Assumptions','C5','Case selected  1 Downside  2 Base  3 Growth');put('Assumptions','D5',2);f('Assumptions','F5','=CHOOSE(D5,"Downside","Base","Growth")');
sh.Assumptions.getRange('D5').dataValidation={rule:{type:'list',values:['1','2','3']}};
note('Assumptions','C6','Blue inputs are planning estimates. No bank pricing or launch approval is assumed.');
sh.Assumptions.getRange('C8:J8').values=[['Driver','Active','Downside','Base','Growth','Unit','','Basis']];band('Assumptions',8);
sh.Assumptions.getRange('J:J').format.columnWidth=85;
const params=[
 ['launch','Assumed launch month',10,6,4,'month','After company funding; delay sensitivity, not an approval forecast'],
 ['cac','All-in cost per new settled customer',45,30,22,'USD','Includes media, field operations and earned referral rewards'],
 ['churn','Monthly active customer attrition',.06,.035,.025,'%','Opening active customers; retention unverified'],
 ['frequency','Transfers per average active customer',1.1,1.3,1.5,'count','Expected values, not observed usage'],
 ['ticket','Average sender principal',500,750,1000,'USD','USD equivalent before fees; customer limits still apply'],
 ['fee','Explicit fee rate',.001,.001,.001,'%','Proposed fee only; classification and approved ceiling pending'],
 ['fixedFee','Explicit fee per transfer',0,0,0,'USD','Deducted from sender principal in this model'],
 ['spread','FX markup on reference cost rate',.003,.0035,.004,'%','Hypothesis; quote LYD per recipient USD; no current exchange rate implied'],
 ['provider','Rail cost rate on converted principal',.002,.0012,.0008,'%','Unsigned provider estimate; excludes any cost already in FX slippage'],
 ['providerFixed','Rail cost per transfer',1,.5,.3,'USD','Additional per-payment processing estimate'],
 ['loss','Expected loss cash budget rate',.0007,.0003,.0002,'%','Sender principal; assumes economic losses consume cash in month'],
 ['slip','FX liquidity and slippage cost rate',.001,.0004,.0002,'%','Net converted principal; separate from reference-rate markup'],
 ['share','Partner revenue share',.15,.10,.08,'%','Applied to explicit fee plus FX gross margin'],
 ['prefund','Corporate prefunding days',7,5,4,'days','Only own corporate funds; lawful replenishment is a separate prerequisite'],
 ['stress','Prefunding stress multiplier',2,1.5,1.5,'multiple','Currency pool fragmentation may require more liquidity'],
 ['preMkt','Monthly prelaunch waitlist budget',5000,8000,12000,'USD','Produces no funded customers before model launch'],
 ['mkt1','Monthly acquisition budget year 1',12000,18000,25000,'USD','All-in CAC spend after launch, inclusive of rewards'],
 ['mkt2','Monthly acquisition budget year 2',15000,24000,35000,'USD','Year means months after funding'],
 ['mkt3','Monthly acquisition budget year 3',15000,30000,50000,'USD','Regional expansion capacity unproven'],
 ['staff1','Employees year 1',8,10,12,'FTE','Includes leadership, engineering, operations and control functions'],
 ['staff2','Employees year 2',10,14,20,'FTE','Planning headcount; not existing staff'],
 ['staff3','Employees year 3',12,18,28,'FTE','Planning headcount'],
 ['salary','Loaded monthly cost per employee',3500,4000,4500,'USD','Includes assumed employer costs and founder replacement compensation'],
 ['other1','Monthly nonstaff opex year 1',12000,18000,25000,'USD','Hosting, legal, audit, compliance vendors, insurance and facilities estimate'],
 ['other2','Monthly nonstaff opex year 2',15000,25000,40000,'USD','Provider minimum fees need signed quotes'],
 ['other3','Monthly nonstaff opex year 3',18000,30000,60000,'USD','No hidden additional software capitalisation'],
 ['setup','One-time setup expense and cash',250000,400000,650000,'USD','Expense in month 1; not an estimate of statutory licence capital'],
 ['funding','Proposed primary company funding',10000000,10000000,10000000,'USD','Proposed future financing, not secured cash; excludes founder secondary'],
 ['restricted','Restricted collateral budget reserve',500000,1000000,1500000,'USD','Planning reserve, not a regulatory capital requirement; do not deduct paid-up equity twice'],
 ['b2bStart','First assumed accepted B2B rollout month',5,4,3,'month','Acceptance and contracts unverified'],
 ['b2bNew','Accepted B2B rollouts per quarter',.5,1,2,'customers','Expected customer equivalents; not signed orders'],
 ['b2bChurn','Monthly B2B attrition',.01,.005,.003,'%','Applied to opening subscribed customers'],
 ['annual','Annual subscription price',60000,120000,150000,'USD','Proposal requiring willingness-to-pay validation'],
 ['pilot','Accepted pilot fee per new rollout',15000,25000,30000,'USD','Separate from subscription and rollout; no credit assumed'],
 ['rollout','Accepted rollout fee per new customer',45000,75000,90000,'USD','Recognised with assumed accepted delivery, not on signing'],
 ['subCost','Direct recurring software delivery cost',.4,.3,.25,'%','Additional contracted hosting/support, excluding the separately budgeted central employees'],
 ['setupCost','Direct project delivery cost',.6,.5,.45,'%','External project delivery costs, excluding the separately budgeted central employees'],
 ['lag','B2B invoice collection lag',2,1,1,'months','Monthly billing assumption; annual prepayment is not assumed'],
 ['tax','Budget reserve for future tax',.15,.15,.15,'%','Reserve on positive model result; not a statutory tax rate or tax return calculation'],
 ['ceiling','Provisional all-in pricing guardrail',.005,.005,.005,'%','Commercial guardrail only; CBL circular scopes and separate charges require confirmation'],
];
const pr={};
params.forEach(([key,label,d,b,g,unit,basis],i)=>{const r=9+i;pr[key]=r;sh.Assumptions.getRange(`C${r}:J${r}`).values=[[label,null,d,b,g,unit,'',basis]];f('Assumptions',`D${r}`,`=CHOOSE($D$5,E${r},F${r},G${r})`);sh.Assumptions.getRange(`E${r}:G${r}`).format.font.color=blue;sh.Assumptions.getRange(`D${r}:G${r}`).setNumberFormat(unit==='%'?pct:unit==='USD'?money:num);});
sh.Assumptions.getRange('D5').format.fill=amber;sh.Assumptions.getRange('D5').format.font.color=blue;sh.Assumptions.freezePanes.freezeRows(8);
put('Assumptions','C52','Planned funding date');put('Assumptions','D52',new Date('2026-11-01T00:00:00Z'));sh.Assumptions.getRange('D52').setNumberFormat('mmm-yy');sh.Assumptions.getRange('D52').format.font.color=blue;
put('Assumptions','C54','Pricing approval documented  0 No  1 Yes');put('Assumptions','D54',0);put('Assumptions','C55','Launch permissions documented  0 No  1 Yes');put('Assumptions','D55',0);put('Assumptions','C56','Provider contracts documented  0 No  1 Yes');put('Assumptions','D56',0);
sh.Assumptions.getRange('D54:D56').dataValidation={rule:{type:'list',values:['0','1']}};sh.Assumptions.getRange('D54:D56').format.fill=amber;
note('Assumptions','C58','These evidence fields report readiness. Forecasts remain hypothetical even when populated.');
const A=k=>`'Assumptions'!$D$${pr[k]}`;

title('CBL actuals','CBL published market context');
sh['CBL actuals'].getRange('C5:G5').values=[['Reported category','USD equivalent','Period','PDF page','Source']];band('CBL actuals',5,'G');
const cblURL='https://cbl.gov.ly/micifaf/2026/10/'+encodeURIComponent('تقــــرير-إستخدامات-المصارف-للنقد-الأجنبي-حتى-نهاية-سبتمبر-2026')+'.pdf';
sh['CBL actuals'].getRange('C6:G10').values=[['Total bank FX uses',19341501336,'Jan-Sep 2026',2,cblURL],['Documentary letters of credit',10113469233,'Jan-Sep 2026',2,cblURL],['Transfers',2681416804,'Jan-Sep 2026',2,cblURL],['Personal purposes',6507616299,'Jan-Sep 2026',2,cblURL],['Observed months',9,'Jan-Sep 2026',null,'https://cbl.gov.ly/uses-of-foreign-exch/']];
put('CBL actuals','C12','Monthly mean transfers');f('CBL actuals','D12','=D8/D10');put('CBL actuals','C13','Annualised transfers arithmetic');f('CBL actuals','D13','=D12*12');sh['CBL actuals'].getRange('D6:D13').setNumberFormat(money);sh['CBL actuals'].getRange('D10').setNumberFormat('0');
sh['CBL actuals'].getRange('G:G').format.columnWidth=90;sh['CBL actuals'].getRange('G6:G10').format.wrapText=true;sh['CBL actuals'].getRange('C6:G10').format.rowHeight=60;
note('CBL actuals','C16','Transfers are not a consumer remittance TAM. No corridor split or customer count is inferred.');
note('CBL actuals','C18','CBL circular 8/2026 addresses FX-sale margins. Applicability and permitted extra fees remain unconfirmed.');
put('CBL actuals','G18','https://cbl.gov.ly/publication/'+encodeURIComponent('منشور-8-2026')+'/');

title('Forecast','Monthly operating and liquidity model');
put('Forecast','C3','Case selected');f('Forecast','D3',"='Assumptions'!F5");
const labels={7:'Opening active consumers',8:'Acquisition and waitlist cash spend',9:'Cost per new settled consumer',10:'New settled consumers',11:'Consumer attrition',12:'Closing active consumers',13:'Average active consumers',14:'Transfers',15:'Sender principal volume',18:'Explicit fee revenue',19:'Principal converted at reference',20:'FX gross margin',21:'Gross consumer revenue',22:'Partner share of gross revenue',23:'Retained consumer revenue',24:'Rail processing expense',25:'Expected loss cash budget',26:'FX slippage expense',27:'Consumer contribution',29:'Opening subscribed B2B customers',30:'Accepted new B2B rollouts',31:'B2B attrition',32:'Closing B2B customers',33:'Average subscribed B2B customers',34:'Subscription revenue',35:'Pilot and rollout revenue',36:'Direct B2B delivery expense',37:'B2B contribution',39:'Total retained company revenue',40:'Direct costs and expected losses',41:'Gross profit',43:'Employees',44:'Loaded personnel expense',45:'Nonstaff operating expense',46:'Marketing expense',47:'Recurring operating result before tax',48:'One-time setup expense',49:'Model result before tax',51:'B2B cash collections',52:'Closing B2B receivables',53:'Corporate bank cash before restrictions',54:'Corporate settlement prefunding',55:'Restricted collateral reserve',56:'Accumulated budget reserve for tax',57:'Free corporate cash after reserves',58:'Additional corporate funding gap',59:'Volume divided by CBL monthly mean',60:'All-in consumer charge rate'};
for(const [r,l]of Object.entries(labels))put('Forecast',`C${r}`,l);
function col(n){let s='';for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
const cols=Array.from({length:36},(_,i)=>col(i+6));
const phase=(k,i)=>i<12?A(k+'1'):i<24?A(k+'2'):A(k+'3');
cols.forEach((c,i)=>{const p=cols[i-1],m=i+1;f('Forecast',`${c}4`,`=EDATE('Assumptions'!$D$52,${i})`);put('Forecast',`${c}5`,m);
 const forms={7:i?`=${p}12`:'=0',8:`=IF(${m}<${A('launch')},${A('preMkt')},${phase('mkt',i)})`,9:`=${A('cac')}`,10:`=IF(${m}<${A('launch')},0,${c}8/${c}9)`,11:`=${c}7*${A('churn')}`,12:`=${c}7+${c}10-${c}11`,13:`=(${c}7+${c}12)/2`,14:`=${c}13*${A('frequency')}`,15:`=${c}14*${A('ticket')}`,18:`=${c}15*${A('fee')}+${c}14*${A('fixedFee')}`,19:`=${c}15-${c}18`,20:`=${c}19*${A('spread')}/(1+${A('spread')})`,21:`=SUM(${c}18,${c}20)`,22:`=${c}21*${A('share')}`,23:`=${c}21-${c}22`,24:`=${c}19*${A('provider')}+${c}14*${A('providerFixed')}`,25:`=${c}15*${A('loss')}`,26:`=${c}19*${A('slip')}`,27:`=${c}23-SUM(${c}24:${c}26)`,29:i?`=${p}32`:'=0',30:`=IF(AND(${m}>=${A('b2bStart')},MOD(${m}-${A('b2bStart')},3)=0),${A('b2bNew')},0)`,31:`=${c}29*${A('b2bChurn')}`,32:`=${c}29+${c}30-${c}31`,33:`=(${c}29+${c}32)/2`,34:`=${c}33*${A('annual')}/12`,35:`=${c}30*(${A('pilot')}+${A('rollout')})`,36:`=${c}34*${A('subCost')}+${c}35*${A('setupCost')}`,37:`=SUM(${c}34:${c}35)-${c}36`,39:`=SUM(${c}23,${c}34:${c}35)`,40:`=SUM(${c}24:${c}26,${c}36)`,41:`=${c}39-${c}40`,43:`=${phase('staff',i)}`,44:`=${c}43*${A('salary')}`,45:`=${phase('other',i)}`,46:`=${c}8`,47:`=${c}41-SUM(${c}44:${c}46)`,48:m===1?`=${A('setup')}`:'=0',49:`=${c}47-${c}48`,51:`=IF(${m}>${A('lag')},INDEX($F$34:$AO$34,1,${m}-${A('lag')})+INDEX($F$35:$AO$35,1,${m}-${A('lag')}),0)`,52:`=${i?`${p}52`:'0'}+SUM(${c}34:${c}35)-${c}51`,53:`=${i?`${p}53`:A('funding')}+${c}23+${c}51-${c}40-SUM(${c}44:${c}46)-${c}48`,54:`=${c}19/30*${A('prefund')}*${A('stress')}`,55:`=${A('restricted')}`,56:`=${i?`${p}56`:'0'}+MAX(0,${c}49)*${A('tax')}`,57:`=${c}53-SUM(${c}54:${c}56)`,58:`=MAX(0,-${c}57)`,59:`=${c}15/'CBL actuals'!$D$12`,60:`=IF(${c}15=0,0,${c}21/${c}15)`};
 for(const [r,v]of Object.entries(forms))f('Forecast',`${c}${r}`,v);
});
sh.Forecast.getRange('F4:AO4').setNumberFormat('mmm-yy');sh.Forecast.getRange('F7:AO60').setNumberFormat(money);
for(const r of[7,10,11,12,13,14,29,30,31,32,33,43])sh.Forecast.getRange(`F${r}:AO${r}`).setNumberFormat(num);
for(const r of[59,60])sh.Forecast.getRange(`F${r}:AO${r}`).setNumberFormat(pct);
for(const r of[12,15,23,27,32,37,39,41,47,49,53,57,58])band('Forecast',r,'AO');
sh.Forecast.freezePanes.freezeRows(5);sh.Forecast.freezePanes.freezeColumns(5);

title('Fee calculator','Transfer fee and FX margin calculator');
put('Fee calculator','C3','Case selected');f('Fee calculator','D3',"='Assumptions'!F5");
const feeLabels={6:'Total sender amount in local currency',7:'Reference local currency per recipient USD',8:'Explicit fee rate',9:'Fixed fee in recipient USD equivalent',10:'FX markup on reference cost rate',12:'Explicit fee in local currency',13:'Local principal converted',14:'Customer local currency per recipient USD',15:'Recipient receives USD',16:'Explicit fee USD equivalent',17:'FX gross margin USD',18:'Gross revenue USD',19:'Partner share USD',20:'Retained revenue USD',21:'Rail fee USD',22:'Expected loss USD',23:'FX slippage USD',24:'Contribution per transfer USD',25:'All-in consumer charge rate',27:'Pricing approval evidence',28:'Provisional pricing guardrail',29:'Charge over provisional guardrail',31:'Monthly consumer contribution per customer',32:'Indicative contribution LTV',33:'CAC payback months',34:'Contribution LTV divided by CAC'};
for(const[r,l]of Object.entries(feeLabels))put('Fee calculator',`C${r}`,l);
put('Fee calculator','D6',6000);put('Fee calculator','D7',6);sh['Fee calculator'].getRange('D6:D7').format.font.color=blue;sh['Fee calculator'].getRange('D6:D7').format.fill=amber;
const ff={8:`=${A('fee')}`,9:`=${A('fixedFee')}`,10:`=${A('spread')}`,12:'=D6*D8+D9*D7',13:'=D6-D12',14:'=D7*(1+D10)',15:'=D13/D14',16:'=D12/D7',17:'=D13/D7-D15',18:'=SUM(D16:D17)',19:`=D18*${A('share')}`,20:'=D18-D19',21:`=D13/D7*${A('provider')}+${A('providerFixed')}`,22:`=D6/D7*${A('loss')}`,23:`=D13/D7*${A('slip')}`,24:'=D20-SUM(D21:D23)',25:'=D18/(D6/D7)',27:`=IF('Assumptions'!D54=1,"DOCUMENTED - verify scope","PENDING")`,28:`=${A('ceiling')}`,29:'=MAX(0,D25-D28)',31:`=('Forecast'!AO27/'Forecast'!AO14)*${A('frequency')}`,32:`=IF(D31>0,D31/${A('churn')},"n.a.")`,33:`=IF(D31>0,${A('cac')}/D31,"n.a.")`,34:`=IF(ISNUMBER(D32),D32/${A('cac')},"n.a.")`};
for(const[r,v]of Object.entries(ff))f('Fee calculator',`D${r}`,v);
sh['Fee calculator'].getRange('D6:D34').setNumberFormat(cents);for(const r of[8,10,25,28,29])sh['Fee calculator'].getRange(`D${r}`).setNumberFormat(pct);sh['Fee calculator'].getRange('D32:D34').setNumberFormat('0.0');sh['Fee calculator'].getRange('D32').setNumberFormat(cents);
for(const r of[6,12,13])sh['Fee calculator'].getRange(`D${r}`).setNumberFormat('#,##0.00');for(const r of[7,14])sh['Fee calculator'].getRange(`D${r}`).setNumberFormat('0.0000');
note('Fee calculator','F6','Illustration only. The reference rate of 6 is not a CBL or executable market quote.');
note('Fee calculator','F8','Fee is deducted from the total sender amount. No fee added again at payout.');
note('Fee calculator','F12','Quote: sender total, explicit fee, FX rate, recipient amount and expiry.');
note('Fee calculator','F27','No pricing or launch approval is evidenced in this pack.');
note('Fee calculator','F32','Steady-state attrition approximation. No cohort retention has been measured.');
for(const r of[18,20,24,25])band('Fee calculator',r,'D');

title('Acquisition','Acquisition budget and funnel calculator');put('Acquisition','C3','Case selected');f('Acquisition','D3',"='Assumptions'!F5");
sh.Acquisition.getRange('C6:J6').values=[['Channel','Cash budget','Opt-in leads','KYC rate','First settlement rate','New settled users','Cost per settled user','D30 repeat assumption']];band('Acquisition',6,'J');
const channels=[['Merchant and field teams',4500,600,.55,.5,.4],['Creators and community demos',3500,650,.4,.4,.35],['Earned referral rewards',4000,400,.7,.65,.5],['Intent search and retargeting',4000,650,.35,.35,.3],['Creative and measurement',2000,0,0,0,0]];
channels.forEach((v,i)=>{const r=7+i;sh.Acquisition.getRange(`C${r}:J${r}`).values=[[...v.slice(0,5),null,null,v[5]]];f('Acquisition',`H${r}`,`=E${r}*F${r}*G${r}`);f('Acquisition',`I${r}`,`=IF(H${r}>0,D${r}/H${r},"n.a.")`);sh.Acquisition.getRange(`D${r}:G${r}`).format.font.color=blue;sh.Acquisition.getRange(`J${r}`).format.font.color=blue;});
put('Acquisition','C13','Totals and blended CAC');for(const c of['D','E','H'])f('Acquisition',`${c}13`,`=SUM(${c}7:${c}11)`);f('Acquisition','I13','=D13/H13');
put('Acquisition','C16','Forecast year 1 target CAC');f('Acquisition','D16',`=${A('cac')}`);put('Acquisition','C17','Funnel CAC minus forecast target');f('Acquisition','D17','=I13-D16');
sh.Acquisition.getRange('D7:D17').setNumberFormat(money);sh.Acquisition.getRange('F7:G11').setNumberFormat(pct);sh.Acquisition.getRange('J7:J11').setNumberFormat(pct);sh.Acquisition.getRange('I7:I13').setNumberFormat(cents);sh.Acquisition.getRange('H7:H13').setNumberFormat(num);
note('Acquisition','C20','Channel estimates are a separate pilot test. They do not silently override forecast CAC.');
note('Acquisition','C22','Count one new customer after identity checks and a settled eligible transaction.');
note('Acquisition','C24','Rewards are inside the all-in budget. Reconcile attributed users to unique customer IDs.');

title('Deal structure','Proposed primary and secondary transaction');
for(const[r,l,v]of[[6,'Total investor consideration',18000000],[7,'Company primary proceeds',10000000],[8,'Founder secondary proceeds',8000000],[9,'Investor post-closing ownership',.4],[10,'Founder existing fully diluted ownership',1]]){put('Deal structure',`C${r}`,l);put('Deal structure',`D${r}`,v);sh['Deal structure'].getRange(`D${r}`).format.font.color=blue;}
for(const[r,l,v]of[[12,'Implied post-money equity value','=D6/D9'],[13,'Implied pre-money equity value','=D12-D7'],[14,'Primary post-closing ownership','=D7/D12'],[15,'Secondary post-closing ownership','=D8/D12'],[16,'Founder remaining post-closing ownership','=D10*(1-D14)-D15'],[17,'Sources less uses check','=D6-SUM(D7:D8)'],[18,'Ownership sold less investor target','=SUM(D14:D15)-D9']]){put('Deal structure',`C${r}`,l);f('Deal structure',`D${r}`,v);}
sh['Deal structure'].getRange('D6:D18').setNumberFormat(money);for(const r of[9,10,14,15,16,18])sh['Deal structure'].getRange(`D${r}`).setNumberFormat(pct);
note('Deal structure','F6','Opening ask, not an accepted offer. All founder proceeds are gross.');note('Deal structure','F9','Change to 50% to see dilution. This does not assess investor eligibility.');note('Deal structure','F12','Assumes equal price and equivalent share economics. Actual rights may change value.');note('Deal structure','F16','Rebuild for options, other holders, preference rights, debt and tax before closing.');

title('Summary','Tazdan operating and capital outlook');put('Summary','C4','Case selected');f('Summary','D4',"='Assumptions'!F5");
sh.Summary.getRange('C7:F7').values=[['USD except customer counts','Year 1','Year 2','Year 3']];band('Summary',7,'F');
const metrics=[[8,'Sender principal volume',15],[9,'Retained consumer revenue',23],[10,'Subscription revenue',34],[11,'Pilot and rollout revenue',35],[12,'Total company revenue',39],[13,'Gross profit',41],[14,'Recurring operating result before tax',47],[15,'Setup expense',48],[16,'Model result before tax',49]];
for(const[r,l,fr]of metrics){put('Summary',`C${r}`,l);for(let y=0;y<3;y++)f('Summary',`${col(4+y)}${r}`,`=SUM('Forecast'!${cols[y*12]}${fr}:${cols[y*12+11]}${fr})`);}
for(const[r,l,fr]of[[18,'Closing active consumers',12],[19,'Closing subscribed B2B customers',32],[20,'Closing annual subscription run rate',null],[21,'Closing free corporate cash',57]]){put('Summary',`C${r}`,l);for(let y=0;y<3;y++)f('Summary',`${col(4+y)}${r}`,fr?`='Forecast'!${cols[y*12+11]}${fr}`:`='Forecast'!${cols[y*12+11]}32*${A('annual')}`);}
sh.Summary.getRange('D8:F21').setNumberFormat(money);sh.Summary.getRange('D18:F19').setNumberFormat(num);
put('Summary','C24','Peak corporate settlement prefunding');f('Summary','D24',"=MAX('Forecast'!F54:AO54)");put('Summary','C25','Peak additional funding requirement');f('Summary','D25',"=MAX('Forecast'!F58:AO58)");put('Summary','C26','Lowest free corporate cash');f('Summary','D26',"=MIN('Forecast'!F57:AO57)");sh.Summary.getRange('D24:D26').setNumberFormat(money);
put('Summary','C29','Pricing evidence');f('Summary','D29',"=IF('Assumptions'!D54=1,\"Documented\",\"Pending\")");put('Summary','C30','Launch permission evidence');f('Summary','D30',"=IF('Assumptions'!D55=1,\"Documented\",\"Pending\")");put('Summary','C31','Provider contract evidence');f('Summary','D31',"=IF('Assumptions'!D56=1,\"Documented\",\"Pending\")");
note('Summary','C34','Forecast begins at proposed funding, with delayed consumer launch. No funding is secured.');
note('Summary','C36','Customer principal is neither company revenue nor available capital.');
note('Summary','C38','Tax reserve is a budget placeholder. Regulatory capital, guarantees and tax need entity-specific advice.');
sh.Summary.getRange('D8:F31').format.font.color=ink;sh.Summary.getRange('D4').format.font.color=green;
sh.Summary.getRange('H7:J7').values=[['Model month','Retained revenue','Recurring operating result']];
for(let i=0;i<36;i++){put('Summary',`H${8+i}`,i+1);f('Summary',`I${8+i}`,`='Forecast'!${cols[i]}39`);f('Summary',`J${8+i}`,`='Forecast'!${cols[i]}47`);}
sh.Summary.getRange('I8:J43').setNumberFormat(money);
const chart=sh.Summary.charts.add('line',sh.Summary.getRange('H7:J43'));chart.setPosition('L7','V25');chart.title='Monthly revenue and operating result';chart.legend={position:'bottom',textStyle:{typeface:'Arial',fontSize:11}};chart.titleTextStyle.typeface='Arial';chart.titleTextStyle.fontSize=15;chart.xAxis={axisType:'textAxis',textStyle:{typeface:'Arial',fontSize:10}};chart.yAxis={numberFormatCode:'$0,"k"',numberFormatSourceLinked:false,textStyle:{typeface:'Arial',fontSize:10}};

title('Review','Financial reconciliation and evidence review');
put('Review','C5','Check');put('Review','D5','Difference or status');band('Review',5,'D');
const checks=[['Consumer contribution reconciliation',"=SUM('Forecast'!F27:AO27)-(SUM('Forecast'!F23:AO23)-SUM('Forecast'!F24:AO26))"],['Total gross profit reconciliation',"=SUM('Forecast'!F41:AO41)-SUM('Forecast'!F27:AO27)-SUM('Forecast'!F37:AO37)"],['B2B receivables bridge',"='Forecast'!AO52-(SUM('Forecast'!F34:AO35)-SUM('Forecast'!F51:AO51))"],['Corporate cash bridge',`='Forecast'!AO53-(${A('funding')}+SUM('Forecast'!F23:AO23)+SUM('Forecast'!F51:AO51)-SUM('Forecast'!F40:AO40)-SUM('Forecast'!F44:AO46)-SUM('Forecast'!F48:AO48))`],['Free cash after restrictions',"='Forecast'!AO57-('Forecast'!AO53-SUM('Forecast'!AO54:AO56))"],['Transaction sources less uses',"='Deal structure'!D17"],['Provisional all-in guardrail overage',`=MAX(0,MAX('Forecast'!F60:AO60)-${A('ceiling')})`],['Pricing approval','Pending evidence'],['Launch permissions','Pending evidence'],['Provider commercial quotes','Unsigned planning estimates'],['Shareholder and funding eligibility','Counterparty-specific review required']];
checks.forEach(([label,v],i)=>{const r=6+i;put('Review',`C${r}`,label);if(v.startsWith('='))f('Review',`D${r}`,v);else put('Review',`D${r}`,v);});sh.Review.getRange('D6:D12').setNumberFormat('0.000000;(0.000000);0.000000');sh.Review.getRange('D6:D12').format.font.color=ink;sh.Review.getRange('D:D').format.columnWidth=36;
sh.Review.getRange('D6:D12').conditionalFormats.add('cellIs',{operator:'notEqual',formula:0,format:{fill:'#FDE6E5',font:{color:'#B42318',bold:true}}});

title('Model guide','Model definitions and refresh');sh['Model guide'].getRange('D:D').format.columnWidth=110;
const guide=[['Purpose','36 months after an assumed future funding date. One editable case selector feeds one forecast.'],['Cash and revenue','Revenue excludes sender principal. Cash tracks company funds and B2B collections; prefunding and collateral reduce free cash.'],['Consumer pricing','Explicit fees are deducted from total sender principal. FX gross margin equals converted reference value less recipient value.'],['Cost separation','Rail charges, slippage, partner share and losses are separate estimates. Replace with contracted quotes without double counting.'],['B2B recognition','Accepted rollout event earns pilot/setup fees. Subscriptions accrue on average active customers. Invoices collect after selected lag.'],['Collections','The base forecast assumes monthly invoices. Annual subscription prepayment would change cash timing and must be remodelled.'],['Tax','The 15% input reserves cash on positive model results. It is not a jurisdictional tax conclusion, tax expense calculation or loss-relief model.'],['Capital','The restricted reserve is an assumed collateral budget. Statutory paid-up capital is equity and must not automatically be deducted again.'],['Acquisition','Forecast CAC is a target. The channel funnel independently tests whether budgets and conversion assumptions support that target.'],['Revenue rights','Partner share is removed from consumer revenue for planning. Contract-specific principal-versus-agent accounting remains to be determined.'],['Inputs','Edit blue inputs. Numeric case 1 Downside, 2 Base, 3 Growth. Actual CBL data remains unchanged.'],['Price controls','Approval flags start at zero. The 0.5% all-in guardrail is a planning control, not an interpretation of all lawful charges.'],['Precision','Excel uses floating point for financial planning. Production settlement uses exact native amounts, not spreadsheet calculations.'],['Missing evidence','No signed provider pricing, paid customers, realised revenue or formal launch permissions were reviewed for this pack.'],['Ownership','Founder confirms code/IP ownership. Legal holder, assignments where applicable and third-party obligations need normal diligence.'],['Limitations','No acquisition probability, guaranteed valuation, loan financing or customer-fund income is assumed. No statutory accounts are produced.']];
guide.forEach(([l,v],i)=>{put('Model guide',`C${5+i}`,l);put('Model guide',`D${5+i}`,v);sh['Model guide'].getRange(`D${5+i}`).format.wrapText=true;sh['Model guide'].getRange(`C${5+i}:D${5+i}`).format.rowHeight=38;});

// Independently calculate all cases, then test the same build after changing its selector.
function independent(caseIdx){const p=Object.fromEntries(params.map(([k,,...vals])=>[k,vals[caseIdx-1]]));let active=0,b2b=0,cash=p.funding,ar=0,tax=0;const rows=[];for(let i=1;i<=36;i++){const yr=i<=12?1:i<=24?2:3;const mkt=i<p.launch?p.preMkt:p['mkt'+yr];const next=active+(i<p.launch?0:mkt/p.cac)-active*p.churn,tx=(active+next)/2*p.frequency,volume=tx*p.ticket,fee=volume*p.fee+tx*p.fixedFee,net=volume-fee,fx=net*p.spread/(1+p.spread),consumer=(fee+fx)*(1-p.share),cost=net*p.provider+tx*p.providerFixed+volume*p.loss+net*p.slip,newBiz=i>=p.b2bStart&&(i-p.b2bStart)%3===0?p.b2bNew:0,nextB=b2b+newBiz-b2b*p.b2bChurn,sub=(b2b+nextB)/2*p.annual/12,project=newBiz*(p.pilot+p.rollout),b2bCost=sub*p.subCost+project*p.setupCost,revenue=consumer+sub+project,gp=revenue-cost-b2bCost,op=gp-p['staff'+yr]*p.salary-p['other'+yr]-mkt,setup=i===1?p.setup:0,result=op-setup,collection=i>p.lag?rows[i-p.lag-1].b2bRevenue:0;ar+=sub+project-collection;cash+=consumer+collection-cost-b2bCost-p['staff'+yr]*p.salary-p['other'+yr]-mkt-setup;tax+=Math.max(0,result)*p.tax;const prefund=net/30*p.prefund*p.stress,free=cash-prefund-p.restricted-tax;rows.push({volume,consumer,sub,project,revenue,gp,op,setup,result,active:next,b2b:nextB,arr:nextB*p.annual,free,prefund,gap:Math.max(0,-free),b2bRevenue:sub+project,ar,cash});active=next;b2b=nextB;}return {rows,years:[0,1,2].map(y=>{const yr=rows.slice(y*12,y*12+12),last=yr.at(-1);return {...Object.fromEntries(['volume','consumer','sub','project','revenue','gp','op','setup','result'].map(k=>[k,yr.reduce((a,r)=>a+r[k],0)])),active:last.active,b2b:last.b2b,arr:last.arr,free:last.free};}),peakPrefund:Math.max(...rows.map(r=>r.prefund)),gap:Math.max(...rows.map(r=>r.gap)),minFree:Math.min(...rows.map(r=>r.free))};}
const caseResults={};
for(const idx of[1,2,3]){put('Assumptions','D5',idx);wb.recalculate();const exp=independent(idx),actual=sh.Summary.getRange('D8:F21').values;const map={0:'volume',1:'consumer',2:'sub',3:'project',4:'revenue',5:'gp',6:'op',7:'setup',8:'result',10:'active',11:'b2b',12:'arr',13:'free'};for(const[r,k]of Object.entries(map))for(let y=0;y<3;y++){if(Math.abs(Number(actual[r][y])-exp.years[y][k])>0.001)throw Error(`Case ${idx} ${k} year ${y+1}: ${actual[r][y]} != ${exp.years[y][k]}`);}caseResults[['Downside','Base','Growth'][idx-1]]={years:exp.years,peakPrefund:exp.peakPrefund,gap:exp.gap,minFree:exp.minFree};}
// Input sensitivity on later-period spend updates the active build.
put('Assumptions','D5',2);const mkt3row=pr.mkt3,old=sh.Assumptions.getRange(`F${mkt3row}`).values[0][0];put('Assumptions',`F${mkt3row}`,old+1000);wb.recalculate();if(sh.Forecast.getRange('AD8').values[0][0]!==old+1000)throw Error('Later-year input did not propagate');put('Assumptions',`F${mkt3row}`,old);wb.recalculate();
const err=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:40},maxChars:2500});await fs.writeFile(path.join(base,'model-errors.ndjson'),err.ndjson);console.log(err.ndjson);
await fs.mkdir(out,{recursive:true});await (await SpreadsheetFile.exportXlsx(wb)).save(path.join(out,'Tazdan_Integrated_Financial_Model.xlsx'));
await fs.writeFile(path.join(base,'financial-results.json'),JSON.stringify({asOf:'2026-10-17',caseResults,params:params.map(([key,label,downside,base,growth,unit,basis])=>({key,label,downside,base,growth,unit,basis})),feeExample:sh['Fee calculator'].getRange('C6:D34').values},null,2));
for(const [name,range,file]of[['Summary','C2:V32','model-summary'],['Assumptions','C5:J22','model-assumptions'],['Forecast','C4:K27','model-forecast'],['Fee calculator','C2:J34','model-fees'],['Acquisition','C2:J24','model-acquisition'],['Deal structure','C2:J18','model-deal'],['CBL actuals','C2:G18','model-cbl'],['Review','C2:F17','model-review'],['Model guide','C2:D20','model-guide']]){await fs.writeFile(path.join(base,'qa',file+'.png'),new Uint8Array(await (await wb.render({sheetName:name,range,scale:1.5,format:'png'})).arrayBuffer()));}
console.log(JSON.stringify({output:path.join(out,'Tazdan_Integrated_Financial_Model.xlsx'),caseResults}));
