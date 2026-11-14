import { usd, usdM, int, pct, chip, groupedBars, lines, legend, C, LOGO_WHITE, LOGO_NAVY, esc } from './lib.mjs';
import { cases, cbl, deal, platform, features, statusCounts, fee, cumLoss } from './data.mjs';
import { groupSvg } from './d02_corporate.mjs';
import { mmSvg } from './d03_revenue.mjs';

const D = cases.Downside, B = cases.Base, G = cases.Growth;
const still = id => 'file://' + features.find(f => f.id === id).still;
const yrs = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'];
const caseLeg = legend([['Downside', C.s2], ['Base', C.s1], ['Growth', C.s3]]);

export const css = `
@page{size:338.67mm 190.5mm;margin:0}
body{font-size:12pt}
.s{width:338.67mm;height:190.5mm;position:relative;overflow:hidden;padding:15mm 20mm 16mm;page-break-after:always;display:flex;flex-direction:column;background:#fff}
.s.dark{background:linear-gradient(150deg,#0F1B29 0%,#16283B 50%,#24384F 100%);color:#fff}
.s .eb{font-size:9pt;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#66748A;margin-bottom:2.5mm}
.s.dark .eb{color:#9FB2C6}
.s h1{font-family:Outfit;font-weight:600;font-size:27pt;line-height:1.1;letter-spacing:-.012em;color:#24384F;margin:0 0 5mm;max-width:270mm}
.s.dark h1{color:#fff}
.s p{font-size:12pt;line-height:1.5;color:#3C4A58;margin:0 0 3mm}
.s.dark p{color:#C9D6E3}
.s .foot{position:absolute;left:20mm;right:20mm;bottom:7mm;display:flex;justify-content:space-between;align-items:center;font-size:7.5pt;color:#8A97A6}
.s .foot img{height:4.2mm}
.s .body{flex:1;min-height:0}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:10mm}
.cols3{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm}
.cols4{display:grid;grid-template-columns:repeat(4,1fr);gap:5mm}
.tile{background:#F3F6F9;border-radius:3mm;padding:5mm 5.5mm}
.tile h3{font-size:12.5pt;margin:0 0 1.5mm}
.tile p{font-size:10.5pt;margin:0;line-height:1.45}
.big{font-family:Outfit;font-weight:600;font-size:30pt;color:#24384F;line-height:1}
.dark .big{color:#fff}
.lbl{font-size:9.5pt;color:#66748A;margin-top:1.5mm;line-height:1.35}
.dark .lbl{color:#9FB2C6}
.s table{font-size:10pt}.s th{font-size:7.8pt}
.s td,.s th{padding-top:1.6mm;padding-bottom:1.6mm}
.ph{display:flex;gap:6mm;justify-content:center;align-items:flex-end}
.ph div{text-align:center;font-size:9.5pt;color:#66748A}
.ph img{height:98mm;border-radius:6mm;border:2.2mm solid #0B0F14;display:block;margin:0 auto 2mm;background:#0B0F14}
.chips span.chip{font-size:9pt;padding:.8mm 3mm}
.tl{display:grid;grid-template-columns:repeat(6,1fr);gap:3mm;margin-top:4mm}
.tl div{border-top:3px solid #24384F;padding-top:3mm}
.tl div.later{border-top-color:#AEB9C5}
.tl b{display:block;font-family:Outfit;font-size:12pt;color:#24384F;margin-bottom:.5mm}
.tl span{display:block;font-size:8.5pt;color:#66748A;margin-bottom:2mm;text-transform:uppercase;letter-spacing:.06em;font-weight:600}
.tl p{font-size:9.5pt;line-height:1.45}
ul.b{margin:0;padding-left:5mm}ul.b li{font-size:11.5pt;line-height:1.45;margin-bottom:2.2mm;color:#3C4A58}
.dark ul.b li{color:#C9D6E3}
.ring{position:absolute;border-radius:50%;border:.7px solid rgba(255,255,255,.08)}
`;

let n = 0;
const slide = (eb, title, body, { dark = false } = {}) => { n++; return `<section class="s${dark ? ' dark' : ''}">${eb ? `<div class="eb">${eb}</div>` : ''}${title ? `<h1>${title}</h1>` : ''}<div class="body">${body}</div>
<div class="foot"><span>${n} · Confidential · for discussion</span><img src="${dark ? LOGO_WHITE : LOGO_NAVY}"></div></section>`; };

export default () => { n = 0; return [

// 1 Cover
(() => { n++; return `<section class="s dark" style="padding:18mm 22mm"><div class="ring" style="width:190mm;height:190mm;right:-40mm;top:-20mm"></div><div class="ring" style="width:120mm;height:120mm;right:-5mm;top:15mm"></div>
<img src="${LOGO_WHITE}" style="height:11mm;align-self:flex-start">
<div style="margin-top:auto;max-width:135mm"><div class="eb">Investor presentation · October 2026</div>
<h1 style="font-size:42pt;margin-bottom:6mm">The money app<br>for Libya.</h1>
<p style="font-size:13.5pt;max-width:132mm">Wallets, payments, messaging, FX, savings, cross-border transfers and business payouts in one Arabic and English app, with bank-grade controls built in.</p>
<p style="font-size:9pt;color:#7F93A8;margin-top:8mm">Confidential. Not an offer of securities. Forecasts are planning estimates. Licences and live payment partners are not yet in place.</p></div>
<div style="position:absolute;right:22mm;top:40mm;height:150.5mm;overflow:hidden;display:flex;gap:7mm;align-items:flex-start"><img src="${still('home')}" style="height:160mm;border-radius:8mm;border:2.6mm solid #05080C"><img src="${still('send')}" style="height:132mm;border-radius:7mm;border:2.4mm solid #05080C;margin-top:22mm"></div></section>`; })(),

// 2 Problem
slide('The problem', 'Money in Libya is hard to hold, move and convert', `<div class="cols4">
<div class="tile"><h3>Cash is scarce</h3><p>Branch queues and withdrawal limits make cash slow to get, yet payments between people still run on notes.</p></div>
<div class="tile"><h3>Rates are hard to see</h3><p>People compare informal quotes by word of mouth and rarely see the full cost before they commit.</p></div>
<div class="tile"><h3>Abroad is costly</h3><p>Families paying for study, treatment and support abroad face slow channels, unclear fees and no tracking.</p></div>
<div class="tile"><h3>Banks aren't mobile</h3><p>Shops, freelancers and employers lack a simple way to pay, get paid and keep records.</p></div></div>
<div class="cols3" style="margin-top:9mm">
<div><div class="big">$${(cbl.transfers / 1e9).toFixed(2)}bn</div><div class="lbl">foreign-currency transfers by Libyan banks, Jan–Sep 2026</div></div>
<div><div class="big">$${(cbl.personal / 1e9).toFixed(2)}bn</div><div class="lbl">foreign exchange for personal purposes, same period</div></div>
<div><div class="big">$${(cbl.total / 1e9).toFixed(1)}bn</div><div class="lbl">total bank foreign-exchange use, same period</div></div></div>
<p style="font-size:8.5pt;color:#8A97A6;margin-top:6mm">Source: Central Bank of Libya, uses of foreign exchange to end of September 2026. Context only; no market share is inferred.</p>`),

// 3 Product
slide('The product', 'One app for the whole money life', `<div class="ph">
${[['home', 'Balances in every currency'], ['send', 'Send by @handle or phone'], ['chat-payment', 'Pay inside a chat'], ['remit', 'Send abroad'], ['budgets', 'Savings goals'], ['business', 'Business payouts']].map(([id, t]) => `<div><img src="${still(id)}">${t}</div>`).join('')}</div>`),

// 4 Built
slide('Where it stands', 'Built and tested, ready for its partners', `<div class="cols3" style="row-gap:8mm">
<div><div class="big">${platform.screens}</div><div class="lbl">mobile screens, Arabic and English</div></div>
<div><div class="big">${platform.cockpitPages}</div><div class="lbl">pages in the staff Control Cockpit</div></div>
<div><div class="big">${platform.endpoints}</div><div class="lbl">API endpoints, including a public business API</div></div>
<div><div class="big">${platform.tests}</div><div class="lbl">server tests passing against a real database</div></div>
<div><div class="big">${platform.corridors}</div><div class="lbl">remittance corridors configured (sandbox)</div></div>
<div><div class="big">${platform.engMonthsLow}–${platform.engMonthsHigh}</div><div class="lbl">engineer-months to rebuild (estimate)</div></div></div>
<div class="chips" style="margin-top:9mm;display:flex;gap:4mm;align-items:center;font-size:10.5pt;color:#3C4A58">Of ${features.length} features in the demo: ${chip('ready', statusCounts.ready + ' built')} ${chip('partner', statusCounts.partner + ' await a partner')} ${chip('off', statusCounts.off + ' off in production')}</div>`),

// 5 Business model
slide('Business model', 'Consumers bring volume. Institutions bring margin.', `<div class="cols">
<div><div class="tile" style="margin-bottom:4mm"><h3>Consumers</h3><p>Free payments between users spread the network. Revenue comes from conversion and cross-border transfers: 0.10% fee plus up to 0.35% FX margin, shown before confirm. ${pct(fee['All-in consumer charge rate'], 2)} all-in, under a 0.50% guardrail.</p></div>
<div class="tile"><h3>Institutions</h3><p>Banks and payment providers license Tazdan's operations software: reconciliation, exceptions, treasury, approvals. $25k pilot · $75k rollout · $120k a year.</p></div></div>
<div><div style="font-size:10pt;font-weight:600;margin-bottom:1mm">Base-case revenue by stream</div>${legend([['Consumer', C.s1], ['Subscriptions', C.s2], ['Pilots and rollouts', C.s3]])}
${groupedBars({ categories: yrs, height: 250, width: 560, series: [{ name: 'Consumer', color: C.s1, values: B.years.map(y => y.consumer) }, { name: 'Subscriptions', color: C.s2, values: B.years.map(y => y.sub) }, { name: 'Projects', color: C.s3, values: B.years.map(y => y.project) }] })}</div></div>`),

// 6 FX engine
slide('The FX engine', 'Every LYD price, one controlled engine', `<div style="width:250mm;margin:0 0 5mm">${mmSvg}</div>
<ul class="b" style="columns:2;column-gap:12mm"><li><b>Two-sided quote</b> around a live reference rate; the spread is shown before confirm.</li>
<li><b>Floor and caps:</b> the ask never drops below the reference, and demand can lift it by at most 300 pips.</li>
<li><b>Fair signal:</b> skew needs at least three customers; round trips cancel; each customer's influence is capped.</li>
<li><b>Safety:</b> stale data widens quotes, then halts them; kill switches; settings change only by approved request.</li></ul>`),

// 7 One transfer
slide('Unit economics', 'One LYD 6,000 transfer, line by line', `<div class="cols">
<table><tr><th>Customer</th><th class="n">Amount</th></tr>
<tr><td>Sends</td><td class="n">LYD 6,000.00</td></tr><tr><td>Fee (0.10%)</td><td class="n">LYD ${fee['Explicit fee in local currency'].toFixed(2)}</td></tr>
<tr><td>Rate (reference 6.0000)</td><td class="n">${fee['Customer local currency per recipient USD'].toFixed(4)}</td></tr>
<tr class="total"><td>Recipient receives</td><td class="n">${usd(fee['Recipient receives USD'], 2)}</td></tr><tr class="sub"><td>All-in cost</td><td class="n">${pct(fee['All-in consumer charge rate'], 2)}</td></tr></table>
<table><tr><th>Company</th><th class="n">USD</th></tr>
<tr><td>Fee + FX margin</td><td class="n">${usd(fee['Gross revenue USD'], 2)}</td></tr><tr><td>Partner share</td><td class="n">(${usd(fee['Partner share USD'], 2)})</td></tr>
<tr><td>Rail, losses, slippage</td><td class="n">(${usd(fee['Rail fee USD'] + fee['Expected loss USD'] + fee['FX slippage USD'], 2)})</td></tr>
<tr class="total"><td>Contribution</td><td class="n">${usd(fee['Contribution per transfer USD'], 2)}</td></tr></table></div>
<p style="margin-top:4mm">Thin by design: the consumer line builds volume and trust, and it pays back a $30 acquisition cost in about ${Math.round(fee['CAC payback months'])} months. Each extra 0.10% of approved margin adds about ${usdM(B.years[4].volume * 0.001 * 0.9)} of year-5 revenue.</p>`),

// 8 GTM
slide('Go to market', 'Win the street, then the corridor', `<div class="cols4">
<div class="tile"><h3>Streets</h3><p>Queue crews outside banks and markets, pop-up rate desks, 20 campus ambassadors.</p></div>
<div class="tile"><h3>Shops</h3><p>300 merchants in 90 days, phone-shop alliance, payroll wedge, driver fleets.</p></div>
<div class="tile"><h3>Phones</h3><p>Claim links by default, @handle land-grab, referral sprints, opt-in Rate Watch.</p></div>
<div class="tile"><h3>Moments</h3><p>Eid money by link, Ramadan nights, Hajj savings, weddings, football.</p></div></div>
<div class="cols4" style="margin-top:8mm">
<div><div class="big">${int(B.years[0].active)}</div><div class="lbl">active customers by month 12 (base)</div></div>
<div><div class="big">${int(B.years[1].active)}</div><div class="lbl">by month 24 (base)</div></div>
<div><div class="big">$30</div><div class="lbl">target cost per settled customer</div></div>
<div><div class="big">$18k</div><div class="lbl">monthly budget, year 1</div></div></div>
<p style="font-size:10pt;margin-top:6mm">Aggressive in reach, strict in claims: no bots, spam or fake reviews; every financial claim human-approved; rewards only after verification and a settled transaction.</p>`),

// 9 Financials
slide('Financial outlook', 'Five years, three cases', `<div class="cols" style="grid-template-columns:1.2fr 1fr">
<div>${caseLeg}${groupedBars({ categories: yrs, height: 250, width: 600, series: [{ name: 'Downside', color: C.s2, values: D.years.map(y => y.revenue) }, { name: 'Base', color: C.s1, values: B.years.map(y => y.revenue) }, { name: 'Growth', color: C.s3, values: G.years.map(y => y.revenue) }] })}</div>
<table><tr><th>Year 5</th><th class="n">Downside</th><th class="n">Base</th><th class="n">Growth</th></tr>
<tr><td>Revenue</td>${[D, B, G].map(c => `<td class="n">${usdM(c.years[4].revenue, 1)}</td>`).join('')}</tr>
<tr><td>Operating result</td>${[D, B, G].map(c => `<td class="n">${Math.abs(c.years[4].op) < 5e3 ? '≈ 0' : usdM(c.years[4].op, 1)}</td>`).join('')}</tr>
<tr><td>Active customers</td>${[D, B, G].map(c => `<td class="n">${int(c.years[4].active)}</td>`).join('')}</tr>
<tr><td>Software run-rate</td>${[D, B, G].map(c => `<td class="n">${usdM(c.years[4].arr, 1)}</td>`).join('')}</tr>
<tr><td>Transfer volume</td>${[D, B, G].map(c => `<td class="n">${usdM(c.years[4].volume, 0)}</td>`).join('')}</tr></table></div>
<p style="font-size:9pt;color:#8A97A6;margin-top:3mm">Revenue, USD. Planning estimates from the integrated financial model; no pricing approval, provider contract or customer behaviour has been observed yet.</p>`),

// 10 Cash
slide('Capital', 'Most of the $10 million stays on the balance sheet', `<div class="cols" style="grid-template-columns:1fr 1.2fr">
<div><table><tr><th>Use of $10M (base case)</th><th class="n">USD</th></tr>
<tr><td>Settlement prefunding (peak)</td><td class="n">${usdM(B.peakPrefund, 1)}</td></tr>
<tr><td>Collateral reserve</td><td class="n">$1.0M</td></tr>
<tr><td>Losses and setup, 5 years</td><td class="n">${usdM(-cumLoss('Base'), 1)}</td></tr>
<tr class="total"><td>Lowest free cash</td><td class="n">${usdM(B.minFree, 1)}</td></tr></table>
<p style="font-size:10.5pt">Prefunding is working capital in payout pools, not spending. The growth case needs about ${usdM(G.gap, 1)} more liquidity by year 5, best met by a settlement facility.</p></div>
<div><div style="font-size:10pt;font-weight:600;margin-bottom:1mm">Free corporate cash by month</div>${lines({ xLabels: Array.from({ length: 60 }, (_, i) => `Month ${i + 1}`), every: 12, height: 240, width: 620, series: [{ name: 'Downside', color: C.s2, values: D.monthly.map(m => m.free) }, { name: 'Base', color: C.s1, values: B.monthly.map(m => m.free) }, { name: 'Growth', color: C.s3, values: G.monthly.map(m => m.free) }] })}</div></div>`),

// 11 Structure
slide('Structure', 'Four companies, each with one job', `<div class="cols" style="grid-template-columns:1.35fr 1fr;align-items:center">
<div>${groupSvg}</div>
<ul class="b"><li><b>Technology</b> owns the IP and never holds customer money.</li>
<li><b>Libya</b> serves customers under its own permission or an authorised partner's.</li>
<li><b>Remit</b> pays recipients abroad as agent of a regulated principal.</li>
<li>Customer money is safeguarded and never funds operations.</li></ul></div>`),

// 12 Roadmap
slide('Roadmap after funding', 'From closing to a live corridor', `<div class="tl">
<div><span>Months 0–3</span><b>Foundations</b><p>Entities, key hires, licence route, partner bank, pen test, restore drill, opening reconciliation.</p></div>
<div><span>Months 3–6</span><b>Pilot</b><p>Invited customers, capped limits, daily reconciliation; first software pilot signed.</p></div>
<div><span>Months 6–12</span><b>Libya launch</b><p>Tripoli, then Benghazi and Misrata; FX within approved pricing; first rollout.</p></div>
<div><span>Months 12–24</span><b>First corridor</b><p>One bankable corridor via a regulated principal; settlement facility.</p></div>
<div class="later"><span>Months 24–36</span><b>Broaden</b><p>More corridors; cards and P2P where economics and permissions allow.</p></div>
<div class="later"><span>Years 4–5</span><b>Region</b><p>North Africa, MENA and the Gulf. Not in the forecast.</p></div></div>
<p style="margin-top:8mm;font-size:10.5pt">Nothing goes live until nine release gates are signed: authorisation, providers, security, money paths, device QA, recovery, operations, safeguarding and treasury. The software enforces this.</p>`),

// 13 Risks
slide('Risks', 'What could go wrong, and what we do about it', `<table>
<tr><th style="width:30%">Risk</th><th>Mitigation</th></tr>
<tr><td>Licensing delayed or refused</td><td>Launch under an authorised partner; software revenue needs no Tazdan licence</td></tr>
<tr><td>Bank acceptance of model or shareholders</td><td>Transparent ownership; receiving-bank review before closing; several banks in parallel</td></tr>
<tr><td>One-way FX flows and liquidity</td><td>Own prefunding then a settlement facility; quote halts when pools run low</td></tr>
<tr><td>Pricing limits</td><td>Model already assumes 0.45% all-in under a 0.50% guardrail</td></tr>
<tr><td>Security, fraud and financial crime</td><td>2FA, step-up checks, risk engine, screening, fraud graph; external pen test before launch</td></tr>
<tr><td>Key-person dependence</td><td>Phase-0 hires, extensive documentation, IP assigned to the group at closing</td></tr></table>`),

// 14 Proposal
slide('The proposal', 'An $18 million investment for 40%', `<div class="cols4" style="margin-top:2mm">
<div><div class="big">${usdM(deal.primary, 0)}</div><div class="lbl">new shares: capital for the company (${pct(deal.primaryPct, 1)})</div></div>
<div><div class="big">${usdM(deal.secondary, 0)}</div><div class="lbl">existing founder shares (${pct(deal.secondaryPct, 1)})</div></div>
<div><div class="big">${usdM(deal.post, 0)}</div><div class="lbl">implied post-money equity value</div></div>
<div><div class="big">60 / 40</div><div class="lbl">founder / investor after closing</div></div></div>
<div class="cols" style="margin-top:9mm"><ul class="b"><li>Board of five: two founder, two investor, one independent chairing audit and risk.</li><li>Investor consent on reserved matters: new shares, sale, borrowing, budget, new markets.</li><li>Both portions priced the same; non-binding and subject to diligence.</li></ul>
<ul class="b"><li><b>Next:</b> confidential demo on fictional data.</li><li>Investor onboarding: entity, beneficial owners, source of funds, bank review.</li><li>Written indication of terms, then diligence with code access under NDA.</li></ul></div>`, { dark: true }),

// 15 Close
slide('', 'Built. Ready for its partners.', `<div class="cols" style="margin-top:4mm"><div><p style="font-size:13pt">This presentation is part of the Tazdan investor pack:</p>
<ul class="b"><li>Investor memorandum</li><li>Corporate structure and governance</li><li>Revenue models and pricing</li><li>Integrated financial model (Excel) and summary</li><li>Guerrilla growth playbook</li><li>Product demo video and feature index</li><li>Launch roadmap, risk register, evidence and sources</li></ul></div>
<div style="align-self:end"><p style="font-size:9pt;color:#7F93A8">Confidential. Prepared by the founder of Tazdan for prospective investors. Not an offer to sell or a solicitation to buy securities. Forecasts are planning estimates, not promises. Licences, banking partners and live payment rails are not yet in place.</p></div></div>`, { dark: true }),
].join('\n'); };
