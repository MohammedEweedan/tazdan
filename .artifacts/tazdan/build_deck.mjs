import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile } from '@oai/artifact-tool';
import { resolvePresentationFont, finalizePresentation } from '/Users/moe/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations/container_tools/artifact_tool_utils.mjs';
const root='/Users/moe/Downloads/promrkts';
const tmp=path.join(root,'.artifacts/tazdan');
const skill='/Users/moe/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations';
const model=JSON.parse(await fs.readFile(path.join(tmp,'model.json'),'utf8'));
const family=resolvePresentationFont({fontFamily:'Arial'});
const p=Presentation.create({slideSize:{width:1280,height:720}});
const C={bg:'#16181C',white:'#F5F6F8',blue:'#63A1DB',muted:'#AEB9C7',ink:'#192737',light:'#F7F9FC'};
function slide(title,light=false,sub=''){
 const s=p.slides.add();s.background.fill=light?C.light:C.bg;s._light=light;
 if(title) text(s,title,68,55,1144,90,46,light?C.ink:C.white,true);
 if(sub) text(s,sub,70,150,1135,65,22,light?'#586879':C.muted);
 text(s,'tazdan',70,672,250,24,16,C.blue,true);text(s,String(p.slides.items.length).padStart(2,'0'),1170,672,45,24,15,C.blue);
 return s;
}
function text(s,content,x,y,w,h,size=26,color=C.white,bold=false){
 const box=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});box.text=content;box.text.style={typeface:family,fontSize:size,color,bold,autoFit:'none'};return box;
}
function note(s,content){s.speakerNotes.textFrame.setText(content);}
function row(s,label,body,y,light=false){text(s,label,70,y,305,70,25,light?C.ink:C.blue,true);text(s,body,405,y,800,80,25,light?'#4B5B6C':C.white);}
function table(s,values,y=235,widths=[550,190,190,190],font=23){
 const t=s.tables.add({rows:values.length,columns:values[0].length,left:70,top:y,width:1140,height:values.length*54,columnWidths:widths,values});
 const all=t.cells.block({row:0,column:0,rowCount:values.length,columnCount:values[0].length});
 all.assign({fill:s._light?'#FFFFFF':'#20252D',textStyle:{typeface:family,fontSize:font,color:s._light?C.ink:C.white},margins:{left:14,right:14,top:12,bottom:12}});
 t.cells.block({row:0,column:0,rowCount:1,columnCount:values[0].length}).assign({fill:s._light?'#E4EDF6':'#293749',textStyle:{typeface:family,fontSize:font,bold:true,color:s._light?C.ink:C.blue}});
 t.borders.assign({fill:s._light?'#D8E1EA':'#35404C',width:.6});return t;
}
const sources=model.sources.map(s=>`${s[0]}: ${s[1]}\n${s[2]}\n${s[3]}`).join('\n\n');
let s=slide('');
const logo=await fs.readFile(path.join(root,'client/public/text-logo-color.png'));
s.images.add({blob:logo,contentType:'image/png',alt:'Original tazdan wordmark',fit:'contain',position:{left:70,top:65,width:305,height:95}});
text(s,'Libya. Crypto.\nConnected.',70,230,1090,205,72,C.white,true);
text(s,'Arab roots. Digital assets. International remittances. One connected money experience.',74,477,960,85,29,C.muted);
text(s,'Investment proposal  /  September 2026  /  Prelaunch',74,607,1050,35,19,C.blue);
note(s,'Concept-stage investment proposal. No existing licence, partner commitment, live payment service or customer traction is asserted. All financial amounts are LYD.');

s=slide('The everyday payment problem',false,'A product hypothesis to validate with Libyan consumers and merchants');
row(s,'For consumers','Daily spending, family payments and savings goals should be easy to follow in one app.',255);
row(s,'For merchants','Getting paid is only part of the job. Clear settlement and useful sales records matter too.',395);
text(s,'First research gate: 100 consumer interviews and 30 merchant interviews.',70,570,1100,60,24,C.blue);
note(s,'Customer pain points are hypotheses, not findings from completed research. Commission interviews before product scope and pricing are final.');

s=slide('Libya already has digital payment rails',true,'Historical CBL indicators through November 2025');
text(s,'328.0bn',70,250,650,120,95,C.ink,true);text(s,'LYD electronic payment value\nJanuary–November 2025',76,385,640,100,29,'#566778');
text(s,'150,019',815,262,370,75,53,C.blue,true);text(s,'point of sale terminals',818,348,380,40,23,C.ink);
text(s,'183,435',815,450,370,75,53,C.blue,true);text(s,'electronic wallets',818,536,380,40,23,C.ink);
text(s,'These are different measures, not an additive market size or unique-user count.',70,613,1110,35,19,'#647283');
note(s,`Source S3, page 6. Historical national payments data, not current tazdan metrics. ${model.sources[2][2]}\nNo conversion from national transaction value to tazdan revenue is assumed.`);

s=slide('Dinars and crypto, side by side',false,'An Arabic and English experience built around life in Libya');
text(s,'Pay locally',70,270,550,50,34,C.blue,true);text(s,'A wallet in LYD, clear receipts and payments to people and merchants.',70,330,585,95,28);
text(s,'Connect beyond borders',70,465,580,50,34,C.blue,true);text(s,'Supported crypto, family remittances and everyday money in one familiar app.',70,525,595,90,28);
s.images.add({blob:await fs.readFile(path.join(root,'client/public/screenshots/tazdan/IMG_2134.PNG')),contentType:'image/png',alt:'Original tazdan app concept screenshot',fit:'contain',position:{left:850,top:195,width:235,height:430}});
text(s,'Existing concept screen; legacy balances are illustrative.',775,632,430,28,14,C.muted);
note(s,'Original user-provided repository screenshot, kept unchanged. Legacy currencies and crypto UI are concept content, not live services or pricing. Domestic LYD payments form the financial base case; crypto and remittance access require separate approvals.');

s=slide('One vision, gated delivery',true);
row(s,'Domestic pilot','Verified users, LYD wallet, merchant payments, receipts and customer support.',235,true);
row(s,'Domestic expansion','Merchant links or QR, savings pockets and better reporting after pilot acceptance.',365,true);
row(s,'Crypto and remittance','Supported digital assets and international transfers after legal, provider and corridor approval.',495,true);
note(s,`Proposed phases. Domestic authority does not imply permission for international services. Sources S1, S4 and S5.\n${sources}`);

s=slide('Distribution begins with local use',false,'Tripoli and Benghazi are proposed pilot markets');
row(s,'Merchant clusters','Start with neighbourhood retail and food businesses. Train merchants and prove settlement.',240);
row(s,'Everyday customers','Reach verified consumers through employers, communities and merchant referrals.',365);
row(s,'Evidence before scale','Pilot target: 1,000–2,000 active consumers and 50–100 active merchants.',490);
note(s,'All geographic choices and pilot targets are planning assumptions. The 1.50m LYD marketing budget cannot independently acquire the full growth target. Partner distribution and organic retention must be validated.');

s=slide('Simple proposed pricing in LYD',true,'Subscriptions are separate from processing and other service fees');
table(s,[['Plan','Monthly LYD','Customer purpose'],['Everyday','0','Local wallet and spending insights'],['Plus','15','Saving pockets and priority support'],['Business','49','Merchant requests and reporting']],245,[250,230,660],24);
text(s,'Proposed launch prices. Final fees, eligibility and limits require confirmation.',70,550,1130,60,23,'#586879');
note(s,'These prices match the landing-site fees page and feasibility study. Consumer Plus subscription is 15 LYD monthly, merchant subscription 49 LYD monthly. Signup is free. No live tariff or pricing approval is asserted.');

s=slide('The regulated route is the first gate',false,'A bank or licensed payment partner is necessary to investigate, not sufficient by itself');
row(s,'Before customer funds','Confirm authorisation scope, safeguarding, settlement accounts and customer terms.',250);
row(s,'Before public launch','Approve identity checks, monitoring, complaints and independent security assurance.',380);
row(s,'Before international access','Confirm issuer eligibility, FX permissions and each supported corridor.',510);
note(s,`Public CBL rules do not determine tazdan's exact licence, fees or capital requirement. Obtain a current local legal opinion and written regulator/partner clarification. Sources S1, S4, S5.\n${sources}`);

s=slide('24 months of deliberately cautious costs',true,'Fixed spending budget, million LYD. Planning estimates, not vendor quotes.');
table(s,[['Workstream','Million LYD'],['Engineering and product','3.60'],['Operations and compliance personnel','4.80'],['Legal, security and partner setup','3.30'],['Cloud, growth and administration','3.30'],['Total fixed spending','15.00']],228,[880,260],23);
note(s,'Legal/licensing work 1.50 + security assurance 0.90 + partner setup 0.90 = 3.30. Cloud 1.20 + acquisition 1.50 + office/admin 0.60 = 3.30. Fixed budget Years 1 and 2: 8.40 + 6.60 = 15.00m. Separate engineering from operational payroll.');

s=slide('A 30 million LYD funding envelope',false,'Contingency and restricted funds remain visible');
table(s,[['Funding use','Million LYD'],['24 month fixed spending','15.00'],['35% cost contingency','5.25'],['Provisional regulatory capital','5.00'],['Settlement or partner collateral','2.00'],['Additional unrestricted liquidity','2.75'],['Total proposed funding','30.00']],218,[880,260],22);
note(s,'Capital and collateral are balance-sheet provisions, not operating expenses. The 5.00m is not a verified statutory minimum and the licensing-work allowance is not an official fee. Funding target reconciles exactly. Customer balances are excluded from company funding.');

s=slide('Operating profitability needs scale',true,'Central scenario. All figures are assumptions, in million LYD unless stated.');
table(s,[['Annual measure','Year 1','Year 2','Year 3'],['Average active consumers','10,000','45,000','120,000'],['Revenue','0.730','4.709','17.310'],['Variable service costs','0.420','2.202','6.780'],['Fixed spending','8.400','6.600','8.400'],['Operating result','−8.090','−4.093','+2.130']],228,[540,200,200,200],23);
text(s,'Before tax, financing and contingency drawdowns. International revenue excluded.',70,628,1120,32,18,'#637082');
note(s,'Annual average customers, not year-end totals. Y1/2/3: Plus share 10/15/20%; paying merchants 200/800/2500; eligible monthly user spend 600/800/1000 LYD; gross take .6/.7/.8%; processing and loss cost .3%; user service 1.5 LYD monthly and merchant service 10 LYD monthly. Fixed spend first 24m totals15m. Y1 requires a faster approved ramp than a late pilot. Full formulas and caveats in feasibility study.');

s=slide('The economics need proof in the pilot',false);
text(s,'6.50 LYD',70,230,680,110,79,C.blue,true);text(s,'Monthly contribution per active consumer\nat mature Year 3 assumptions',75,350,680,90,28,C.white);
text(s,'92,693',850,245,355,95,62,C.white,true);text(s,'Average active consumers\nneeded for operating\nbreak-even',850,360,365,130,26,C.muted);
text(s,'Assumes 2,500 merchants and 700,000 LYD monthly fixed spending.',70,553,1110,65,25,C.muted);
note(s,'Consumer contribution = 1000*.008 + .20*15 -1000*.003 -1.5 =6.5 LYD monthly. Merchant margin49-10=39 LYD. Break-even=(700000-2500*39)/6.5=92692.3077, round up92693. No customer acquisition, churn or tax is embedded in the contribution number. Illustrative CAC40 LYD gives6.15 month simple mature payback.');

s=slide('Room for delays, but no blank cheque',true);
row(s,'Cost shock','Six-month delay: 3.75m LYD. FX/vendor shock: 1.50m LYD. Together they consume the 5.25m contingency.',235,true);
row(s,'Demand downside','At 60,000 average active users and weaker monetisation, Year 3 loses 6.951m LYD.',380,true);
row(s,'Settlement risk','Two days of full prefunding at Year 3 volume would need about 7.89m LYD. Resize the initial reserve.',525,true);
note(s,'Delay .625m monthly average fixed burn*6=3.75m. FX/vendor25% shock*40% imported share*15m fixed cost=1.5m. Downside:60k consumers,1250 merchants,600LYD monthly spend,.6%gross take,.4%processing/loss,10%paid share,8.4m fixed spending. Revenue4.407m,variable2.958m,result-6.951m. Settlement1.44bn/365*2=7.89m. No exchange rate quote assumed.');

s=slide('Crypto and remittance expansion',false,'Optional budget outside the domestic 30 million LYD base case');
text(s,'4.05m LYD',70,240,650,100,72,C.blue,true);
text(s,'3.00m setup and specialist operations\n+ 35% contingency',75,360,650,90,28,C.white);
text(s,'34.05m LYD',850,265,355,75,39,C.white,true);
text(s,'Combined planning envelope\nExtra foreign capital and\nliquidity still unpriced',850,365,365,120,24,C.muted);
text(s,'Custody, transaction screening, corridor counsel, security and payout integrations.',70,535,1120,70,26,C.muted);
text(s,'Launch only where current law and contracted providers permit.',70,620,1110,35,22,C.blue);
note(s,'Optional provision: custody/wallet setup0.45m, analytics/Travel Rule0.60m, corridor legal/diligence0.75m, security0.60m, payout integrations0.60m =3.00m plus35%=4.05m. These are estimates, not quotes. 5000 monthly transfers of1000LYD at1.5%fee, .9%provider cost and2LYD per-transfer cost yield20000LYD monthly contribution before fixed costs, insufficient alone to justify expansion. Current Libyan crypto permission is unverified; no foreign licence alone authorises domestic service. Sources S7-S9 and feasibility study.\n'+sources);

s=slide('Funding follows evidence',false,'Proposed investment releases within the 30 million LYD envelope');
row(s,'5m LYD','Discovery, local counsel, partner procurement and early engineering.',240);
row(s,'10m LYD','After a viable authorisation route, costed partners and an approved technical design.',365);
row(s,'15m LYD','After security acceptance, pilot permission and confirmed capital requirements.',490);
text(s,'30m LYD base envelope + 4.05m LYD optional crypto/remittance budget.',70,617,1110,38,25,C.blue);
note(s,'Tranches are proposed, not financing commitments. Do not accept customer funds before the approved scope and safeguarding requirements are met. No founder credentials or claimed traction are invented. Evidence references and complete model appear in the accompanying feasibility study.\n'+sources);

await fs.mkdir(path.join(tmp,'deck-render'),{recursive:true});
const candidate=path.join(tmp,'candidate.pptx');await(await PresentationFile.exportPptx(p)).save(candidate);
for(let i=0;i<p.slides.items.length;i++){
 const blob=await p.export({slide:p.slides.items[i],format:'png',scale:1});await fs.writeFile(path.join(tmp,'deck-render',`slide-${i+1}.png`),new Uint8Array(await blob.arrayBuffer()));
}
const result=await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:path.join(root,'deliverables/tazdan-pitch-deck.pptx'),pythonExecutable:'/Users/moe/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit',...[7,9,10,11].flatMap(n=>['--require-native-table-slide',String(n)])],requiredNativeTableOwnerSlides:[7,9,10,11],fontPolicy:{basis:'design',families:[family]},verifyArtifactToolImport:true,receiptPath:path.join(tmp,'deck-validation.json')});console.log(result);
