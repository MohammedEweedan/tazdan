import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const out = path.dirname(new URL(import.meta.url).pathname);
const cases = ['Downside', 'Base', 'Upside'];
const repeat = (x) => [x,x,x];
// Each assumption is an explicit planning hypothesis, not an observed customer or vendor quote.
const drivers = [
  ['delay','Months before operating launch','months',repeat(12),repeat(6),repeat(3),'Conditional permission, bank integration and delivery; no launch date committed.'],
  ['leads','Qualified business leads / month','count',[15,25,40],[40,80,140],[80,180,350],'Requires a funded sales process; current total interested prospects is single digit.'],
  ['conversion','Business lead to paid activation','rate',repeat(.05),repeat(.10),repeat(.15),'Unknown; validate with paid pilot offers.'],
  ['businessChurn','Monthly paying-business churn','rate',repeat(.025),repeat(.015),repeat(.008),'Unknown retention; expected cohorts, not observed churn.'],
  ['businessPrice','Business subscription / month','USD',[20,25,25],[40,45,50],[60,70,80],'Proposed price; no subscription billing or paid contracts currently verified.'],
  ['businessAcq','Cash onboarding / new business','USD',repeat(150),repeat(120),repeat(100),'Out-of-pocket acquisition and onboarding; sales payroll is additional.'],
  ['usersPerBusiness','New consumer prospects / new business','count',repeat(10),repeat(20),repeat(30),'Users introduced by merchants/employers; no contractual distribution today.'],
  ['uniqueUsers','Unique funded share of those prospects','rate',repeat(.50),repeat(.70),repeat(.80),'Deduplication and activation assumption; channels assumed mutually exclusive.'],
  ['ads','Consumer acquisition spend / month','USD',[250,500,750],[500,1000,1500],[1500,3000,6000],'Validation budget; stop scaling if cohort contribution does not support acquisition.'],
  ['consumerCAC','Cash cost / paid funded consumer','USD',[35,35,30],[25,22,20],[20,17.5,15],'Unquoted acquisition hypothesis; does not include fixed sales payroll.'],
  ['referral','New funded referrals / prior active user','rate',repeat(.005),repeat(.01),repeat(.02),'Only new deduplicated funded users; no network effect proven.'],
  ['consumerChurn','Monthly transacting-consumer churn','rate',repeat(.10),repeat(.07),repeat(.05),'Churn means no longer transacting; reactivations excluded.'],
  ['fundedShare','Registered to funded activation','rate',repeat(.25),repeat(.35),repeat(.45),'Registration count is inferred from acquisition funnel, not a demand forecast.'],
  ['transactions','Payment attempts / active consumer / month','count',[2,3,3],[4,5,6],[5,7,9],'Completed money transactions only; chats and logins are not payment activity.'],
  ['success','Payment completion rate','rate',repeat(.95),repeat(.98),repeat(.995),'A planning target requiring end-to-end live measurement.'],
  ['ticket','Average retail payment','USD',[20,25,25],[25,30,35],[30,40,50],'USD-equivalent planning units; domestic contracts and cash may be in LYD.'],
  ['chargeable','Retail transactions subject to merchant fee','rate',repeat(.25),[.35,.40,.45],[.40,.50,.60],'Internal peer transfers remain free; charge only modeled merchant transactions.'],
  ['retailFee','Gross merchant payment fee','rate',repeat(.005),repeat(.005),repeat(.006),'New pricing hypothesis; lawful scope and bank-approved commercial terms required.'],
  ['railPct','Partner share of retail payment volume','rate',repeat(.0025),repeat(.0015),repeat(.001),'Illustrative cost, not a processor quote.'],
  ['railFixed','Partner fixed cost / retail payment','USD',repeat(.03),repeat(.02),repeat(.015),'Only applied to chargeable merchant payments, not internal peer transfers.'],
  ['businessTx','Payouts / average paying business / month','count',[10,15,20],[20,30,40],[30,50,75],'Business payouts are distinct payment events; receipts and funding not counted again.'],
  ['businessTicket','Average business payout','USD',[60,80,80],[80,100,120],[100,130,160],'Domestic payout scope only; no international FX assumed.'],
  ['businessFee','Gross fee / business payout','USD',repeat(.10),repeat(.15),repeat(.20),'Current code defaults to zero unless configured; proposed future contract pricing.'],
  ['businessRail','Partner cost / business payout','USD',repeat(.04),repeat(.025),repeat(.02),'Unquoted; fixed team costs are additional.'],
  ['salesCycle','Institution sales lag after launch','months',repeat(12),repeat(6),repeat(4),'Isolated operations/reconciliation deployment; no institution has signed.'],
  ['winInterval','Months between new institution contracts','months',repeat(12),repeat(6),repeat(3),'No fractional new contracts; assumes capacity to win, implement and support each.'],
  ['institutionPrice','Institution recurring fee / month','USD',repeat(1000),repeat(2000),[3000,3500,4000],'Scoped software deployment hypothesis, not bank core-system replacement.'],
  ['institutionSetup','Accepted institution setup fee','USD',repeat(5000),repeat(10000),repeat(15000),'One-time revenue on accepted delivery, excluded from recurring revenue.'],
  ['institutionCost','Institution recurring direct vendor cost','rate',repeat(.30),repeat(.20),repeat(.20),'Hosting/subcontract allowance excluding the fixed team to avoid counting payroll twice.'],
  ['setupCostRate','Direct cost of accepted setup delivery','rate',repeat(.70),repeat(.60),repeat(.50),'External delivery cost allowance; no earned fee before accepted delivery.'],
  ['businessCost','Subscription direct vendor cost','rate',repeat(.15),repeat(.10),repeat(.08),'Incremental delivery allowance, not fixed payroll.'],
  ['fraud','Losses / successful payment volume','rate',repeat(.0005),repeat(.0002),repeat(.0001),'Both retail and business volume; expected losses are not regulatory capital.'],
  ['support','Variable cost / average active consumer','USD',repeat(.12),repeat(.08),repeat(.06),'Incremental messaging and support vendors; fixed support staff also modeled separately.'],
  ['kyc','Verification cost / newly funded consumer','USD',repeat(2.5),repeat(2),repeat(1.5),'Hypothesis; manual review capacity and rejected applicants need pilot measurement.'],
  ['engineers','Engineering FTE including founder','FTE',[2,2.5,3],[2.5,3,4],[3,5,7],'Future funded team. Founder is included at an economic replacement salary.'],
  ['engineerPay','Loaded engineering cost / FTE / month','USD',[3000,3250,3500],[3500,4000,4500],[4000,4500,5000],'Budget assumption for mixed local/remote hiring; no binding recruitment offers.'],
  ['compliance','Compliance and finance FTE','FTE',[.75,1,1],[1,1.5,2],[1.5,2,3],'Covers review, safeguarding and finance; statutory roles require local confirmation.'],
  ['compliancePay','Loaded compliance cost / FTE / month','USD',[2000,2250,2500],[2500,3000,3500],[3000,3500,4000],'Unquoted fully loaded planning cost.'],
  ['operations','Sales, support and operations FTE','FTE',[1,1.5,2],[2,3,4],[3,5,8],'Future hiring. Validate onboarding and support workload before increasing sales.'],
  ['operationsPay','Loaded operations cost / FTE / month','USD',[1250,1400,1500],[1500,1750,2000],[1750,2000,2250],'Unquoted fully loaded planning cost.'],
  ['cloud','Fixed hosting, monitoring and software / month','USD',[700,1000,1500],[1000,2000,3000],[1500,3500,6000],'Excludes direct per-customer vendor allowances.'],
  ['legal','Recurring legal, audit and accounting / month','USD',[1000,1250,1500],[1500,2000,2500],[2000,3500,5000],'Ongoing outsourced assurance; not a regulator-set fee.'],
  ['admin','Other fixed overhead / month','USD',[500,700,1000],[750,1000,1500],[1000,2000,3000],'Office, insurance and administration placeholder.'],
  ['prelaunch','Prelaunch payroll fraction','rate',repeat(.70),repeat(.70),repeat(.80),'Reduced hiring before launch; no zero-cost founder-labour assumption.'],
  ['launchSetup','One-time launch preparation spend','USD',repeat(75000),repeat(100000),repeat(175000),'Cash in month 1: integration, security, legal and implementation budget; unquoted.'],
  ['prefundDays','Own settlement prefunding days','days',repeat(5),repeat(2),repeat(2),'Restricted corporate liquidity; not an expense and not customer safeguarding assets.'],
  ['stress','Settlement liquidity stress factor','multiple',repeat(1.5),repeat(1.5),repeat(1.5),'30-day-month convention; partner terms can materially increase required liquidity.'],
];

const globals = {primary:600000, secondary:50000, stake:.33, contingency:.20, dilution:.20, returnMultiple:3, revenueMultiple:3};
const profile = (idx, year, edits={}) => Object.fromEntries(drivers.map(([id,, ,...rest]) => [id, edits[id] ?? rest[idx][year]]));

function simulate(idx, edits={}) {
  const rows=[]; let users=0,business=0,institutions=0,registrations=0,cumulative=0,receivable=0,newFundedTotal=0;
  for(let month=1;month<=36;month++) {
    const year=Math.floor((month-1)/12), a=profile(idx,year,edits), active=month>a.delay;
    const start=a.delay+1, newBusiness=active ? a.leads*a.conversion : 0;
    const oldBusiness=business, businessLost=active ? business*a.businessChurn : 0;
    business=business-businessLost+newBusiness;
    const avgBusiness=(oldBusiness+business)/2;
    const paid=active ? a.ads/a.consumerCAC : 0;
    const merchantUsers=active ? newBusiness*a.usersPerBusiness*a.uniqueUsers : 0;
    const referred=active ? users*a.referral : 0;
    const newUsers=paid+merchantUsers+referred, oldUsers=users, usersLost=active ? users*a.consumerChurn : 0;
    users=users-usersLost+newUsers;
    const avgUsers=(oldUsers+users)/2;
    newFundedTotal+=newUsers; registrations+=newUsers/a.fundedShare;
    const wins=active && month>=start+a.salesCycle && (month-start-a.salesCycle)%a.winInterval===0 ? 1 : 0;
    institutions+=wins; // No institution churn: an explicit optimistic retention assumption requiring annual renewal.
    const retailTx=active ? avgUsers*a.transactions*a.success : 0, merchantTx=retailTx*a.chargeable;
    const retailVolume=retailTx*a.ticket, merchantVolume=merchantTx*a.ticket;
    const businessTransactions=active ? avgBusiness*a.businessTx*a.success : 0;
    const businessVolume=businessTransactions*a.businessTicket;
    const grossRetail=merchantVolume*a.retailFee, partnerRetail=merchantVolume*a.railPct+merchantTx*a.railFixed;
    const grossBusiness=businessTransactions*a.businessFee, partnerBusiness=businessTransactions*a.businessRail;
    const retained=grossRetail-partnerRetail+grossBusiness-partnerBusiness;
    const subscriptions=active ? avgBusiness*a.businessPrice : 0;
    const recurring=institutionPrice(a)*institutions; const setup=wins*a.institutionSetup;
    const revenue=retained+subscriptions+recurring+setup;
    const variableLoss=(retailVolume+businessVolume)*a.fraud, userCost=avgUsers*a.support, kycCost=newUsers*a.kyc;
    const direct=variableLoss+userCost+kycCost+subscriptions*a.businessCost+recurring*a.institutionCost+setup*a.setupCostRate;
    const contribution=revenue-direct;
    const payroll=(a.engineers*a.engineerPay+a.compliance*a.compliancePay+a.operations*a.operationsPay)*(active?1:a.prelaunch);
    const fixed=payroll+a.cloud+a.legal+a.admin;
    const acquisition=(active?a.ads:0)+newBusiness*a.businessAcq;
    const ebitda=contribution-fixed-acquisition;
    const institutionBilled=recurring+setup, closingAR=institutionBilled;
    const cashRevenue=revenue-closingAR+receivable;
    const launchCost=month===1?a.launchSetup:0;
    const operatingCash=cashRevenue-direct-fixed-acquisition-launchCost;
    cumulative+=operatingCash;
    const ownLiquidity=(merchantVolume+businessVolume)/30*a.prefundDays*a.stress;
    const freeBeforeFunding=cumulative-ownLiquidity;
    rows.push({month,active:+active,newBusiness,businessLost,business,avgBusiness,paid,merchantUsers,referred,newUsers,usersLost,users,avgUsers,newFundedTotal,registrations,wins,institutions,
      retailTx,merchantTx,retailVolume,merchantVolume,businessTransactions,businessVolume,grossRetail,partnerRetail,grossBusiness,partnerBusiness,retained,subscriptions,recurring,setup,revenue,
      variableLoss,userCost,kycCost,direct,contribution,payroll,fixed,acquisition,ebitda,receivable,closingAR,cashRevenue,launchCost,operatingCash,cumulative,ownLiquidity,freeBeforeFunding,freeCash:globals.primary+freeBeforeFunding,
      recurringRevenue:retained+subscriptions+recurring, consumerContribution:(grossRetail-partnerRetail-variableLoss*(retailVolume/(retailVolume+businessVolume||1))-userCost),
    });
    receivable=closingAR;
  }
  const annual=[0,1,2].map(y=>{
    const r=rows.slice(y*12,y*12+12), last=r.at(-1), sum=k=>r.reduce((s,t)=>s+t[k],0);
    return {year:y+1,users:last.users,registrations:last.registrations,business:last.business,institutions:last.institutions,payments:sum('retailTx')+sum('businessTransactions'),volume:sum('retailVolume')+sum('businessVolume'),
      revenue:sum('revenue'),retained:sum('retained'),subscriptions:sum('subscriptions'),institutionRecurring:sum('recurring'),setup:sum('setup'),contribution:sum('contribution'),ebitda:sum('ebitda'),freeCash:last.freeCash,ownLiquidity:last.ownLiquidity,
      exitRecurringAnnual:last.recurringRevenue*12,requiredFunding:Math.max(0,-Math.min(...rows.slice(0,(y+1)*12).map(r=>r.freeBeforeFunding)))*(1+globals.contingency)};
  });
  return {name:cases[idx],rows,annual,required18:Math.max(0,-Math.min(...rows.slice(0,18).map(r=>r.freeBeforeFunding)))*(1+globals.contingency),required36:annual[2].requiredFunding,breakevenMonth:rows.find(r=>r.ebitda>=0)?.month??null};
}
const institutionPrice=a=>a.institutionPrice;
const simulations=cases.map((_,i)=>simulate(i));
const sensitivities=[['Base as modeled',{}],['Launch delayed to month 13',{delay:12}],['Business conversion 5% instead of 10%',{conversion:.05}],['Own prefunding removed (contract required)',{prefundDays:0}],['Own prefunding five days instead of two',{prefundDays:5}],['Business price $75/month in every year',{businessPrice:75}]].map(([name,edits])=>{const s=simulate(1,edits);return {name,edits,year3:s.annual[2],required18:s.required18,required36:s.required36};});
await fs.writeFile(path.join(out,'model-sensitivity.json'),JSON.stringify(sensitivities,null,2));
await fs.writeFile(path.join(out,'model-results.json'),JSON.stringify({asOf:'2026-11-10',globals,drivers,scenarios:simulations,noApproval:simulate(1,{delay:36}),notes:['All forecast activity conditional on funded launch and written permissions.','No approval outcome is not assigned a probability.','Gross payment principal never enters company revenue or operating cash.','Regulatory capital, guarantees, tax, historic liabilities and financing fees excluded because unquoted.']},null,2));
console.log(JSON.stringify(simulations.map(s=>({case:s.name,annual:s.annual,required18:s.required18,required36:s.required36,breakeven:s.breakevenMonth})),null,2));
if(process.argv.includes('--simulate')) process.exit(0);

// WORKBOOK_AUTHORING
const wb=Workbook.create();
const sheets=Object.fromEntries(['Summary','Deal','Assumptions','Forecast','Checks','Sources'].map(n=>[n,wb.worksheets.add(n)]));
const money='"$"#,##0;("$"#,##0);"-"';
const number='#,##0;(#,##0);"-"';
const decimal='#,##0.0;(#,##0.0);"-"';
const pct='0.0%;(0.0%);"-"';
const colors={navy:'#24384F',ink:'#172B42',muted:'#64748B',blue:'#1D4ED8',green:'#187444',light:'#EAF0F6',amber:'#FFF4D0',red:'#B91C1C'};
const cell=(sheet,address,value,formula=false)=>{sheet.getRange(address)[formula?'formulas':'values']=[[value]];};
const col=n=>{let s='';for(let v=n;v;v=Math.floor((v-1)/26))s=String.fromCharCode(65+(v-1)%26)+s;return s;};
for(const s of Object.values(sheets)) {
  s.showGridLines=false;
  s.getRange('A1:AR240').format.font={name:'Arial',size:10,color:colors.ink};
  s.getRange('A1:B240').format.columnWidth=2;
  s.getRange('C1:C240').format.columnWidth=51;
  s.getRange('D1:AR240').format.columnWidth=15;
  s.getRange('C1:AR240').format.rowHeight=20;
  s.getRange('C1:AR240').format.verticalAlignment='center';
  cell(s,'C2',s.name==='Summary'?'Tazdan operating model':s.name==='Deal'?'Tazdan 33% transaction':s.name);
  s.getRange('C2').format.font={name:'Arial',size:15,bold:true,color:colors.navy};
  s.getRange('C3:L3').format.borders={bottom:{style:'thin',color:'#A7B6C5'}};
  cell(s,'C4','Case selected:'); cell(s,'D4',"=CHOOSE('Assumptions'!$D$4,\"Downside\",\"Base\",\"Upside\")",true);
  s.getRange('D4').format.font.color=colors.green;
  s.getRange('D4').format.borders={preset:'outside',style:'dotted',color:'#94A3B8'};
  s.getRange('D4').format.horizontalAlignment='center';
}
const header=(s,r,c1,c2)=>{const x=s.getRange(`${col(c1)}${r}:${col(c2)}${r}`);x.format.fill=colors.navy;x.format.font={color:'#FFFFFF',bold:true};x.format.horizontalAlignment='center';x.format.borders={insideVertical:{style:'thin',color:'#FFFFFF'}};};
const a=sheets.Assumptions;
a.tabColor='#72879C'; sheets.Summary.tabColor=colors.navy;sheets.Deal.tabColor=colors.navy;
cell(a,'C4','Case number (1 / 2 / 3)');cell(a,'D4',2);a.getRange('D4').format.fill=colors.amber;a.getRange('D4').format.font.color=colors.blue;
a.getRange('D4').dataValidation={rule:{type:'whole',operator:'between',formula1:1,formula2:3}};
cell(a,'E4','=CHOOSE(D4,"Downside","Base","Upside")',true);
for(const [r,label,value,format] of [[6,'Company primary funding (USD)',globals.primary,money],[7,'Founder secondary sale (USD)',globals.secondary,money],[8,'Investor final ownership',globals.stake,pct],[9,'Funding contingency',globals.contingency,pct],[10,'Future ownership dilution assumption',globals.dilution,pct]]) {
  cell(a,`C${r}`,label);cell(a,`E${r}`,value);a.getRange(`E${r}`).setNumberFormat(format);a.getRange(`E${r}`).format.font.color=colors.blue;a.getRange(`E${r}`).format.fill=colors.amber;
}
cell(a,'I6','Planning USD equivalents; no exchange conversion is executed by this model.');
cell(a,'I7','Month 1 is the first funded month; no funding or launch date is confirmed.');
cell(a,'I8','No revenue from crypto, cards, remittance, LYDT or customer float.');
cell(a,'I9','Capital requirements, guarantees, tax and historic liabilities remain unquoted.');
a.getRange('I1:I240').format.columnWidth=12;a.getRange('K1:K240').format.columnWidth=110;
cell(a,'C12','Driver');cell(a,'D12','Selection');cell(a,'E12','Year 1');cell(a,'F12','Year 2');cell(a,'G12','Year 3');cell(a,'I12','Unit');cell(a,'K12','Basis: analyst hypotheses unless marked otherwise');header(a,12,3,7);
const ar={};
for(let i=0;i<drivers.length;i++) {
  const [id,label,unit,down,base,up,note]=drivers[i],r=13+i*4;ar[id]=r;
  cell(a,`C${r}`,label);cell(a,`D${r}`,'Active');cell(a,`I${r}`,unit);cell(a,`K${r}`,note);
  a.getRange(`C${r}:G${r}`).format.fill=colors.light;a.getRange(`C${r}:G${r}`).format.font.bold=true;
  [down,base,up].forEach((v,j)=>{cell(a,`D${r+j+1}`,cases[j]);a.getRange(`E${r+j+1}:G${r+j+1}`).values=[v];});
  for(const c of ['E','F','G'])cell(a,`${c}${r}`,`=IF(ISNUMBER(CHOOSE($D$4,${c}${r+1},${c}${r+2},${c}${r+3})),CHOOSE($D$4,${c}${r+1},${c}${r+2},${c}${r+3}),NA())`,true);
  a.getRange(`E${r}:G${r+3}`).setNumberFormat(unit==='rate'?pct:unit==='USD'?money:['FTE','multiple'].includes(unit)?decimal:number);
  a.getRange(`E${r+1}:G${r+3}`).format.font.color=colors.blue;
  a.getRange(`E${r+1}:G${r+3}`).dataValidation={rule:{type:'decimal',operator:'between',formula1:0,formula2:unit==='rate'?1:1000000}};
}
a.freezePanes.freezeRows(12);a.freezePanes.freezeColumns(4);

const f=sheets.Forecast;
f.getRange('D1:AM100').setNumberFormat(number);f.freezePanes.freezeRows(8);f.freezePanes.freezeColumns(3);
cell(f,'C6','Relative months from funded setup');cell(f,'C7','Year (technical period key)');
cell(f,'C8','Metric (USD unless count / rate)');header(f,8,3,39);
const row={};
const spec=[
 ['active','Operating launch gate',null],['newBusiness','New paying businesses','count'],['businessLost','Paying businesses lost','count'],['business','Ending paying businesses','count'],['avgBusiness','Average paying businesses','count'],
 ['paid','New consumers via paid acquisition','count'],['merchantUsers','New consumers via businesses','count'],['referred','New consumers via referrals','count'],['newUsers','Total new funded consumers','count'],['usersLost','Transacting consumers lost','count'],['users','Ending transacting consumers','count'],['avgUsers','Average transacting consumers','count'],['registrations','Cumulative registrations (inferred)','count'],
 ['wins','New institution contracts','count'],['institutions','Active institution contracts','count'],['retailTx','Successful retail payments','count'],['merchantTx','Chargeable merchant payments','count'],['retailVolume','Retail payment principal','money'],['merchantVolume','Chargeable merchant principal','money'],['businessTransactions','Successful business payouts','count'],['businessVolume','Business payout principal','money'],
 ['grossRetail','Gross merchant payment fees','money'],['partnerRetail','Retail partner pass-through costs','money'],['grossBusiness','Gross business payout fees','money'],['partnerBusiness','Business partner pass-through costs','money'],['retained','Retained payment fees','money'],['subscriptions','Business subscription revenue','money'],['recurring','Institution recurring revenue','money'],['setup','Accepted institution setup revenue','money'],['revenue','Management net revenue','money'],
 ['variableLoss','Expected fraud / payment losses','money'],['userCost','Variable consumer service costs','money'],['kycCost','New-consumer verification costs','money'],['direct','Total own direct delivery costs','money'],['contribution','Contribution before fixed team','money'],['payroll','Fully loaded payroll including founder','money'],['fixed','Payroll and fixed overhead','money'],['acquisition','Acquisition and business onboarding','money'],['ebitda','Operating result before tax / D&A','money'],
 ['receivable','Opening institution receivables','money'],['closingAR','Closing institution receivables','money'],['cashRevenue','Revenue collected after billing lag','money'],['launchCost','One-time launch preparation cash','money'],['operatingCash','Corporate cash flow before liquidity','money'],['cumulative','Cumulative corporate cash flow','money'],['ownLiquidity','Restricted own settlement liquidity','money'],['freeBeforeFunding','Free corporate cash before funding','money'],['freeCash','Free corporate cash after primary','money'],['recurringRevenue','Recurring management net revenue','money'],['newFundedTotal','Cumulative new funded consumers','count']
];
spec.forEach(([id,label,type],i)=>{const r=9+i;row[id]=r;cell(f,`C${r}`,label);f.getRange(`D${r}:AM${r}`).setNumberFormat(type==='money'?money:number);if(['revenue','contribution','ebitda','freeCash'].includes(id)){f.getRange(`C${r}:AM${r}`).format.fill=colors.light;f.getRange(`C${r}:AM${r}`).format.font.bold=true;}});
for(let m=1;m<=36;m++) {
  const c=col(m+3),p=col(m+2),y=col(5+Math.floor((m-1)/12));
  cell(f,`${c}6`,m);cell(f,`${c}7`,Math.floor((m-1)/12)+1);cell(f,`${c}8`,`M${String(m).padStart(2,'0')}`);
  const R=id=>`${c}${row[id]}`,P=id=>m===1?'0':`${p}${row[id]}`,A=id=>`'Assumptions'!${y}${ar[id]}`;
  const F={
    active:`--(${c}$6>${A('delay')})`,newBusiness:`${R('active')}*${A('leads')}*${A('conversion')}`,businessLost:`${R('active')}*${P('business')}*${A('businessChurn')}`,business:`${P('business')}-${R('businessLost')}+${R('newBusiness')}`,avgBusiness:`(${P('business')}+${R('business')})/2`,
    paid:`${R('active')}*${A('ads')}/${A('consumerCAC')}`,merchantUsers:`${R('newBusiness')}*${A('usersPerBusiness')}*${A('uniqueUsers')}`,referred:`${R('active')}*${P('users')}*${A('referral')}`,newUsers:`SUM(${R('paid')}:${R('referred')})`,usersLost:`${R('active')}*${P('users')}*${A('consumerChurn')}`,users:`${P('users')}-${R('usersLost')}+${R('newUsers')}`,avgUsers:`(${P('users')}+${R('users')})/2`,registrations:`${P('registrations')}+${R('newUsers')}/${A('fundedShare')}`,
    wins:`IF(AND(${R('active')}=1,${c}$6>=${A('delay')}+1+${A('salesCycle')},MOD(${c}$6-${A('delay')}-1-${A('salesCycle')},${A('winInterval')})=0),1,0)`,institutions:`${P('institutions')}+${R('wins')}`,
    retailTx:`${R('active')}*${R('avgUsers')}*${A('transactions')}*${A('success')}`,merchantTx:`${R('retailTx')}*${A('chargeable')}`,retailVolume:`${R('retailTx')}*${A('ticket')}`,merchantVolume:`${R('merchantTx')}*${A('ticket')}`,businessTransactions:`${R('active')}*${R('avgBusiness')}*${A('businessTx')}*${A('success')}`,businessVolume:`${R('businessTransactions')}*${A('businessTicket')}`,
    grossRetail:`${R('merchantVolume')}*${A('retailFee')}`,partnerRetail:`${R('merchantVolume')}*${A('railPct')}+${R('merchantTx')}*${A('railFixed')}`,grossBusiness:`${R('businessTransactions')}*${A('businessFee')}`,partnerBusiness:`${R('businessTransactions')}*${A('businessRail')}`,retained:`${R('grossRetail')}-${R('partnerRetail')}+${R('grossBusiness')}-${R('partnerBusiness')}`,subscriptions:`${R('active')}*${R('avgBusiness')}*${A('businessPrice')}`,recurring:`${R('institutions')}*${A('institutionPrice')}`,setup:`${R('wins')}*${A('institutionSetup')}`,revenue:`SUM(${R('retained')}:${R('setup')})`,
    variableLoss:`(${R('retailVolume')}+${R('businessVolume')})*${A('fraud')}`,userCost:`${R('avgUsers')}*${A('support')}`,kycCost:`${R('newUsers')}*${A('kyc')}`,direct:`SUM(${R('variableLoss')}:${R('kycCost')})+${R('subscriptions')}*${A('businessCost')}+${R('recurring')}*${A('institutionCost')}+${R('setup')}*${A('setupCostRate')}`,contribution:`${R('revenue')}-${R('direct')}`,
    payroll:`(${A('engineers')}*${A('engineerPay')}+${A('compliance')}*${A('compliancePay')}+${A('operations')}*${A('operationsPay')})*IF(${R('active')}=1,1,${A('prelaunch')})`,fixed:`${R('payroll')}+${A('cloud')}+${A('legal')}+${A('admin')}`,acquisition:`${R('active')}*${A('ads')}+${R('newBusiness')}*${A('businessAcq')}`,ebitda:`${R('contribution')}-${R('fixed')}-${R('acquisition')}`,
    receivable:P('closingAR'),closingAR:`${R('recurring')}+${R('setup')}`,cashRevenue:`${R('revenue')}-${R('closingAR')}+${R('receivable')}`,launchCost:`IF(${c}$6=1,${A('launchSetup')},0)`,operatingCash:`${R('cashRevenue')}-${R('direct')}-${R('fixed')}-${R('acquisition')}-${R('launchCost')}`,cumulative:`${P('cumulative')}+${R('operatingCash')}`,ownLiquidity:`(${R('merchantVolume')}+${R('businessVolume')})/30*${A('prefundDays')}*${A('stress')}`,freeBeforeFunding:`${R('cumulative')}-${R('ownLiquidity')}`,freeCash:`'Assumptions'!$E$6+${R('freeBeforeFunding')}`,recurringRevenue:`SUM(${R('retained')}:${R('recurring')})`,newFundedTotal:`${P('newFundedTotal')}+${R('newUsers')}`,
  };
  for(const [id,formula] of Object.entries(F)){cell(f,R(id),'='+formula,true);f.getRange(R(id)).format.font.color=formula.includes("'Assumptions'")?colors.green:colors.ink;}
}
f.getRange(`D${row.freeCash}:AM${row.freeCash}`).conditionalFormats.add('cellIs',{operator:'lessThan',formula:0,format:{fill:'#FEE2E2',font:{color:colors.red,bold:true}}});

const s=sheets.Summary;
cell(s,'C6','Conditional 36-month forecast from funding; no launch date or customer demand is confirmed.');
cell(s,'C7','Management net revenue excludes partner pass-throughs and all customer principal.');
cell(s,'C9','Metric');['D','E','F'].forEach((c,i)=>cell(s,`${c}9`,`Year ${i+1}`));header(s,9,3,6);
const summaryRows=[['users','Ending transacting consumers',11,'end'],['registrations','Cumulative registrations (inferred)',12,'end'],['business','Ending paying businesses',13,'end'],['institutions','Active institution contracts',14,'end'],['payments','Successful payment events',16,'payments'],['volume','Payment principal processed',17,'volume'],['revenue','Management net revenue',19,'sum'],['retained','Retained payment fees',20,'sum'],['subscriptions','Business subscriptions',21,'sum'],['recurring','Institution recurring revenue',22,'sum'],['setup','One-time accepted setup revenue',23,'sum'],['contribution','Contribution before fixed team',25,'sum'],['ebitda','Operating result before tax / D&A',26,'sum'],['ownLiquidity','Restricted own settlement liquidity',28,'end'],['freeCash','Ending free corporate cash',29,'end']];
for(const [id,label,r,method] of summaryRows) {
 cell(s,`C${r}`,label);
 for(let y=0;y<3;y++){const c=col(y+4),start=col(4+y*12),end=col(15+y*12);let formula=method==='end'?`'Forecast'!${end}${row[id]}`:method==='payments'?`SUM('Forecast'!${start}${row.retailTx}:${end}${row.retailTx})+SUM('Forecast'!${start}${row.businessTransactions}:${end}${row.businessTransactions})`:method==='volume'?`SUM('Forecast'!${start}${row.retailVolume}:${end}${row.retailVolume})+SUM('Forecast'!${start}${row.businessVolume}:${end}${row.businessVolume})`:`SUM('Forecast'!${start}${row[id]}:${end}${row[id]})`;cell(s,`${c}${r}`,'='+formula,true);s.getRange(`${c}${r}`).setNumberFormat(['users','registrations','business','institutions','payments'].includes(id)?number:money);}
}
for(const r of [19,25,26,29]){s.getRange(`C${r}:F${r}`).format.fill=colors.light;s.getRange(`C${r}:F${r}`).format.font.bold=true;}
cell(s,'H10','Funding requirement (includes 20% contingency)');cell(s,'H12','First 18 months');cell(s,'H13','Full 36 months');
cell(s,'K12',`=MAX(0,-MIN('Forecast'!D${row.freeBeforeFunding}:U${row.freeBeforeFunding}))*(1+'Assumptions'!$E$9)`,true);
cell(s,'K13',`=MAX(0,-MIN('Forecast'!D${row.freeBeforeFunding}:AM${row.freeBeforeFunding}))*(1+'Assumptions'!$E$9)`,true);
s.getRange('K12:K13').setNumberFormat(money);
cell(s,'H16','Regulatory capital / guarantees: unquoted');cell(s,'H17','Tax, existing liabilities and financing fees excluded');
cell(s,'H19','No-approval scenario is assessed separately in the report.');
cell(s,'H20','Negative free cash requires additional financing or a smaller plan.');
cell(s,'H23','New contracts, prices, retention and costs are analyst assumptions.');
cell(s,'H24','No probabilities are assigned to the cases.');
cell(s,'C32','Month');cell(s,'D32','Net revenue');cell(s,'E32','Operating result');header(s,32,3,5);
for(let m=1;m<=36;m++){const r=32+m,c=col(3+m);cell(s,`C${r}`,`M${String(m).padStart(2,'0')}`);cell(s,`D${r}`,`='Forecast'!${c}${row.revenue}`,true);cell(s,`E${r}`,`='Forecast'!${c}${row.ebitda}`,true);}
s.getRange('D33:E68').setNumberFormat(money);s.getRange('H1:H80').format.columnWidth=17;s.getRange('K1:K80').format.columnWidth=20;
const chart=s.charts.add('line',s.getRange('C32:E68'));chart.setPosition('H28','P48');chart.title='Monthly revenue and operating result';chart.titleTextStyle.fontSize=13;chart.titleTextStyle.typeface='Arial';chart.legend={position:'bottom',textStyle:{typeface:'Arial',fontSize:10}};chart.xAxis={axisType:'textAxis',textStyle:{typeface:'Arial',fontSize:10}};chart.yAxis={numberFormatCode:'$0,"k"',numberFormatSourceLinked:false,textStyle:{typeface:'Arial',fontSize:10}};

const d=sheets.Deal;
cell(d,'C6','Same price and equivalent economics for new and existing shares; founder initially owns 100%.');
cell(d,'C7','No debt, options, preference rights, tax or transaction fees included.');
cell(d,'C9','Transaction');cell(d,'F9','Illustrative funding');cell(d,'H9','$9m proposal');header(d,9,3,8);
const dealLabels={11:'Company receives primary capital',12:'Founder receives gross secondary',13:'Total investor payment',14:'Investor post-closing ownership',16:'Implied post-money equity value',17:'Implied pre-money equity value',19:'Ownership purchased through primary',20:'Ownership purchased from founder',21:'Founder post-closing ownership'};
for(const [r,label]of Object.entries(dealLabels))cell(d,`C${r}`,label);
cell(d,'F11',"='Assumptions'!$E$6",true);cell(d,'F12',"='Assumptions'!$E$7",true);cell(d,'F14',"='Assumptions'!$E$8",true);
cell(d,'H11',5000000);cell(d,'H12',4000000);cell(d,'H14',.33);
for(const c of ['F','H'])for(const [r,formula]of [[13,`SUM(${c}11:${c}12)`],[16,`${c}13/${c}14`],[17,`${c}16-${c}11`],[19,`${c}11/${c}16`],[20,`${c}12/${c}16`],[21,`1-${c}14`]])cell(d,`${c}${r}`,'='+formula,true);
for(const c of ['F','H']){d.getRange(`${c}11:${c}21`).setNumberFormat(money);for(const r of [14,19,20,21])d.getRange(`${c}${r}`).setNumberFormat(pct);}
cell(d,'C24','Current pre-money negotiation range (analyst judgment)');cell(d,'F24','Low');cell(d,'H24','High');header(d,24,3,8);
cell(d,'C25','Pre-money equity value');cell(d,'F25',750000);cell(d,'H25',1500000);d.getRange('F25:H25').setNumberFormat(money);d.getRange('F25').format.font.color=colors.blue;d.getRange('H25').format.font.color=colors.blue;
cell(d,'C26','Total consideration at selected primary / secondary split');
cell(d,'C27','Company capital at that split');cell(d,'C28','Founder gross proceeds at that split');
for(const c of ['F','H']){cell(d,`${c}26`,`=${c}25*$F$14/(1-$F$14*$F$11/$F$13)`,true);cell(d,`${c}27`,`=${c}26*$F$11/$F$13`,true);cell(d,`${c}28`,`=${c}26*$F$12/$F$13`,true);d.getRange(`${c}26:${c}28`).setNumberFormat(money);}
cell(d,'C30','Range is a negotiating hypothesis with low confidence; no comparable local sale or priced offer supplied.');
cell(d,'C32','Common-equity investor return test');cell(d,'F32','Illustrative funding');cell(d,'H32','$9m proposal');header(d,32,3,8);
cell(d,'C33','Assumed future ownership dilution');cell(d,'F33',"='Assumptions'!$E$10",true);cell(d,'H33','=F33',true);d.getRange('F33:H33').setNumberFormat(pct);
cell(d,'C34','Target investor money multiple');cell(d,'F34',globals.returnMultiple);cell(d,'H34','=F34',true);
cell(d,'C35','Required company equity value at exit');cell(d,'C36','Illustrative exit net-revenue multiple');cell(d,'F36',globals.revenueMultiple);cell(d,'H36','=F36',true);
cell(d,'C37','Annual net revenue needed at that exit multiple');
for(const c of ['F','H']){cell(d,`${c}35`,`=${c}13*${c}34/(${c}14*(1-${c}33))`,true);cell(d,`${c}37`,`=${c}35/${c}36`,true);d.getRange(`${c}35`).setNumberFormat(money);d.getRange(`${c}37`).setNumberFormat(money);}
cell(d,'C39','Return test is arithmetic, not an exit prediction; exit multiple and dilution are editable assumptions.');
d.getRange('C1:C50').format.columnWidth=68;d.getRange('F1:F50').format.columnWidth=23;d.getRange('H1:H50').format.columnWidth=23;

const checks=sheets.Checks;
const checkLabels=['Consumer cohort reconciliation','Business cohort reconciliation','Revenue stream reconciliation','Cash and liquidity reconciliation','Receivable cash timing reconciliation'];
checkLabels.forEach((label,i)=>cell(checks,`C${8+i}`,label));
for(let m=1;m<=36;m++){
 const c=col(m+3),p=col(m+2),R=id=>`'Forecast'!${c}${row[id]}`,P=id=>m===1?'0':`'Forecast'!${p}${row[id]}`;
 cell(checks,`${c}7`,`M${m}`);const formulas=[`${R('users')}-${P('users')}-${R('newUsers')}+${R('usersLost')}`,`${R('business')}-${P('business')}-${R('newBusiness')}+${R('businessLost')}`,`${R('revenue')}-SUM('Forecast'!${c}${row.retained}:${c}${row.setup})`,`${R('freeCash')}-'Assumptions'!$E$6-${R('cumulative')}+${R('ownLiquidity')}`,`${R('cashRevenue')}-${R('revenue')}+${R('closingAR')}-${R('receivable')}`];
 formulas.forEach((v,i)=>cell(checks,`${c}${8+i}`,'='+v,true));
}
header(checks,7,3,39);checks.getRange('D8:AM12').setNumberFormat('0.00;(0.00);0.00');checks.getRange('D8:AM12').conditionalFormats.addCustom('ABS(D8)>0.01',{fill:'#FEE2E2',font:{color:colors.red,bold:true}});
cell(checks,'C15','Investor ownership reconciliation');cell(checks,'D15',"='Deal'!F19+'Deal'!F20-'Deal'!F14",true);checks.getRange('D15').setNumberFormat('0.0000');
cell(checks,'C18','Checks observe model outputs; no forecast or valuation depends on this sheet.');checks.freezePanes.freezeRows(7);checks.freezePanes.freezeColumns(3);

const sources=JSON.parse(await fs.readFile(path.join(out,'sources.json'),'utf8'));
const src=sheets.Sources;cell(src,'C6','Current business facts are founder-reported; audited accounts and cap table were not supplied.');
src.getRange('C1:C35').format.columnWidth=7;src.getRange('D1:D35').format.columnWidth=47;src.getRange('E1:E35').format.columnWidth=20;src.getRange('F1:F35').format.columnWidth=95;src.getRange('G1:G35').format.columnWidth=95;
src.getRange('C8:G8').values=[['ID','Source','Date','Use and limitation','URL / origin']];header(src,8,3,7);
src.getRange(`C9:G${8+sources.length}`).values=sources.map(r=>[r.id,r.title,r.date,r.use,r.url]);src.getRange(`D9:G${8+sources.length}`).format.wrapText=true;src.getRange(`C9:G${8+sources.length}`).format.rowHeight=55;src.freezePanes.freezeRows(8);
cell(src,'D24','All forecast drivers: analyst assumptions in Assumptions. No vendor quotes or observed conversion/retention data.');

// Independent JavaScript simulation versus the spreadsheet's live formulas.
const verification=[];
for(let ci=0;ci<3;ci++) {
 cell(a,'D4',ci+1);
 for(let y=0;y<3;y++)for(const [key,,r]of summaryRows){
   const v=s.getRange(`${col(y+4)}${r}`).values[0][0], jsKey=key==='recurring'?'institutionRecurring':key;
   const expected=simulations[ci].annual[y][jsKey];
   assert.equal(typeof v,'number',`Not numeric ${cases[ci]} ${key}`);assert.ok(Math.abs(v-expected)<.005,`${cases[ci]} Y${y+1} ${key}: ${v} != ${expected}`);
 }
 assert.ok(Math.abs(s.getRange('K12').values[0][0]-simulations[ci].required18)<.005);
 verification.push({case:cases[ci],annualOutputsMatch:true,fundingMatch:true});
}
cell(a,'D4',2);
const baseRevenue=s.getRange('F19').values[0][0],laterCell=`G${ar.businessPrice+2}`,oldPrice=a.getRange(laterCell).values[0][0];
cell(a,laterCell,oldPrice*1.1);assert.ok(s.getRange('F19').values[0][0]>baseRevenue);cell(a,laterCell,oldPrice);
// Unselected missing input cannot break Base; selecting it must expose the missing value.
const missingCell=`F${ar.consumerCAC+1}`,saved=a.getRange(missingCell).values[0][0];
cell(a,missingCell,null);assert.equal(s.getRange('F19').values[0][0],baseRevenue);cell(a,'D4',1);
assert.notEqual(typeof f.getRange(`P${row.paid}`).values[0][0],'number');cell(a,missingCell,saved);cell(a,'D4',2);
cell(a,'E6',0);assert.ok(f.getRange(`D${row.freeCash}`).values[0][0]<0);cell(a,'E6',globals.primary);
assert.ok(Math.abs(d.getRange('H16').values[0][0]-27272727.27272727)<.01);assert.ok(Math.abs(d.getRange('H17').values[0][0]-22272727.27272727)<.01);
wb.recalculate();
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:30},summary:'Final formula error scan'});
await fs.writeFile(path.join(out,'workbook-error-scan.ndjson'),errors.ndjson);
await fs.writeFile(path.join(out,'workbook-verification.json'),JSON.stringify({verification,laterPeriodInputTest:true,unselectedBlankTest:true,selectedBlankExposed:true,zeroFundingTest:true,dealArithmeticTest:true},null,2));
await fs.writeFile(path.join(out,'workbook-summary.ndjson'),(await wb.inspect({kind:'table',range:'Summary!C9:F29',include:'values,formulas',tableMaxRows:22,tableMaxCols:5,maxChars:6500})).ndjson);
const previews=[['Summary','C2:M29','summary'],['Summary','C28:P49','chart'],['Assumptions','C4:K28','assumptions'],['Assumptions','C173:K200','assumptions-late'],['Forecast','C6:J28','forecast-activity'],['Forecast','C34:J58','forecast-cash'],['Forecast','AG34:AM58','forecast-late'],['Deal','C2:J39','deal'],['Checks','C4:J18','checks'],['Sources','C8:G15','sources'],['Sources','C16:G24','sources-late']];
for(const [sheetName,range,name]of previews.filter(p=>!process.argv.includes('--review-chart')||p[2]==='chart')){const blob=await wb.render({sheetName,range,scale:1.3});await fs.writeFile(path.join(out,`${name}.png`),new Uint8Array(await blob.arrayBuffer()));}
await (await SpreadsheetFile.exportXlsx(wb)).save(path.join(out,'Tazdan_Financial_Model_2026-11-10.xlsx'));
await fs.writeFile(path.join(out,'model-layout.json'),JSON.stringify({forecastRows:row,assumptionRows:ar},null,2));
console.log('Workbook exported; all cases match independent calculations.');
