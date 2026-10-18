import fs from 'node:fs/promises';
import path from 'node:path';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const out = path.dirname(new URL(import.meta.url).pathname);
const wb = Workbook.create();
const summary = wb.worksheets.add('Summary');
const forecast = wb.worksheets.add('Forecast');
const inputs = wb.worksheets.add('Assumptions');
const sources = wb.worksheets.add('CBL Sources');
const ink = '#17364A', teal = '#087E8B', pale = '#EAF4F4', muted = '#526776';
const money = '$#,##0;($#,##0);"—"';
const count = '#,##0;(#,##0);"—"';
const pct = '0.00%;(0.00%);"—"';
const dec = '0.00;(0.00);"—"';
const sourceUrl = 'https://cbl.gov.ly/micifaf/2026/10/' + encodeURIComponent('تقــــرير-إستخدامات-المصارف-للنقد-الأجنبي-حتى-نهاية-سبتمبر-2026') + '.pdf';
const indexUrl = 'https://cbl.gov.ly/uses-of-foreign-exch/';

function write(sh, address, value) { sh.getRange(address).values = [[value]]; }
function formula(sh, address, value) { sh.getRange(address).formulas = [[value]]; }
function mergeText(sh, address, value, size=10, color=ink) {
  sh.getRange(address).merge(); sh.getRange(address).values = [[value]];
  sh.getRange(address).format.font = {name:'Arial',size,color};
  sh.getRange(address).format.wrapText = true;
}
function band(sh, address) {
  sh.getRange(address).format.fill = pale;
  sh.getRange(address).format.font = {name:'Arial',size:10,bold:true,color:ink};
}
for (const sh of [summary,forecast,inputs,sources]) {
  sh.showGridLines = false;
  sh.getRange('A1:AH60').format.font = {name:'Arial',size:10,color:ink};
  sh.getRange('A1:AH60').format.rowHeight = 23;
  sh.getRange('A:A').format.columnWidth = 3;
  sh.tabColor = teal;
}

// Auditable, independently sourced market context. No conversion into demand.
sources.getRange('B:B').format.columnWidth = 35;
sources.getRange('C:C').format.columnWidth = 22;
sources.getRange('D:D').format.columnWidth = 20;
sources.getRange('E:E').format.columnWidth = 24;
sources.getRange('F:F').format.columnWidth = 14;
sources.getRange('G:J').format.columnWidth = 15;
mergeText(sources,'B2:J2','CBL market evidence | 17 October 2026',20);
mergeText(sources,'B3:J3','Published actuals are context. They do not establish Tazdan eligibility, corridor access, demand or market share.',10,muted);
sources.getRange('B5:F5').values = [['Reported category','Actual USD equivalent','Unit','Period','PDF page']]; band(sources,'B5:F5');
const actuals = [
  ['Total bank FX uses',19341501336,'USD equivalent','Jan–Sep 2026',2],
  ['Documentary letters of credit',10113469233,'USD equivalent','Jan–Sep 2026',2],
  ['Transfers (الحوالات)',2681416804,'USD equivalent','Jan–Sep 2026',2],
  ['Personal purposes',6507616299,'USD equivalent','Jan–Sep 2026',2],
  ['Months observed',9,'months','Jan–Sep 2026',''],
];
sources.getRange('B6:F10').values = actuals;
sources.getRange('C6:C9').setNumberFormat(money);
write(sources,'B12','Transfer monthly mean'); formula(sources,'C12','=C8/C10');
write(sources,'B13','Transfer annualised run rate'); formula(sources,'C13','=C12*12');
sources.getRange('C12:C13').setNumberFormat(money);
mergeText(sources,'D12:J13','Derived arithmetic, not a CBL forecast. Transfers include flows beyond the proposed consumer remittance product.',10,muted);
mergeText(sources,'B15:J15','PRIMARY SOURCE — CBL bank foreign-exchange uses report through 30 September 2026',11);
mergeText(sources,'B16:J18',sourceUrl,9,teal);
mergeText(sources,'B20:J20','Official publication index: '+indexUrl,10,teal);
mergeText(sources,'B22:J24','The report summary is printed page 2 (PDF page index 1). Merchant cards are outside the three categories shown. The reported total is not their subtotal. No CBL customer counts, corridor split, provider prices or acquisition costs were assumed.',10,muted);
mergeText(sources,'B26:J28','No LYD/USD conversion is used. All model volumes are USD equivalent. Personal FX allowances, LCs and gross domestic e-payments are excluded from the transfer benchmark. Figures were transcribed from the official report; verify against the original before investor use.',10,muted);
sources.freezePanes.freezeRows(5);

// A single scenario selector feeds one 24-month calculation.
inputs.getRange('B:B').format.columnWidth = 35;
inputs.getRange('C:C').format.columnWidth = 20;
inputs.getRange('D:D').format.columnWidth = 16;
inputs.getRange('E:G').format.columnWidth = 17;
inputs.getRange('H:L').format.columnWidth = 13;
mergeText(inputs,'B2:L2','Operating assumptions | editable planning inputs',20);
mergeText(inputs,'B3:L3','Blue = user assumption; green = linked formula; black = calculation. No input below is a CBL fact or a provider quote.',10,muted);
write(inputs,'B5','Scenario: 1 Downside · 2 Base · 3 Growth'); write(inputs,'C5',2);
inputs.getRange('C5').format.font = {name:'Arial',size:12,bold:true,color:'#175DDC'};
inputs.getRange('C5').dataValidation = {rule:{type:'list',values:['1','2','3']}};
inputs.getRange('B8:G8').values = [['Assumption','Active input','Unit','Downside','Base','Growth']]; band(inputs,'B8:G8');
const assumptions = [
  ['New customers, month 1',50,100,200,'customers','Funded, transacting customers; not registrations.'],
  ['Monthly acquisition growth',.05,.08,.10,'% / month','Compounded acquisition; capacity and demand unproven.'],
  ['Monthly customer attrition',.04,.02,.015,'% / month','Applied to opening active customers.'],
  ['Transfers per active customer',1.1,1.3,1.5,'per month','Applied to average active customers.'],
  ['Average transfer principal',750,1500,2000,'USD','Blended ticket, subject to customer limits.'],
  ['Gross retained take rate',.005,.005,.005,'% of volume','Planning input only; legal fee caps and partner split must be confirmed.'],
  ['Variable rail and FX cost',.0025,.0015,.0012,'% of volume','Assumed all-in variable FX/rail cost; obtain signed quotes.'],
  ['Cost per transfer',1,.75,.5,'USD','Additional variable processing cost.'],
  ['Expected loss provision',.0003,.0003,.0003,'% of volume','Expected economic loss, not a safeguarding haircut.'],
  ['Acquisition cost per customer',25,20,15,'USD','Cash marketing / referral cost for each newly active customer.'],
  ['Monthly fixed opex, year 1',18000,20000,30000,'USD','Compliance, staff, audit, technology and provider minimums assumed.'],
  ['Monthly fixed opex, year 2',20000,25000,40000,'USD','Full operating budget must replace this placeholder.'],
  ['One-time setup cost',75000,100000,150000,'USD','Paid in month 1; licenses, integration and launch budget assumed.'],
  ['Opening corporate capital',500000,750000,1500000,'USD','Illustrative capital available; not funding secured.'],
  ['Payout prefunding days',3,5,7,'days','Own corporate liquidity; assumes continuous lawful replenishment.'],
  ['Prefunding stress multiplier',1.5,1.5,2,'times','Applied to daily transfer volume. Separate currency pools may need more.'],
  ['Days per model month',30,30,30,'days','Uniform month convention; not a dated calendar forecast.'],
];
for (let i=0;i<assumptions.length;i++) {
  const row=9+i, [label,down,base,growth,unit,note]=assumptions[i];
  write(inputs,`B${row}`,label); formula(inputs,`C${row}`,`=CHOOSE($C$5,E${row},F${row},G${row})`);
  write(inputs,`D${row}`,unit); inputs.getRange(`E${row}:G${row}`).values=[[down,base,growth]];
  mergeText(inputs,`H${row}:L${row}`,note,9,muted);
  inputs.getRange(`H${row}:L${row}`).format.rowHeight=34;
  inputs.getRange(`E${row}:G${row}`).format.font={name:'Arial',size:10,color:'#175DDC'};
  inputs.getRange(`C${row}`).format.font={name:'Arial',size:10,bold:true,color:'#00814B'};
  inputs.getRange(`C${row}:G${row}`).setNumberFormat(unit.startsWith('%')?pct:unit==='USD'?money:dec);
}
mergeText(inputs,'B28:L30','EXCLUDED / UNPRICED: regulatory capital, safeguarding guarantees, tax, financing, blocked-bank balances and country-specific licensing. Customer principal stays outside corporate cash and revenue. Any excluded cost is additional funding, never presumed zero.',10,muted);
inputs.freezePanes.freezeRows(8);
inputs.getRange('C16:G16').setNumberFormat('$0.00;($0.00);"—"');

forecast.getRange('B:B').format.columnWidth=33;
forecast.getRange('C:C').format.columnWidth=3;
forecast.getRange('D:D').format.columnWidth=12;
forecast.getRange('E:AB').format.columnWidth=16;
mergeText(forecast,'B2:P2','24-month launch model | months after an authorised launch',20);
mergeText(forecast,'B3:P3','Average-month activity; fractional counts are expected values. No launch date or permission to operate is assumed.',10,muted);
const labels={7:['Opening active customers','customers'],8:['New active customers','customers'],9:['Customer attrition','customers'],10:['Closing active customers','customers'],11:['Average active customers','customers'],12:['Transfers','count'],13:['Average transfer','USD'],14:['Transfer principal volume','USD'],16:['Gross fee revenue','USD'],17:['Variable rail / FX cost','USD'],18:['Per-transfer processing cost','USD'],19:['Expected loss provision','USD'],20:['Contribution','USD'],22:['Acquisition spend','USD'],23:['Fixed operating expense','USD'],24:['Operating result','USD'],25:['Cumulative operating result','USD'],27:['Required corporate prefunding','USD'],28:['Change in prefunding','USD'],29:['One-time setup cost','USD'],30:['Free corporate cash','USD'],31:['Additional capital gap','USD'],32:['Volume / CBL monthly transfers','%'],33:['Monthly operating break-even volume','USD'],34:['Cash bridge check (zero)','USD']};
for(const [r,[label,unit]] of Object.entries(labels)){write(forecast,`B${r}`,label);write(forecast,`D${r}`,unit);}
const cols=Array.from({length:24},(_,i)=>{let n=i+5,s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s;});
for(let i=0;i<24;i++) {
  const c=cols[i],p=cols[i-1]; write(forecast,`${c}5`,`Month ${i+1}`); write(forecast,`${c}6`,i+1);
  const f={
    7:i?`=${p}10`:'=0',
    8:i?`=${p}8*(1+Assumptions!$C$10)`:'=Assumptions!$C$9',
    9:`=${c}7*Assumptions!$C$11`,10:`=${c}7+${c}8-${c}9`,11:`=(${c}7+${c}10)/2`,
    12:`=${c}11*Assumptions!$C$12`,13:'=Assumptions!$C$13',14:`=${c}12*${c}13`,
    16:`=${c}14*Assumptions!$C$14`,17:`=${c}14*Assumptions!$C$15`,18:`=${c}12*Assumptions!$C$16`,19:`=${c}14*Assumptions!$C$17`,
    20:`=${c}16-SUM(${c}17:${c}19)`,22:`=${c}8*Assumptions!$C$18`,23:`=IF(${c}6<=12,Assumptions!$C$19,Assumptions!$C$20)`,
    24:`=${c}20-${c}22-${c}23`,25:i?`=${p}25+${c}24`:`=${c}24`,
    27:`=${c}14/Assumptions!$C$25*Assumptions!$C$23*Assumptions!$C$24`,28:i?`=${c}27-${p}27`:`=${c}27`,
    29:i?'=0':'=Assumptions!$C$21',
    30:i?`=${p}30+${c}24-${c}28-${c}29`:`=Assumptions!$C$22+${c}24-${c}28-${c}29`,
    31:`=MAX(0,-${c}30)`,32:`=${c}14/'CBL Sources'!$C$12`,
    33:`=IF(Assumptions!$C$14-Assumptions!$C$15-Assumptions!$C$17-Assumptions!$C$16/Assumptions!$C$13>0,(${c}23+${c}22)/(Assumptions!$C$14-Assumptions!$C$15-Assumptions!$C$17-Assumptions!$C$16/Assumptions!$C$13),0)`,
    34:`=ROUND(${c}30-(Assumptions!$C$22+${c}25-SUM($E$29:${c}29)-${c}27),6)`,
  };
  for(const [r,v]of Object.entries(f))formula(forecast,`${c}${r}`,v);
}
forecast.getRange('E7:AB34').setNumberFormat(money);
forecast.getRange('E7:AB12').setNumberFormat(count);
forecast.getRange('E32:AB32').setNumberFormat(pct);
for(const r of[5,10,14,20,24,27,30,34])band(forecast,`B${r}:AB${r}`);
forecast.getRange('E7:AB34').format.font={name:'Arial',size:10,color:'#111111'};
for(const r of[8,9,12,13,16,17,18,19,22,23,27,29,32,33,34])forecast.getRange(`E${r}:AB${r}`).format.font={name:'Arial',size:10,color:'#00814B'};
mergeText(forecast,'B37:P39','Prefunding is locked corporate working capital, not an expense. Free cash excludes prefunding and customer principal. Positive operating result excludes setup, tax and financing. Break-even includes current month acquisition spend. Negative free cash means a funding shortfall before excluded capital requirements.',10,muted);
forecast.freezePanes.freezeRows(6);forecast.freezePanes.freezeColumns(4);

summary.getRange('B:B').format.columnWidth=36;
summary.getRange('C:C').format.columnWidth=20;
summary.getRange('D:E').format.columnWidth=18;
summary.getRange('F:M').format.columnWidth=12;
mergeText(summary,'B2:M2','Tazdan | launch economics & funding',22);
mergeText(summary,'B3:M3','Planning model • 17 October 2026 • all amounts USD equivalent • conditional on legal, banking and provider approvals',10,muted);
write(summary,'B5','Selected case');formula(summary,'C5','=CHOOSE(Assumptions!C5,"Downside","Base","Growth")');
mergeText(summary,'E5:M6','Change Assumptions!C5 to 1 / 2 / 3. CBL actuals stay fixed. These cases are sensitivities, not probabilities or promised outcomes.',10,muted);
summary.getRange('B8:E8').values=[['Operating metric','Year 1','Year 2','Unit']];band(summary,'B8:E8');
const metricRows=[[9,'Transfer principal volume',14],[10,'Gross fee revenue',16],[11,'Contribution after variable cost',20],[12,'Operating result',24]];
for(const[r,label,fr]of metricRows){write(summary,`B${r}`,label);formula(summary,`C${r}`,`=SUM(Forecast!E${fr}:P${fr})`);formula(summary,`D${r}`,`=SUM(Forecast!Q${fr}:AB${fr})`);write(summary,`E${r}`,'USD');}
write(summary,'B13','Closing active customers');formula(summary,'C13','=Forecast!P10');formula(summary,'D13','=Forecast!AB10');write(summary,'E13','customers');
write(summary,'B14','Monthly volume / CBL benchmark');formula(summary,'C14','=Forecast!P32');formula(summary,'D14','=Forecast!AB32');write(summary,'E14','% of monthly mean');
summary.getRange('C9:D12').setNumberFormat(money);summary.getRange('C13:D13').setNumberFormat(count);summary.getRange('C14:D14').setNumberFormat(pct);
band(summary,'G8:M8');mergeText(summary,'G8:M8','24-MONTH CAPITAL VIEW',11);
const capital=[['Opening corporate capital','=Assumptions!C22'],['Peak required prefunding','=MAX(Forecast!E27:AB27)'],['Lowest free corporate cash','=MIN(Forecast!E30:AB30)'],['Additional funding gap','=MAX(Forecast!E31:AB31)'],['Month 24 break-even volume','=Forecast!AB33'],['Month 24 operating result','=Forecast!AB24']];
for(let i=0;i<capital.length;i++){mergeText(summary,`G${9+i}:K${9+i}`,capital[i][0]);summary.getRange(`L${9+i}:M${9+i}`).merge();formula(summary,`L${9+i}`,capital[i][1]);}
summary.getRange('L9:M14').setNumberFormat(money);
mergeText(summary,'B16:M17','CBL actual Jan–Sep 2026 transfers: $2.681bn; monthly mean: $297.94m. This includes activity outside the proposed product. Implied share is a scale comparison, not an addressable-market estimate.',10,muted);
forecast.getRange('AD:AF').format.columnWidth=20;
forecast.getRange('AD4:AF4').values=[['Chart month','Fee revenue (USD)','Operating result (USD)']];band(forecast,'AD4:AF4');
for(let i=0;i<24;i++)forecast.getRange(`AD${i+5}:AF${i+5}`).formulas=[[`=${cols[i]}5`,`=${cols[i]}16`,`=${cols[i]}24`]];
forecast.getRange('AE5:AF28').setNumberFormat(money);
const chart=summary.charts.add('line',forecast.getRange('AD4:AF28'));
chart.title='Monthly fee revenue and operating result';chart.setPosition('B19','M33');
chart.titleTextStyle.typeface='Arial';chart.titleTextStyle.fontSize=12;
chart.legend={position:'top',textStyle:{typeface:'Arial',fontSize:10}};
chart.xAxis={axisType:'textAxis',textStyle:{typeface:'Arial',fontSize:9}};
chart.yAxis={numberFormatCode:'$#,##0',numberFormatSourceLinked:false,textStyle:{typeface:'Arial',fontSize:9}};
if(chart.series.items[0]){chart.series.items[0].name='Fee revenue';chart.series.items[0].line={fill:teal,width:2};}
if(chart.series.items[1]){chart.series.items[1].name='Operating result';chart.series.items[1].line={fill:'#C45C36',width:2};}
mergeText(summary,'B35:M37','Decision rule: prove lawful LYD collection and outward replenishment, signed provider pricing, reliable settlement and a funded capital plan before launch. An offshore sister company does not itself solve these conditions. Forecasting approximate FX values never substitutes for exact settlement obligations.',10,muted);
mergeText(summary,'B39:M41','This is a management planning model, not audited accounts or a CBL forecast. No probability weighting is implied. Growth requires material liquidity and service capacity. Capital requirements, country licenses, safeguarding guarantees and tax are additional and remain unpriced.',10,muted);
summary.getRange('C5:D14').format.font={name:'Arial',size:11,color:'#00814B'};
summary.getRange('L9:M14').format.font={name:'Arial',size:11,bold:true,color:'#00814B'};
summary.freezePanes.freezeRows(8);

wb.recalculate();
const results={};
for(const [value,name]of[[1,'Downside'],[2,'Base'],[3,'Growth']]){
  write(inputs,'C5',value);wb.recalculate();
  results[name]={annual:summary.getRange('C9:D14').values,capital:summary.getRange('L9:L14').values,cashChecks:forecast.getRange('E34:AB34').values};
}
// A live-input sensitivity check proves the model responds to ticket size.
write(inputs,'C5',2);wb.recalculate();
const originalTicket=inputs.getRange('F13').values[0][0];
const originalVolume=summary.getRange('C9').values[0][0];
write(inputs,'F13',originalTicket*1.1);wb.recalculate();
const perturbedVolume=summary.getRange('C9').values[0][0];
if(Math.abs(perturbedVolume/originalVolume-1.1)>1e-8)throw new Error('Ticket sensitivity failed');
write(inputs,'F13',originalTicket);wb.recalculate();
await fs.writeFile(path.join(out,'model-checks.json'),JSON.stringify({results,sensitivity:{originalVolume,perturbedVolume,passed:true}},null,2));
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#N/A',options:{useRegex:true,maxResults:50},maxChars:5000})).ndjson);
for(const[name,range,file]of[['Summary','B1:M42','summary.png'],['Assumptions','B1:L31','assumptions.png'],['CBL Sources','B1:J29','sources.png'],['Forecast','B1:P39','forecast-year1.png'],['Forecast','Q4:AB34','forecast-year2.png'],['Forecast','AD4:AF28','chart-source.png']]){
  const blob=await wb.render({sheetName:name,range,scale:1,format:'png'});
  await fs.writeFile(path.join(out,file),new Uint8Array(await blob.arrayBuffer()));
}
const file=await SpreadsheetFile.exportXlsx(wb);await file.save(path.join(out,'Tazdan_CBL_Launch_Model_2026-10-17.xlsx'));
console.log(JSON.stringify({output:path.join(out,'Tazdan_CBL_Launch_Model_2026-10-17.xlsx'),results},null,2));
