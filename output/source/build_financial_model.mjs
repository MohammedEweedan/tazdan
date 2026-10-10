import fs from 'node:fs/promises';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const outDir = '/Users/moe/Downloads/promrkts/outputs/tazdan-manifesto-20261006';
await fs.mkdir(outDir, {recursive:true});

const drivers = [
  ['Registered users', [15000,70000,150000,500000], [30000,180000,500000,1500000], [50000,300000,900000,2800000], '#,##0'],
  ['Monthly active users', [3000,20000,55000,180000], [6000,55000,170000,650000], [11000,110000,350000,1150000], '#,##0'],
  ['Active businesses', [20,150,450,1800], [50,500,2000,9000], [100,1200,5000,20000], '#,##0'],
  ['Transactions per MAU per month', [2,2.5,3,3.5], [2.5,3,3.5,4], [2.8,3.5,4,4.6], '0.0'],
  ['Average ticket (USD)', [120,140,160,210], [150,180,220,260], [160,200,240,290], '"$"#,##0'],
  ['Blended take rate', [.014,.013,.012,.010], [.015,.013,.011,.010], [.016,.014,.012,.010], '0.0%'],
  ['Gross margin', [.35,.40,.50,.55], [.45,.50,.55,.64], [.45,.54,.60,.68], '0.0%'],
  ['Operating expense (USD m)', [1.2,2.4,5,14], [1.5,4,10,40], [1.8,6,17,70], '"$"#,##0.0'],
  ['Staff', [18,35,65,170], [22,55,120,400], [28,80,190,700], '#,##0'],
  ['Remittance share of volume', [.12,.18,.22,.30], [.16,.23,.30,.36], [.18,.28,.36,.42], '0.0%'],
];

const wb = Workbook.create();
const model = wb.worksheets.add('Model');
const assumptions = wb.worksheets.add('Assumptions');
model.showGridLines = false;
assumptions.showGridLines = false;
model.tabColor = '#12304A';
assumptions.tabColor = '#2F6784';

assumptions.getRange('A2').values = [['Tazdan financial assumptions']];
assumptions.getRange('A3:B9').values = [
  ['Case number (1 Conservative, 2 Base, 3 Upside)',2],
  ['Revenue allowance for D&A, finance and other costs',.06],
  ['Illustrative tax on positive earnings',.20],
  ['Liquidity reserve as share of monthly remittance volume',.20],
  ['Operating buffer as share of annual operating expense',.25],
  ['Technology share of operating expense',.18],
  ['Compliance share of operating expense',.16],
];
assumptions.getRange('A10:B10').values = [['Marketing share of operating expense',.20]];
assumptions.getRange('D3').formulas = [['=CHOOSE(B3,"Conservative","Base","Upside")']];
assumptions.getRange('A12').values = [['Scenario drivers by milestone year']];
assumptions.getRange('C13:G13').values = [['Case','Y1','Y3','Y5','Y10']];
assumptions.getRange('B3').dataValidation = {rule:{type:'list',values:['1','2','3']}};

for (let i=0;i<drivers.length;i++) {
  const [name, con, base, up, fmt] = drivers[i];
  const row = 14+i*5;
  assumptions.getRange(`A${row}`).values = [[name]];
  assumptions.getRange(`C${row}:C${row+3}`).values = [['Active'],['Conservative'],['Base'],['Upside']];
  assumptions.getRange(`D${row+1}:G${row+3}`).values = [con,base,up];
  const cols = ['D','E','F','G'];
  assumptions.getRange(`D${row}:G${row}`).formulas = [cols.map(c=>`=CHOOSE($B$3,${c}${row+1},${c}${row+2},${c}${row+3})`)];
  assumptions.getRange(`D${row}:G${row+3}`).setNumberFormat(fmt);
  assumptions.getRange(`C${row}:G${row}`).format.fill = '#EAF2F7';
  assumptions.getRange(`C${row}:G${row}`).format.font = {name:'Arial',size:10,bold:true,color:'#12304A'};
  assumptions.getRange(`D${row+1}:G${row+3}`).format.font = {name:'Arial',size:10,color:'#1353A4'};
}
assumptions.getRange('A65').values = [['Source: Tazdan Manifesto illustrative financial scenarios, 6 October 2026. No transaction history or partner pricing was verified.']];
assumptions.getRange('A66').values = [['Milestone years are separate annual run rates; intermediate years are intentionally not interpolated.']];

model.getRange('C2').values = [['Tazdan illustrative financial model']];
model.getRange('C4').values = [['Selected case']];
model.getRange('D4').formulas = [["='Assumptions'!D3"]];
model.getRange('C5:G5').values = [['Metric','Y1','Y3','Y5','Y10']];
const summary = [
  ['Annual transaction volume (USD m)',31],
  ['Revenue (USD m)',33],
  ['Gross profit (USD m)',35],
  ['EBITDA (USD m)',40],
  ['Illustrative net income (USD m)',44],
  ['Remittance volume (USD m)',32],
  ['Indicative capital need (USD m)',46],
];
for (let i=0;i<summary.length;i++) {
  const row=6+i, [title,buildRow]=summary[i];
  model.getRange(`C${row}`).values=[[title]];
  model.getRange(`D${row}:G${row}`).formulas=[['D','E','F','G'].map(c=>`=${c}${buildRow}`)];
}
model.getRange('C15').values = [['Annual run rates at Y1, Y3, Y5 and Y10. USD millions unless stated. Figures are illustrative, not actuals.']];
model.getRange('C17').values = [['Selected operating drivers']];
const inputRows = [
  [19,'Registered users',14],[20,'Monthly active users',19],[21,'Active businesses',24],
  [22,'Transactions per MAU per month',29],[23,'Average ticket (USD)',34],
  [24,'Blended take rate',39],[25,'Gross margin',44],
  [26,'Operating expense (USD m)',49],[27,'Staff',54],[28,'Remittance share of volume',59],
];
for (const [row,title,assRow] of inputRows) {
  model.getRange(`C${row}`).values = [[title]];
  model.getRange(`D${row}:G${row}`).formulas = [['D','E','F','G'].map(c=>`='Assumptions'!${c}${assRow}`)];
}
model.getRange('C30').values = [['Financial build (USD m unless stated)']];
const calcLabels = {
 31:'Annual transaction volume',32:'Remittance volume',33:'Revenue',34:'Partner and processing cost',
 35:'Gross profit',36:'Technology expense',37:'Compliance expense',38:'Marketing expense',
 39:'Other operating expense',40:'EBITDA',41:'D&A, finance and other allowance',
 42:'Positive income after allowance',43:'Illustrative tax',44:'Illustrative net income',
 45:'Liquidity reserve',46:'Indicative capital need',
};
for (const [row,title] of Object.entries(calcLabels)) model.getRange(`C${row}`).values = [[title]];
for (const c of ['D','E','F','G']) {
  const f={
   31:`=${c}20*${c}22*${c}23*12/1000000`,
   32:`=${c}31*${c}28`,
   33:`=${c}31*${c}24`,
   34:`=${c}33-${c}35`,
   35:`=${c}33*${c}25`,
   36:`=${c}26*'Assumptions'!$B$8`,
   37:`=${c}26*'Assumptions'!$B$9`,
   38:`=${c}26*'Assumptions'!$B$10`,
   39:`=${c}26-SUM(${c}36:${c}38)`,
   40:`=${c}35-${c}26`,
   41:`=${c}33*'Assumptions'!$B$4`,
   42:`=MAX(0,${c}40-${c}41)`,
   43:`=${c}42*'Assumptions'!$B$5`,
   44:`=${c}40-${c}41-${c}43`,
   45:`=${c}32/12*'Assumptions'!$B$6`,
   46:`=MAX(0,-${c}40)+${c}45+${c}26*'Assumptions'!$B$7`,
  };
  for (const [row,formula] of Object.entries(f)) model.getRange(`${c}${row}`).formulas = [[formula]];
}
model.getRange('C48').values = [['Capital need = EBITDA loss coverage + liquidity reserve + 25% operating buffer. No financing structure is assumed.']];
model.getRange('C49').values = [['Illustrative tax and expense allowance are planning proxies, not jurisdiction-specific accounting or tax advice.']];

for (const s of [model,assumptions]) {
  s.getRange('A1:H66').format.font = {name:'Arial',size:10,color:'#203446'};
  s.getRange('A1:H66').format.rowHeight = 21;
  s.getRange('A:A').format.columnWidth = s===assumptions ? 49 : 3;
  s.getRange('B:B').format.columnWidth = s===assumptions ? 17 : 3;
  s.getRange('C:C').format.columnWidth = s===assumptions ? 20 : 42;
  s.getRange('D:G').format.columnWidth = 17;
  s.getRange('H:H').format.columnWidth = 3;
  s.getRange('A2:G2').format.rowHeight = 30;
}
model.getRange('C2').format.font = {name:'Arial',size:15,bold:true,color:'#12304A'};
assumptions.getRange('A2').format.font = {name:'Arial',size:15,bold:true,color:'#12304A'};
for (const r of ['C5:G5','C17:G17','C30:G30']) {
 model.getRange(r).format.fill='#12304A';
 model.getRange(r).format.font={name:'Arial',size:10,bold:true,color:'#FFFFFF'};
}
assumptions.getRange('C13:G13').format.fill='#12304A';
assumptions.getRange('C13:G13').format.font={name:'Arial',size:10,bold:true,color:'#FFFFFF'};
assumptions.getRange('B3:B10').format.fill='#FFF2C7';
assumptions.getRange('B3:B10').format.font={name:'Arial',size:10,color:'#1353A4'};
assumptions.getRange('B4:B10').setNumberFormat('0.0%');
assumptions.getRange('B3').setNumberFormat('0');
model.getRange('D4').format.fill='#EAF2F7';
model.getRange('D4').format.font={name:'Arial',size:10,bold:true,color:'#167848'};
model.getRange('D6:G12').setNumberFormat('"$"#,##0.00;("$"#,##0.00);–');
model.getRange('D19:G21').setNumberFormat('#,##0');
model.getRange('D22:G22').setNumberFormat('0.0');
model.getRange('D23:G23').setNumberFormat('"$"#,##0');
model.getRange('D24:G25').setNumberFormat('0.0%');
model.getRange('D26:G26').setNumberFormat('"$"#,##0.0');
model.getRange('D27:G27').setNumberFormat('#,##0');
model.getRange('D28:G28').setNumberFormat('0.0%');
model.getRange('D31:G46').setNumberFormat('"$"#,##0.00;("$"#,##0.00);–');
for (const row of [9,10,12,35,40,44,46]) {
 model.getRange(`C${row}:G${row}`).format.font={name:'Arial',size:10,bold:true,color:'#12304A'};
 model.getRange(`C${row}:G${row}`).format.borders={bottom:{style:'thin',color:'#9DB5C5'}};
}
model.getRange('C15:G15').format.font={name:'Arial',size:9,italic:true,color:'#647586'};
model.getRange('C48:G49').format.font={name:'Arial',size:9,italic:true,color:'#647586'};
assumptions.getRange('A65:G66').format.font={name:'Arial',size:9,italic:true,color:'#647586'};
model.freezePanes.freezeRows(5);
assumptions.freezePanes.freezeRows(13);

// Verify selector and a later-year driver, then restore the delivered Base case.
assumptions.getRange('B3').values=[[1]];
wb.recalculate();
if (Math.abs(Number(model.getRange('D6').values[0][0])-8.64)>1e-8) throw new Error('Conservative selector did not recalculate');
assumptions.getRange('B3').values=[[3]];
wb.recalculate();
if (Math.abs(Number(model.getRange('D6').values[0][0])-59.136)>1e-8) throw new Error('Upside selector did not recalculate');
assumptions.getRange('G62').values=[[.40]];
wb.recalculate();
if (Math.abs(Number(model.getRange('G32').values[0][0])-7363.68)>1e-8) throw new Error(`Later-year remittance driver did not recalculate: ${model.getRange('G32').values[0][0]}`);
assumptions.getRange('G62').values=[[.42]];
assumptions.getRange('B3').values=[[2]];
wb.recalculate();
const checks = await wb.inspect({kind:'region',sheetId:'Model',range:'C4:G12',maxChars:3000});
console.log(checks.ndjson);
const errors = await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:100},maxChars:2000});
console.log(errors.ndjson);
for (const name of ['Model','Assumptions']) {
 const preview=await wb.render({sheetName:name,range:name==='Model'?'C2:G49':'A2:G63',scale:1.5,format:'png'});
 await fs.writeFile(`${outDir}/${name.toLowerCase()}_preview.png`,new Uint8Array(await preview.arrayBuffer()));
}
const file=await SpreadsheetFile.exportXlsx(wb);
await file.save(`${outDir}/Tazdan_Financial_Model.xlsx`);
console.log(`${outDir}/Tazdan_Financial_Model.xlsx`);
