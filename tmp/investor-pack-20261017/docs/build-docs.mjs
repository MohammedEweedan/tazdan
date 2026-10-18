// Renders the investor-pack PDFs. Usage: node build-docs.mjs [docKey ...] [--qa]
import path from 'node:path';
import fs from 'node:fs/promises';
import { PACK, WORK, page, renderPdf, pdfToPngs, browser } from './lib.mjs';

const docs = {
  start: { mod: './d00_start.mjs', out: '00_START_HERE.pdf', title: 'Start here' },
  memo: { mod: './d01_memo.mjs', out: '01_Overview/Tazdan_Investor_Memorandum.pdf', title: 'Investor memorandum' },
  deck: { mod: './d01_deck.mjs', out: '01_Overview/Tazdan_Investor_Presentation.pdf', title: 'Investor presentation', footer: false },
  corp: { mod: './d02_corporate.mjs', out: '02_Corporate_and_Remittances/Tazdan_Corporate_Structure_and_Governance.pdf', title: 'Corporate structure and governance' },
  rev: { mod: './d03_revenue.mjs', out: '03_Revenue_and_Pricing/Tazdan_Revenue_Models_and_Pricing.pdf', title: 'Revenue models and pricing' },
  fin: { mod: './d04_financials.mjs', out: '04_Financial_Model/Tazdan_Financial_Model_Summary.pdf', title: 'Financial model summary' },
  growth: { mod: './d05_growth.mjs', out: '05_Growth_Playbook/Tazdan_Guerrilla_Growth_Playbook.pdf', title: 'Guerrilla growth playbook' },
  index: { mod: './d06_index.mjs', out: '06_Product_Demo/Tazdan_Feature_Coverage_Index.pdf', title: 'Feature coverage index' },
  launch: { mod: './d07_launch.mjs', out: '07_Launch_and_Diligence/Tazdan_Launch_Roadmap_and_Risk_Register.pdf', title: 'Launch roadmap and risk register' },
  evidence: { mod: './d08_evidence.mjs', out: '08_Evidence_and_Sources/Tazdan_Evidence_and_Sources.pdf', title: 'Evidence and sources' },
};

const args = process.argv.slice(2), qa = args.includes('--qa');
const keys = args.filter(a => !a.startsWith('--')); const run = keys.length ? keys : Object.keys(docs);
for (const k of run) {
  const d = docs[k]; const m = await import(d.mod + '?t=' + Date.now());
  const body = await m.default(); const html = page(d.title, body, m.css || '');
  const out = path.join(PACK, d.out);
  await renderPdf(k, html, out, { footer: d.footer !== false, title: d.title });
  let n = '';
  if (qa) { await fs.mkdir(path.join(WORK, 'qa/docs'), { recursive: true }); const r = await pdfToPngs(out, path.join(WORK, 'qa/docs', k), { width: d.footer === false ? 1400 : 1100 }); n = r.numPages + ' pages'; }
  console.log('✓', k, d.out, n);
}
await (await browser()).close();
