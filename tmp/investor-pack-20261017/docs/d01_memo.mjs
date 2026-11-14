import { cover, chip, usd, usdM, int, pct, groupedBars, legend, C } from './lib.mjs';
import { cases, cbl, deal, platform, features, chapters, statusCounts, fee, cumLoss } from './data.mjs';
import { groupSvg } from './d02_corporate.mjs';
import { mmSvg } from './d03_revenue.mjs';

const D = cases.Downside, B = cases.Base, G = cases.Growth;
const still = id => features.find(f => f.id === id).still;
const revChart = groupedBars({ categories: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'], height: 180, series: [
  { name: 'Downside', color: C.s2, values: D.years.map(y => y.revenue) },
  { name: 'Base', color: C.s1, values: B.years.map(y => y.revenue) },
  { name: 'Growth', color: C.s3, values: G.years.map(y => y.revenue) }] });
const byChapter = chapters.map((c, i) => ({ c, f: features.filter(f => f.ch === i) }));
const chapterChip = fs => { const k = fs.every(f => f.kind === 'ready') ? ['ready', 'Built'] : fs.some(f => f.kind === 'ready') ? ['partner', 'Mixed'] : fs.some(f => f.kind === 'partner') ? ['partner', 'Awaits partner'] : ['off', 'Off in production']; return chip(...k); };

export const css = `.pain h3{font-size:9.4pt}.pain p{font-size:8.5pt;line-height:1.5}
.ask{background:#24384F;color:#fff;border-radius:2.6mm;padding:4mm 5mm;display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:3mm 0 4mm}
.ask .v{font-family:Outfit;font-size:18pt;font-weight:600;line-height:1.05}.ask .l{font-size:7.6pt;color:#C9D6E3;margin-top:1mm;line-height:1.35}
.small-svg svg{max-height:62mm}`;

export default () => `
${cover({ eyebrow: '01 · Overview', title: 'Investor<br>memorandum', sub: 'Tazdan is a money app built for Libya. Wallets, payments, messaging, currency exchange, savings, cross-border transfers and business payouts run in one Arabic and English app, with the controls of a regulated institution built in. This memorandum summarises the business, where it stands and the proposed investment.', docNo: 'Document 01' })}

<div class="eyebrow">At a glance</div>
<h1 class="h">A complete money platform for Libya, built and ready for its partners</h1>
<p class="lead">Moving money in Libya is harder than it should be. Cash runs short, branches are slow, exchange rates are hard to see, and sending money abroad is costly and uncertain. Tazdan does these jobs in one app. The software is built and tested; what remains is the licence route, a partner bank and payout partners, which the investment funds.</p>
<div class="ask">
<div><div class="v">${usdM(deal.total, 0)}</div><div class="l">Proposed investment</div></div>
<div><div class="v">40%</div><div class="l">Investor ownership after closing</div></div>
<div><div class="v">${usdM(deal.primary, 0)}</div><div class="l">New capital for the company</div></div>
<div><div class="v">${usdM(deal.secondary, 0)}</div><div class="l">Purchase of existing founder shares</div></div>
</div>
<div class="grid3">
<div class="card"><h3>The product</h3><p>${platform.screens} mobile screens in Arabic and English, a ${platform.cockpitPages}-page staff Control Cockpit, ${platform.endpoints} API endpoints and ${platform.tests} passing server tests. ${statusCounts.ready} of the ${features.length} features in the demo video work today without an outside partner.</p></div>
<div class="card"><h3>The business</h3><p>Two engines. Consumers pay a small, visible margin on conversion and transfers. Banks and payment providers license Tazdan's operations software. Base-case revenue reaches ${usdM(B.years[4].revenue)} in year 5, and ${usdM(G.years[4].revenue)} in the growth case.</p></div>
<div class="card"><h3>The plan</h3><p>Libya first: a controlled pilot, then Tripoli, Benghazi and Misrata, with an aggressive street-level growth playbook. Then one bankable international corridor, then more. Regional expansion from year 4.</p></div>
</div>
<h2>Why now</h2>
<ul>
<li><b>The rules are being written.</b> In 2026 the Central Bank of Libya published circulars on outward transfers through exchange companies (6/2026) and banks (14/2026), and on margins for FX sales (8/2026). A ready, controlled platform can move as soon as its route is confirmed.</li>
<li><b>The flows are large.</b> Libyan banks reported $${(cbl.transfers / 1e9).toFixed(2)} billion of foreign-currency transfers and $${(cbl.personal / 1e9).toFixed(2)} billion for personal purposes in the first nine months of 2026.</li>
<li><b>The hard part is done.</b> Rebuilding this platform would take an estimated ${platform.engMonthsLow}–${platform.engMonthsHigh} engineer-months, or 12 to 18 months for a full team.</li>
</ul>

<div class="section"></div>
<div class="eyebrow">The problem</div>
<h1 class="h">Money in Libya is hard to hold, move and convert</h1>
<div class="grid2">
<div class="card pain"><h3>Cash is scarce</h3><p>Branch queues and withdrawal limits make cash slow to get. Payments between people still depend on physical notes.</p></div>
<div class="card pain"><h3>Exchange rates are hard to see</h3><p>People compare informal quotes by word of mouth and rarely know the full cost of a conversion before they commit.</p></div>
<div class="card pain"><h3>Sending money abroad is costly and uncertain</h3><p>Families paying for study, treatment or support abroad face slow channels, unclear fees and little tracking.</p></div>
<div class="card pain"><h3>Banks are not built for phones</h3><p>Everyday customers, small shops and employers lack a simple digital way to pay, get paid and keep records.</p></div>
</div>
<h2>The scale of formal flows</h2>
<table>
<tr><th>Central Bank of Libya, foreign-exchange use, Jan–Sep 2026</th><th class="n">USD equivalent</th></tr>
<tr><td>Total bank foreign-exchange use</td><td class="n">${usd(cbl.total)}</td></tr>
<tr><td>Documentary letters of credit</td><td class="n">${usd(cbl.lcs)}</td></tr>
<tr><td>Personal purposes</td><td class="n">${usd(cbl.personal)}</td></tr>
<tr><td>Transfers</td><td class="n">${usd(cbl.transfers)}</td></tr>
</table>
<p class="note">Official actuals (printed page 2 of the CBL report to end of September 2026). Context only: no market share or customer counts are inferred. Tazdan's forecast is built bottom-up; the base case reaches ${usdM(B.years[4].volume, 0)} of annual transfer volume in year 5.</p>
<h2>Who Tazdan serves</h2>
<div class="grid3">
<div><h3>People and families</h3><p>Everyday payments, savings goals such as Hajj, and money for family abroad.</p></div>
<div><h3>Shops, freelancers and employers</h3><p>Free QR and @handle payments, bulk payroll with approvals, statements and an API.</p></div>
<div><h3>Banks and payment providers</h3><p>Reconciliation, exceptions, treasury visibility and approvals as licensed software.</p></div>
</div>

<div class="section"></div>
<div class="eyebrow">The product</div>
<h1 class="h">One app, eight jobs, with controls built in</h1>
<div class="phones">
${[['home', 'Home and balances'], ['send', 'Send to anyone'], ['chat-payment', 'Pay inside a chat'], ['remit', 'Send abroad'], ['business', 'Business accounts']].map(([id, t]) => `<div class="phone"><img src="file://${still(id)}">${t}</div>`).join('')}
</div>
<table>
<tr><th style="width:22%">Area</th><th>What it does</th><th style="width:18%">Status</th></tr>
${byChapter.map(({ c, f }) => `<tr><td><b>${c}</b></td><td>${f.map(x => x.title).join(' · ')}</td><td>${chapterChip(f)}</td></tr>`).join('')}
<tr><td><b>Control Cockpit (web)</b></td><td>Customer 360, KYC and withdrawal queues, maker-checker approvals, kill switches, remittance centre, treasury, reconciliation, compliance cases, fraud graph, audit log</td><td>${chip('ready', 'Built')}</td></tr>
</table>
<p class="note">See the 3½-minute demo video and the Feature Coverage Index in folder 06. Feature status in detail: ${statusCounts.ready} built, ${statusCounts.partner} awaiting a partner, ${statusCounts.off} switched off in production until their conditions are met.</p>

<div class="section"></div>
<div class="eyebrow">Business model</div>
<h1 class="h">Consumers bring volume; institutions bring margin</h1>
<div class="grid2">
<div>
<h3>Consumer</h3>
<p>Payments between users, claim links and receiving are free, which is how the network spreads. Revenue comes when money changes currency or crosses a border: a 0.10% fee plus an FX margin of up to 0.35%, shown before the customer confirms. That is ${pct(fee['All-in consumer charge rate'], 2)} all-in, inside a provisional 0.50% guardrail.</p>
<h3>Software</h3>
<p>Payment-operations software for banks and payment providers: a $25,000 pilot, a $75,000 rollout and $120,000 a year per deployment. In the base case, subscriptions are ${pct(B.years[4].sub / B.years[4].revenue, 0)} of year-5 revenue.</p>
</div>
<div>
<h3>Unit economics (base case)</h3>
<table>
<tr><td>Contribution per active customer per month</td><td class="n">${usd(fee['Monthly consumer contribution per customer'], 2)}</td></tr>
<tr><td>Cost to acquire a settled customer</td><td class="n">$30</td></tr>
<tr><td>Indicative lifetime contribution</td><td class="n">${usd(fee['Indicative contribution LTV'])}</td></tr>
<tr><td>First-year billings per software customer</td><td class="n">$220,000</td></tr>
</table>
<p class="note">Each extra 0.10% of approved consumer margin adds about ${usdM(B.years[4].volume * 0.001 * 0.9)} to base-case revenue in year 5.</p>
</div>
</div>
<h3>The FX engine</h3>
<div class="small-svg">${mmSvg}</div>
<p class="note">Every LYD price comes from one two-sided engine around a live reference rate. The ask never falls below the reference, upward moves are capped, stale data widens or halts quotes, and settings change only through an approved, audited request.</p>

<div class="section"></div>
<div class="eyebrow">Go to market</div>
<h1 class="h">Win the street, then the corridor</h1>
<p class="lead">Libyans trust what a friend, a shopkeeper or a colleague shows them. Tazdan's playbook puts crews where people already queue, signs up shops street by street, and relies on an app where every payment is an invitation. Spend only counts when it produces a verified customer with a settled transaction.</p>
<table>
<tr><th style="width:16%">Front</th><th>Plays</th></tr>
<tr><td><b>Streets</b></td><td>Queue crews outside banks and markets; pop-up rate desks; 20 campus ambassadors; clean-wash QR stencils</td></tr>
<tr><td><b>Shops</b></td><td>300 merchants in 90 days with free QR stands; phone-shop alliance; payroll wedge (one employer brings 20 to 200 users); driver fleets</td></tr>
<tr><td><b>Phones</b></td><td>Claim links by default; @handle land-grab before launch; city and campus referral sprints; opt-in Rate Watch channel</td></tr>
<tr><td><b>Moments</b></td><td>Eid money by link; Ramadan nights; Hajj and Umrah savings goals; wedding gifts; five-a-side football</td></tr>
</table>
<div class="kpis">
<div class="kpi"><div class="v">${int(B.years[0].active)}</div><div class="l">Active customers by month 12 (base)</div></div>
<div class="kpi"><div class="v">${int(B.years[1].active)}</div><div class="l">Active customers by month 24 (base)</div></div>
<div class="kpi"><div class="v">$18k</div><div class="l">Monthly acquisition budget, year 1</div></div>
<div class="kpi"><div class="v">$30</div><div class="l">Target cost per settled customer</div></div>
</div>
<div class="callout"><p><b>Aggressive in reach, strict in claims.</b> No bots, spam, fake reviews or unlicensed features in advertising. Every financial claim is approved by a named compliance reviewer, and rewards pay out only after verification and a settled transaction. Full detail in the Guerrilla Growth Playbook (folder 05).</p></div>

<div class="section"></div>
<div class="eyebrow">Financial outlook</div>
<h1 class="h">Five years, three cases</h1>
<figure><div class="fig-title">Total company revenue by case, USD</div>${legend([['Downside', C.s2], ['Base', C.s1], ['Growth', C.s3]])}${revChart}</figure>
<table>
<tr><th>Case</th><th class="n">Revenue Y1</th><th class="n">Revenue Y3</th><th class="n">Revenue Y5</th><th class="n">Op. result Y5</th><th class="n">Customers Y5</th><th class="n">Funding gap</th></tr>
${[['Downside', D], ['Base', B], ['Growth', G]].map(([n, c]) => `<tr><td><b>${n}</b></td><td class="n">${usdM(c.years[0].revenue)}</td><td class="n">${usdM(c.years[2].revenue)}</td><td class="n">${usdM(c.years[4].revenue)}</td><td class="n">${Math.abs(c.years[4].op) < 5e3 ? 'Breakeven' : usdM(c.years[4].op)}</td><td class="n">${int(c.years[4].active)}</td><td class="n">${c.gap ? usdM(c.gap) : 'None'}</td></tr>`).join('')}
</table>
<div class="grid2">
<div><h3>Where the $10 million goes (base)</h3><p>About ${usdM(-cumLoss('Base'), 1)} funds operating losses and setup over five years. Up to ${usdM(B.peakPrefund, 1)} sits in payout pools as settlement prefunding: working capital that stays on the balance sheet. ${usdM(1e6, 0)} is held as a collateral reserve.</p></div>
<div><h3>What the growth case needs</h3><p>Faster volume means larger payout pools. By year 5 the growth case needs about ${usdM(G.gap, 1)} more liquidity, best supplied by a settlement credit line, while it earns ${usdM(G.years[4].op, 1)} of operating profit that year.</p></div>
</div>
<p class="note">Planning estimates, not promises. No pricing approval, provider contract or customer behaviour has yet been observed. Full model: folder 04.</p>

<div class="section"></div>
<div class="eyebrow">Structure and transaction</div>
<h1 class="h">Four companies and a clear proposal</h1>
<div class="small-svg">${groupSvg}</div>
<table>
<tr><th>Proposed term</th><th class="n">Value</th></tr>
<tr><td>Total investment</td><td class="n">${usdM(deal.total, 0)}</td></tr>
<tr><td>New shares issued by the company (primary)</td><td class="n">${usdM(deal.primary, 0)} · ${pct(deal.primaryPct, 1)}</td></tr>
<tr><td>Existing shares bought from the founder (secondary)</td><td class="n">${usdM(deal.secondary, 0)} · ${pct(deal.secondaryPct, 1)}</td></tr>
<tr><td>Investor ownership after closing / founder</td><td class="n">40% / 60%</td></tr>
<tr><td>Implied post-money / pre-money equity value</td><td class="n">${usdM(deal.post, 0)} / ${usdM(deal.pre, 0)}</td></tr>
<tr><td>Board of the holding company (proposed)</td><td class="n">2 founder · 2 investor · 1 independent</td></tr>
</table>
<p class="note">The founder's proposed opening terms; non-binding and subject to diligence, documentation and receiving-bank review of the investing parties and funds. Primary and secondary shares priced the same. The cap table will be rebuilt on the actual share register.</p>

<div class="section"></div>
<div class="eyebrow">Readiness and risk</div>
<h1 class="h">What stands between today and launch</h1>
<div class="grid2">
<div>
<h3>Done</h3>
<ul>
<li>Full consumer, business and staff platform, in Arabic and English</li>
<li>Double-entry ledger enforced by the database, with exact conservation checks</li>
<li>Risk engine, sanctions screening, maker-checker approvals, kill switches</li>
<li>${platform.tests} server tests passing against a real database; ${platform.migrations} migrations rehearsed on a clean database</li>
<li>A release process that refuses to launch without nine signed evidence gates</li>
</ul>
</div>
<div>
<h3>To do (funded by this round)</h3>
<ul>
<li>Licence route or authorised partner; a partner bank with safeguarded accounts</li>
<li>Payout partners for the first corridor; FX pricing approval</li>
<li>External penetration test, restore drill and physical-device testing</li>
<li>An opening reconciliation that explains a previously reported test-balance difference of about 2,444 USDT</li>
<li>Key hires: compliance officer, operations lead, second senior engineer</li>
</ul>
</div>
</div>
<table>
<tr><th style="width:30%">Main risk</th><th>Mitigation</th></tr>
<tr><td>Licensing delayed or refused</td><td>Launch under an authorised partner; software revenue does not depend on Tazdan's own licence</td></tr>
<tr><td>Bank acceptance of the model or the shareholders</td><td>Transparent ownership; receiving-bank review before closing; several banks approached in parallel</td></tr>
<tr><td>One-way FX flows and liquidity</td><td>Own prefunding, then a settlement facility; quote halts when pools run low</td></tr>
<tr><td>Key-person dependence</td><td>Phase-0 hires, extensive documentation and the IP assigned to the group at closing</td></tr>
</table>
<h2>Next steps</h2>
<div class="step"><div class="num">1</div><div>Confidential meeting and live product demonstration on fictional data.</div></div>
<div class="step"><div class="num">2</div><div>Investor onboarding: investing entity, beneficial owners, source of funds, receiving-bank review.</div></div>
<div class="step"><div class="num">3</div><div>A written indication of terms, then diligence with source-code access under NDA and a term sheet.</div></div>
`;
