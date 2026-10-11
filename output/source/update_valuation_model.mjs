import fs from 'node:fs/promises';
import {FileBlob, SpreadsheetFile} from '@oai/artifact-tool';

const dir='/Users/moe/Downloads/promrkts/outputs/tazdan-manifesto-20261006';
const filePath=`${dir}/Tazdan_Financial_Model.xlsx`;
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(filePath));
if(process.argv.includes('--rename-brand')) {
 const names=['Model','Assumptions','Valuation target'];
 const before=Object.fromEntries(names.map(name=>{
  const range=wb.worksheets.getItem(name).getUsedRange();
  return [name,{values:range.values,formulas:range.formulas}];
 }));
 for(const [name,cell] of [['Assumptions','A65'],['Valuation target','F16']]) {
  const range=wb.worksheets.getItem(name).getRange(cell);
  range.values=[[String(range.values[0][0]).replace('Tazdan Bible','Tazdan Manifesto')]];
 }
 wb.recalculate();
 for(const name of names) {
  const range=wb.worksheets.getItem(name).getUsedRange();
  const expected=before[name].values.map(row=>row.map(value=>typeof value==='string'?value.replace('Tazdan Bible','Tazdan Manifesto'):value));
  if(JSON.stringify(range.values)!==JSON.stringify(expected)||JSON.stringify(range.formulas)!==JSON.stringify(before[name].formulas)) throw Error(`Unrelated edits in ${name}`);
 }
 console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:100},maxChars:1500})).ndjson);
 for(const [sheetName,range,name] of [['Assumptions','A62:J66','manifesto_source_assumptions'],['Valuation target','F16:H21','manifesto_source_valuation']]) {
  const preview=await wb.render({sheetName,range,scale:1.5,format:'png'});
  await fs.writeFile(`${dir}/${name}.png`,new Uint8Array(await preview.arrayBuffer()));
 }
 await (await SpreadsheetFile.exportXlsx(wb)).save(filePath);
 console.log('Renamed two source references; all other values and formulas preserved.');
 process.exit(0);
}
const original={};
for(const name of ['Model','Assumptions']) {
 const s=wb.worksheets.getItem(name);
 original[name]={values:s.getUsedRange().values,formulas:s.getUsedRange().formulas};
}
let target;
try {target=wb.worksheets.getItem('Valuation target');}
catch {target=wb.worksheets.add('Valuation target');}
target.getRange('A1:H65').clear({applyTo:'all'});
target.showGridLines=false;
target.tabColor='#12304A';
target.getRange('C2').values=[['Path to USD 20-25m enterprise value']];
target.getRange('C3').values=[['Illustrative target, 6 October 2026. Separate operating model from the existing forecast.']];
target.getRange('C5:D5').values=[['Annual result (USD)','Value']];
const summary=[
 [6,'Revenue','=D38'],[7,'Contribution after variable costs','=D39'],
 [8,'Fixed operating expense','=D25'],[9,'EBITDA','=D40'],
 [10,'Enterprise value, lower multiple','=IF(D40>0,D40*D26,"n.a.")'],
 [11,'Enterprise value, upper multiple','=IF(D40>0,D40*D27,"n.a.")'],
 [12,'Recurring contribution / fixed cost','=IF(D25>0,D41/D25,"n.a.")'],
];
for(const [row,label,formula] of summary) {
 target.getRange(`C${row}`).values=[[label]];
 target.getRange(`D${row}`).formulas=[[formula]];
}
target.getRange('C14').values=[['Editable commercial assumptions']];
const inputs=[
 [16,'Institution software customers',10],
 [17,'Annual software fee per institution (USD)',120000],
 [18,'Software contribution margin',.80],
 [19,'Paying businesses',3000],
 [20,'Monthly business subscription (USD)',75],
 [21,'Subscription contribution margin',.70],
 [22,'Monthly payment volume (USD)',45000000],
 [23,'Payment fee revenue / volume',.009],
 [24,'Variable payment cost / volume',.0045],
 [25,'Annual fixed operating expense (USD)',2800000],
 [26,'Lower EBITDA multiple',8],
 [27,'Upper EBITDA multiple',10],
];
for(const [row,label,value] of inputs) target.getRange(`C${row}:D${row}`).values=[[label,value]];
target.getRange('F16').values=[['Source: Tazdan Manifesto valuation target, 6 October 2026.']];
target.getRange('F17').values=[['Proposed prices and sales targets; no signed customers verified.']];
target.getRange('F18').values=[['Payment revenue excludes customer principal and partner pass-through fees.']];
target.getRange('F19').values=[['Direct cost includes processing, payout, fraud, FX, support and funding.']];
target.getRange('F20').values=[['Fixed cost excludes variable costs already deducted above.']];
target.getRange('F21').values=[['Subscription cohorts may use payments; each fee and payment is counted once.']];
target.getRange('F23').values=[['Annual fixed-cost planning (USD)']];
target.getRange('F24:G28').values=[
 ['People',1400000],['Infrastructure and security',350000],
 ['Legal and compliance',350000],['Sales and marketing',400000],['Other overhead',300000],
];
target.getRange('F29').values=[['This breakdown supports the initial budget; D25 is the editable total.']];
target.getRange('C30').values=[['Calculation (USD)']];
const build=[
 [31,'Software revenue','=D16*D17'],
 [32,'Software contribution','=D31*D18'],
 [33,'Subscription revenue','=D19*D20*12'],
 [34,'Subscription contribution','=D33*D21'],
 [35,'Annual payment volume','=D22*12'],
 [36,'Payment fee revenue','=D35*D23'],
 [37,'Payment contribution','=D36-D35*D24'],
 [38,'Total revenue','=SUM(D31,D33,D36)'],
 [39,'Total contribution','=SUM(D32,D34,D37)'],
 [40,'EBITDA','=D39-D25'],
 [41,'Recurring software and subscription contribution','=SUM(D32,D34)'],
 [42,'Annual payment volume needed to break even','=IF(D41>=D25,0,IF(D23>D24,(D25-D41)/(D23-D24),"n.a."))'],
 [43,'Payment contribution margin','=IF(D36>0,D37/D36,"n.a.")'],
];
for(const [row,label,formula] of build) {
 target.getRange(`C${row}`).values=[[label]];
 target.getRange(`D${row}`).formulas=[[formula]];
}
target.getRange('C46').values=[['An 8-10x multiple is a negotiation assumption. EBITDA is not net income or free cash flow.']];
target.getRange('C47').values=[['Tax, capex, financing, required capital and prefunding need separate funded schedules.']];
target.getRange('C48').values=[['Original target coverage is 1.02x. Seek at least 1.25x recurring contribution before major hiring.']];
target.getRange('C49').values=[['With the original inputs, fees at 0.60% and costs at 0.45% reduce EBITDA to USD 860,000.']];
target.getRange('C50').values=[['Contracts carry default, renewal and FX risk. No profit guarantee is made.']];

target.getRange('A1:H50').format.font={name:'Arial',size:10,color:'#203446'};
target.getRange('A1:H50').format.rowHeight=22;
target.getRange('A:B').format.columnWidth=3;
target.getRange('C:C').format.columnWidth=55;
target.getRange('D:D').format.columnWidth=22;
target.getRange('E:E').format.columnWidth=3;
target.getRange('F:F').format.columnWidth=38;
target.getRange('G:G').format.columnWidth=19;
target.getRange('H:H').format.columnWidth=3;
target.getRange('C2').format.font={name:'Arial',size:15,bold:true,color:'#12304A'};
target.getRange('C3:H3').format.font={name:'Arial',size:9,italic:true,color:'#647586'};
for(const range of ['C5:D5','C14:D14','C30:D30']) {
 target.getRange(range).format.fill='#12304A';
 target.getRange(range).format.font={name:'Arial',size:10,bold:true,color:'#FFFFFF'};
}
target.getRange('D16:D27').format.fill='#FFF2C7';
target.getRange('D16:D27').format.font={name:'Arial',size:10,color:'#1353A4'};
target.getRange('D6:D11').setNumberFormat('"$"#,##0;("$"#,##0);"-"');
target.getRange('D12').setNumberFormat('0.00"x"');
target.getRange('D16').setNumberFormat('#,##0');
target.getRange('D17').setNumberFormat('"$"#,##0');
target.getRange('D18').setNumberFormat('0.0%');
target.getRange('D19').setNumberFormat('#,##0');
target.getRange('D20').setNumberFormat('"$"#,##0');
target.getRange('D21').setNumberFormat('0.0%');
target.getRange('D22').setNumberFormat('"$"#,##0');
target.getRange('D23:D24').setNumberFormat('0.00%');
target.getRange('D25').setNumberFormat('"$"#,##0');
target.getRange('D26:D27').setNumberFormat('0.0"x"');
target.getRange('D31:D42').setNumberFormat('"$"#,##0;("$"#,##0);"-"');
target.getRange('D43').setNumberFormat('0.0%');
target.getRange('G24:G28').setNumberFormat('"$"#,##0');
target.getRange('F16:H21').format.font={name:'Arial',size:9,italic:true,color:'#647586'};
target.getRange('F29:H29').format.font={name:'Arial',size:9,italic:true,color:'#647586'};
target.getRange('C46:H50').format.font={name:'Arial',size:9,italic:true,color:'#647586'};
for(const row of [9,10,11,38,39,40]) {
 target.getRange(`C${row}:D${row}`).format.font={name:'Arial',size:10,bold:true,color:'#12304A'};
 target.getRange(`C${row}:D${row}`).format.borders={bottom:{style:'thin',color:'#9DB5C5'}};
}
for(const row of [16,19]) target.getRange(`D${row}`).dataValidation={rule:{type:'whole',operator:'between',formula1:0,formula2:10000000}};

wb.recalculate();
if(Math.abs(Number(target.getRange('D9').values[0][0])-2480000)>1e-6) throw Error('Target EBITDA mismatch');
if(Math.abs(Number(target.getRange('D11').values[0][0])-24800000)>1e-6) throw Error('Valuation mismatch');
target.getRange('D23').values=[[.006]];
wb.recalculate();
if(Math.abs(Number(target.getRange('D9').values[0][0])-860000)>1e-6) throw Error('Fee stress did not recalculate');
target.getRange('D23').values=[[.009]];
target.getRange('D22').values=[[0]];
wb.recalculate();
if(Math.abs(Number(target.getRange('D9').values[0][0])-50000)>1e-6) throw Error('Zero payment-volume test failed');
target.getRange('D22').values=[[45000000]];
wb.recalculate();
for(const name of ['Model','Assumptions']) {
 const s=wb.worksheets.getItem(name);
 if(JSON.stringify(s.getUsedRange().values)!==JSON.stringify(original[name].values) || JSON.stringify(s.getUsedRange().formulas)!==JSON.stringify(original[name].formulas)) throw Error(`Unrelated edits in ${name}`);
}
console.log((await wb.inspect({kind:'region',sheetId:'Valuation target',range:'C5:D12',maxChars:2000})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:100},maxChars:2000})).ndjson);
const preview=await wb.render({sheetName:'Valuation target',range:'C2:H50',scale:1.5,format:'png'});
await fs.writeFile(`${dir}/valuation_target_preview.png`,new Uint8Array(await preview.arrayBuffer()));
await (await SpreadsheetFile.exportXlsx(wb)).save(filePath);
console.log(filePath);
