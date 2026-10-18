import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {launch,bootSignedIn,nav,sleep,setStore} from '../../client/scripts/app-media/harness.mjs';

const base=path.dirname(new URL(import.meta.url).pathname);
const out=path.join(base,'capture'); await fs.mkdir(out,{recursive:true});
const scenes=[
 ['wallet','/wallet','Wallets','Fiat and crypto balance views'],
 ['sell','/sell','Sell interface','Simulated quote. Real-money crypto execution disabled'],
 ['exchange','/exchange','Currency conversion','Simulated pricing. Lawful FX access required'],
 ['portfolio','/portfolio/crypto','Portfolio','Asset holdings and allocation views'],
 ['receive','/receive','Receive and QR','Payment identifiers and receiving interface'],
 ['withdraw','/withdraw','Withdrawals','Bank and crypto withdrawal interface. Activation pending'],
 ['history','/history','Activity history','Payment records and transaction details'],
 ['statements','/statements','Statements','Statement selection and export interface'],
 ['recurring','/recurring','Recurring purchases','Scheduling interface. Execution currently disabled'],
 ['linked','/linked-accounts','Linked accounts','Bank and card linking interface. Partners pending'],
 ['kyc','/kyc','Identity verification','KYC interface with a fictional verified profile'],
 ['devices','/settings/devices','Trusted devices','Session visibility and device controls'],
 ['twofa','/settings/2fa','Two-factor authentication','Authenticator configuration interface'],
 ['referral','/referral','Referrals','Referral interface. Rewards shown are fictional'],
 ['claim','/claim/demo-token','Claim links','Fictional payment claim interface'],
 ['business-team','/business/team','Business team','Team membership and role interfaces'],
 ['business-keys','/business/api-keys','Business API','Scoped keys and webhook configuration interface'],
 ['business-bulk','/business/bulk-pay','Bulk payments','Batch preparation for internal recipients'],
 ['business-payouts','/business/invoices','Payout approvals','Batch status and approval interface'],
 ['notifications','/notifications','Notifications','Customer alerts and notification centre'],
 ['guide','/guide','Product guide','In-app guidance and capability navigation'],
 ['admin','/admin','Staff administration','Simulated administration. No production access'],
];
const results=[];
const {browser,page,cdp,errors,unmatched,world}=await launch({locale:'en',theme:'dark',dsf:2});
try {
 await bootSignedIn(page); await setStore(page,'authStore',{biometricEnabled:true});
 await page.screenshot({path:path.join(out,'signed-in.png')});
 for (const [id,route,title,status] of scenes) {
  const dir=path.join(out,id); await fs.mkdir(dir,{recursive:true});
  try {
   await nav(page,'/profile',250); await nav(page,route,1400); await page.evaluate(()=>document.fonts.ready);
   const body=await page.locator('body').innerText();
   if(/Unmatched Route|This screen does not exist|Something went wrong/.test(body))throw Error('Unavailable route: '+body.slice(0,200));
   await page.screenshot({path:path.join(dir,'poster.png')});
   await cdp.send('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:2,mobile:true});
   const frames=[]; const start=Date.now();
   const anim=page.evaluate(()=>{const el=[...document.querySelectorAll('*')].filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return r.height>150&&r.width>200&&e.scrollHeight>e.clientHeight+30&&/(auto|scroll)/.test(s.overflowY)}).sort((a,b)=>b.clientHeight-a.clientHeight)[0]; if(!el)return; const max=Math.min(340,el.scrollHeight-el.clientHeight); const st=performance.now(); function tick(n){const t=Math.min(1,(n-st)/3200),p=t<.5?2*t:2-2*t;el.scrollTop=max*(p*p*(3-2*p));if(t<1)requestAnimationFrame(tick)} requestAnimationFrame(tick)});
   while(Date.now()-start<4400){const t=Date.now();const r=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:87,fromSurface:true,captureBeyondViewport:false});const file=path.join(dir,String(frames.length).padStart(4,'0')+'.jpg');await fs.writeFile(file,Buffer.from(r.data,'base64'));frames.push({file,t});await sleep(Math.max(0,90-(Date.now()-t)));}
   await anim; const end=Date.now();
   await fs.writeFile(path.join(dir,'frames.txt'),frames.map((f,i)=>`file '${f.file}'\nduration ${((i+1<frames.length?frames[i+1].t:end)-f.t)/1000}\n`).join('')+`file '${frames.at(-1).file}'\n`);
   execFileSync('/opt/homebrew/bin/ffmpeg',['-loglevel','error','-y','-f','concat','-safe','0','-i',path.join(dir,'frames.txt'),'-vf','fps=30,scale=720:1560:flags=lanczos,format=yuv420p','-c:v','libx264','-preset','fast','-crf','21','-movflags','+faststart','-an',path.join(dir,'clip.mp4')]);
   for(const f of frames)await fs.unlink(f.file); await fs.unlink(path.join(dir,'frames.txt'));
   results.push({id,route,title,status,success:true,seconds:(end-start)/1000,body:body.slice(0,1000)});
  }catch(e){results.push({id,route,title,status,success:false,error:String(e)});}
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify({results,errors,unmatched:[...unmatched]},null,2));
  console.log(JSON.stringify(results.at(-1)));
 }
}finally{await browser.close();}
