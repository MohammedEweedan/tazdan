// Renders the Arabic investor-pack PDFs. Usage: node ar/build-ar.mjs [docKey ...] [--qa]
import path from 'node:path';
import fs from 'node:fs/promises';
import { PACK_AR, WORK, renderPdf, pdfToPngs, browser } from '../lib.mjs';
import { pageAr } from './lib_ar.mjs';

const docs = {
  memo: { mod: './a01_memo.mjs', out: '01_Overview/Tazdan_Investor_Memorandum_AR.pdf', title: 'مذكرة المستثمر' },
  deck: { mod: './a01_deck.mjs', out: '01_Overview/Tazdan_Investor_Presentation_AR.pdf', title: 'العرض التقديمي للمستثمرين', footer: false },
  corp: { mod: './a02_corporate.mjs', out: '02_Corporate_and_Remittances/Tazdan_Corporate_Structure_and_Governance_AR.pdf', title: 'الهيكل المؤسسي والحوكمة' },
  rev: { mod: './a03_revenue.mjs', out: '03_Revenue_and_Pricing/Tazdan_Revenue_Models_and_Pricing_AR.pdf', title: 'نماذج الإيرادات والتسعير' },
  fin: { mod: './a04_financials.mjs', out: '04_Financial_Model/Tazdan_Financial_Model_Summary_AR.pdf', title: 'ملخص النموذج المالي' },
  growth: { mod: './a05_growth.mjs', out: '05_Growth_Playbook/Tazdan_Growth_Playbook_AR.pdf', title: 'دليل النمو الميداني' },
  index: { mod: './a06_index.mjs', out: '06_Product_Demo/Tazdan_Feature_Coverage_Index_AR.pdf', title: 'فهرس الميزات' },
  launch: { mod: './a07_launch.mjs', out: '07_Launch_and_Diligence/Tazdan_Launch_Roadmap_and_Risk_Register_AR.pdf', title: 'خارطة الإطلاق وسجل المخاطر' },
  evidence: { mod: './a08_evidence.mjs', out: '08_Evidence_and_Sources/Tazdan_Evidence_and_Sources_AR.pdf', title: 'الأدلة والمصادر' },
  start: { mod: './a00_start.mjs', out: '00_START_HERE_AR.pdf', title: 'ابدأ من هنا' },
};

const args = process.argv.slice(2), qa = args.includes('--qa');
const keys = args.filter(a => !a.startsWith('--')); const run = keys.length ? keys : Object.keys(docs);
for (const k of run) {
  const d = docs[k]; const m = await import(d.mod + '?t=' + Date.now());
  const body = await m.default(); const html = pageAr(d.title, body, m.css || '');
  const out = path.join(PACK_AR, d.out);
  await renderPdf('ar-' + k, html, out, { footer: d.footer !== false, title: d.title, stamp: false, brand: 'تزدان' });
  let n = '';
  if (qa) { await fs.mkdir(path.join(WORK, 'qa/docs-ar'), { recursive: true }); const r = await pdfToPngs(out, path.join(WORK, 'qa/docs-ar', k), { width: d.footer === false ? 1400 : 1100 }); n = r.numPages + ' pages'; }
  console.log('✓', k, d.out, n);
}
await (await browser()).close();
