import fs from 'node:fs/promises';
import path from 'node:path';
import { cover, chip, usdM, int, PACK, WORK } from './lib.mjs';
import { cases, deal, platform, features, statusCounts } from './data.mjs';

const B = cases.Base, G = cases.Growth;
async function pages(rel) {
  const { PDFDocument } = await import(path.join(WORK, 'node_modules/pdf-lib/cjs/index.js')).then(m => m.default || m);
  try { return (await PDFDocument.load(await fs.readFile(path.join(PACK, rel)))).getPageCount() + ' pages'; } catch { return 'PDF'; }
}
const mb = async rel => { try { return ((await fs.stat(path.join(PACK, rel))).size / 1e6).toFixed(1) + ' MB'; } catch { return ''; } };

export default async () => {
  const rows = [
    ['01_Overview', 'Tazdan_Investor_Presentation.pdf', 'Fifteen slides: problem, product, model, numbers, structure, plan and the proposal', await pages('01_Overview/Tazdan_Investor_Presentation.pdf')],
    ['', 'Tazdan_Investor_Memorandum.pdf', 'The full story in prose: market, product, business model, go-to-market, financials, transaction, readiness', await pages('01_Overview/Tazdan_Investor_Memorandum.pdf')],
    ['02_Corporate_and_Remittances', 'Tazdan_Corporate_Structure_and_Governance.pdf', 'Group structure, entity roles, intercompany agreements, money flows and netting, governance, cap table', await pages('02_Corporate_and_Remittances/Tazdan_Corporate_Structure_and_Governance.pdf')],
    ['03_Revenue_and_Pricing', 'Tazdan_Revenue_Models_and_Pricing.pdf', 'Revenue streams, launch fee schedule, the FX engine and rate margins, a worked transfer, unit economics, software pricing', await pages('03_Revenue_and_Pricing/Tazdan_Revenue_Models_and_Pricing.pdf')],
    ['04_Financial_Model', 'Tazdan_Integrated_Financial_Model.xlsx', 'Live 60-month model, three cases, ten sheets including fee calculator and rate margins', 'Excel'],
    ['', 'Tazdan_Financial_Model_Summary.pdf', 'Results, cash and capital, assumptions and how to use the workbook', await pages('04_Financial_Model/Tazdan_Financial_Model_Summary.pdf')],
    ['05_Growth_Playbook', 'Tazdan_Guerrilla_Growth_Playbook.pdf', 'Sixteen street, shop, phone and moment plays; guardrails; budget; 90-day launch calendar', await pages('05_Growth_Playbook/Tazdan_Guerrilla_Growth_Playbook.pdf')],
    ['06_Product_Demo', 'Tazdan_Product_Demo.mp4', `Product walkthrough video: ${features.length} features, captioned, silent`, await mb('06_Product_Demo/Tazdan_Product_Demo.mp4')],
    ['', 'Tazdan_Feature_Coverage_Index.pdf', 'Timestamps, statuses and stills for every feature in the video', await pages('06_Product_Demo/Tazdan_Feature_Coverage_Index.pdf')],
    ['07_Launch_and_Diligence', 'Tazdan_Launch_Roadmap_and_Risk_Register.pdf', 'Readiness today, nine release gates, roadmap after funding, risk register, diligence index', await pages('07_Launch_and_Diligence/Tazdan_Launch_Roadmap_and_Risk_Register.pdf')],
    ['08_Evidence_and_Sources', 'Tazdan_Evidence_and_Sources.pdf', 'CBL figures, engineering validation, platform measurements and every source cited', await pages('08_Evidence_and_Sources/Tazdan_Evidence_and_Sources.pdf')],
  ];
  return `
${cover({ eyebrow: 'Start here', title: 'Tazdan<br>investor pack', sub: 'Everything a prospective investor needs to evaluate Tazdan: the business, the numbers, the plan, the product in motion and the evidence behind it.', docNo: 'Contents and guide' })}

<div class="eyebrow">Contents</div>
<h1 class="h">What is in this pack</h1>
<table>
<tr><th style="width:24%">Folder</th><th style="width:33%">File</th><th>What it is</th><th class="n" style="width:10%">Size</th></tr>
${rows.map(([f, n, d, s]) => `<tr><td>${f ? `<b>${f.replace(/_/g, ' ')}</b>` : ''}</td><td>${n}</td><td>${d}</td><td class="n">${s}</td></tr>`).join('')}
</table>
<div class="section"></div>
<div class="eyebrow">Key facts</div>
<h1 class="h">The pack on one page</h1>
<div class="kpis">
<div class="kpi"><div class="v">${usdM(deal.total, 0)}</div><div class="l">Proposed investment for 40%: ${usdM(deal.primary, 0)} new capital, ${usdM(deal.secondary, 0)} founder shares</div></div>
<div class="kpi"><div class="v">${usdM(deal.post, 0)}</div><div class="l">Implied post-money equity value</div></div>
<div class="kpi"><div class="v">${usdM(B.years[4].revenue)}</div><div class="l">Base-case revenue in year 5 (growth case ${usdM(G.years[4].revenue)})</div></div>
<div class="kpi"><div class="v">${platform.tests}</div><div class="l">Server tests passing; ${platform.screens} mobile screens; ${platform.cockpitPages}-page Control Cockpit</div></div>
</div>
<h2>How to read it</h2>
<div class="grid3">
<div class="card"><h3>In 15 minutes</h3><p>Watch the demo video, then read the investor presentation.</p></div>
<div class="card"><h3>In an hour</h3><p>Add the memorandum and the financial model summary.</p></div>
<div class="card"><h3>For diligence</h3><p>Work through the Excel model, then the corporate, revenue, growth, launch and evidence documents.</p></div>
</div>
<h2>Status labels used throughout</h2>
<table>
<tr><td style="width:24%">${chip('ready', 'Built')}</td><td>Works end to end in the codebase and needs no outside activation (${statusCounts.ready} of the ${features.length} features in the video).</td></tr>
<tr><td>${chip('partner', 'Awaits partner')}</td><td>Complete, but needs a bank, a licence or a payout partner before real customers can use it (${statusCounts.partner} features).</td></tr>
<tr><td>${chip('off', 'Off in production')}</td><td>Built, but the platform refuses it in production until its conditions are met (${statusCounts.off} features).</td></tr>
<tr><td>${chip('plan', 'Planned')}</td><td>Work outside the code: licences, partner contracts, independent testing.</td></tr>
</table>
<h2>Where things stand, in one paragraph</h2>
<p>Tazdan's software is built and tested against a real database. It has not yet served a real customer. The investment funds the steps between the two: a licence route or authorised partner, a partner bank with safeguarded accounts, payout partners, independent security testing, an opening reconciliation, and the team to run it. Nothing goes live until nine release gates are signed, and the software enforces this.</p>
<h2>Important notice</h2>
<p class="note">This pack is confidential and was prepared by the founder of Tazdan for prospective investors. It is not an offer to sell, or a solicitation of an offer to buy, any securities. Forecasts, prices and timetables are planning estimates based on stated assumptions; they are not promises, and actual results may differ materially. No licence, banking relationship, payout partner, customer contract or revenue is represented as existing unless stated. The proposed terms are the founder's opening proposal, non-binding and subject to diligence, documentation, and review of the investing parties and their funds by the receiving bank. The product video uses a fictional customer and data. Please do not forward this pack without the founder's consent.</p>
`;
};
