import fs from 'node:fs/promises';
import path from 'node:path';
import {launch,bootSignedIn,nav,sleep,setStore} from '../../client/scripts/app-media/harness.mjs';
const base=path.dirname(new URL(import.meta.url).pathname);
const out=path.join(base,'capture-admin-test'); await fs.mkdir(out,{recursive:true});
const {browser,page,unmatched}=await launch({locale:'en',theme:'dark',dsf:2});
try{
 await bootSignedIn(page);
 await page.evaluate(()=>{const m=window.__capFind(/src\/store\/authStore\.ts$/);const hook=m&&Object.values(m).find(v=>typeof v==='function'&&typeof v.setState==='function');const s=hook.getState();hook.setState({user:{...s.user,role:'ADMIN'}});});
 for(const r of ['/admin','/admin/rates','/admin/kyc','/admin/withdrawals','/admin/fees']){await nav(page,'/profile',300);await nav(page,r,1800);await page.screenshot({path:path.join(out,r.replace(/\//g,'_')+'.png')});console.log(r,(await page.locator('body').innerText()).slice(0,300).replace(/\n+/g,' | '));}
 console.log('unmatched',[...unmatched].slice(0,30));
}finally{await browser.close();}
