import { cover, chip, usd, usdM, pct } from './lib.mjs';
import { deal } from './data.mjs';

// Group chart: shareholders → holding company → three operating subsidiaries → external partners.
const box = (x, y, w, h, title, sub, fill = '#fff', stroke = '#C9D3DE', tc = '#15202B', sc = '#66748A') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="1"/>
   <text x="${x + w / 2}" y="${y + (sub ? h / 2 - 3 : h / 2 + 4)}" text-anchor="middle" font-size="11" font-weight="600" fill="${tc}">${title}</text>
   ${sub ? sub.split('|').map((l, i) => `<text x="${x + w / 2}" y="${y + h / 2 + 11 + i * 11}" text-anchor="middle" font-size="8.6" fill="${sc}">${l}</text>`).join('') : ''}`;
const line = (x1, y1, x2, y2, dash) => `<path d="M${x1},${y1} V${(y1 + y2) / 2} H${x2} V${y2}" fill="none" stroke="#8A97A6" stroke-width="1" ${dash ? 'stroke-dasharray="4 3"' : ''}/>`;
export const groupSvg = `<svg viewBox="0 0 660 400" width="100%" style="display:block;font-family:Inter">
 ${box(150, 6, 160, 44, 'Founder', '60% after closing', '#F3F6F9', '#DDE3EA')}
 ${box(350, 6, 160, 44, 'Investor', '40% after closing', '#F3F6F9', '#DDE3EA')}
 ${line(230, 50, 330, 84)}${line(430, 50, 330, 84)}
 ${box(230, 84, 200, 50, 'Tazdan Holding', 'ownership, capital, governance', '#24384F', '#24384F', '#fff', '#C9D6E3')}
 ${line(330, 134, 110, 178)}${line(330, 134, 330, 178)}${line(330, 134, 550, 178)}
 ${box(20, 178, 180, 62, 'Tazdan Technology', 'owns the software and IP|licenses it to group companies')}
 ${box(240, 178, 180, 62, 'Tazdan Libya', 'customer-facing operator in Libya|wallet, payments, FX (licensed)')}
 ${box(460, 178, 180, 62, 'Tazdan Remit', 'international transfers|agent of a regulated principal')}
 <path d="M200,209 H240" stroke="#8A97A6" stroke-dasharray="4 3" fill="none"/><path d="M420,209 H460" stroke="#8A97A6" stroke-dasharray="4 3" fill="none"/>
 <text x="220" y="203" font-size="7.6" fill="#66748A" text-anchor="middle">licence</text><text x="440" y="203" font-size="7.6" fill="#66748A" text-anchor="middle">settlement</text>
 ${line(330, 240, 330, 290, true)}${line(550, 240, 550, 290, true)}
 ${box(240, 290, 180, 54, 'Libyan bank or', 'exchange partner|collection, FX, safeguarding', '#FFF7E6', '#E9C46A')}
 ${box(460, 290, 180, 54, 'Regulated principal', 'and payout networks|banks and wallets abroad', '#FFF7E6', '#E9C46A')}
 <text x="20" y="372" font-size="8.4" fill="#66748A">Solid lines: ownership. Dashed lines: contracts. Amber boxes: outside partners to be signed. No entity has been formed yet; the</text>
 <text x="20" y="385" font-size="8.4" fill="#66748A">holding-company jurisdiction will be chosen with counsel once receiving banks have reviewed the ownership and funding route.</text>
</svg>`;

// Money flows: customer funds kept separate from company revenue.
export const flowSvg = `<svg viewBox="0 0 660 230" width="100%" style="display:block;font-family:Inter">
 <defs><marker id="a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#2a78d6"/></marker>
 <marker id="b" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#eb6834"/></marker></defs>
 <text x="0" y="14" font-size="9" font-weight="600" fill="#2a78d6">CUSTOMER MONEY</text>
 ${box(0, 24, 120, 50, 'Sender', 'pays in LYD')}${box(176, 24, 140, 50, 'Safeguarded account', 'at the Libyan partner bank')}${box(372, 24, 120, 50, 'Payout pool', 'own prefunded liquidity')}${box(540, 24, 120, 50, 'Recipient', 'bank or wallet')}
 <path d="M120,49 H172" stroke="#2a78d6" stroke-width="1.6" marker-end="url(#a)"/><path d="M316,49 H368" stroke="#2a78d6" stroke-width="1.6" marker-end="url(#a)"/><path d="M492,49 H536" stroke="#2a78d6" stroke-width="1.6" marker-end="url(#a)"/>
 <text x="0" y="112" font-size="9" font-weight="600" fill="#eb6834">COMPANY MONEY</text>
 ${box(0, 122, 150, 50, 'Fees and FX margin', 'earned by Tazdan Libya')}${box(200, 122, 150, 50, 'Licence and service fees', 'paid to Tazdan Technology')}${box(400, 122, 120, 50, 'Dividends', 'to Tazdan Holding')}${box(560, 122, 100, 50, 'Shareholders', 'pro rata')}
 <path d="M150,147 H196" stroke="#eb6834" stroke-width="1.6" marker-end="url(#b)"/><path d="M350,147 H396" stroke="#eb6834" stroke-width="1.6" marker-end="url(#b)"/><path d="M520,147 H556" stroke="#eb6834" stroke-width="1.6" marker-end="url(#b)"/>
 <text x="0" y="200" font-size="8.4" fill="#66748A">Customer money never funds operating costs, other entities or the group's liquidity. Payout pools are refilled with the company's own capital</text>
 <text x="0" y="213" font-size="8.4" fill="#66748A">or an agreed settlement facility. Intercompany fees are set at arm's length and recorded per transaction.</text>
</svg>`;

export default () => `
${cover({ eyebrow: '02 · Corporate structure', title: 'Corporate structure<br>and governance', sub: 'How the group is organised, how money moves between companies, who decides what, and how the proposed investment changes ownership.', docNo: 'Document 02' })}

<div class="eyebrow">Group structure</div>
<h1 class="h">Four companies, each with one job</h1>
<p class="lead">Tazdan separates the software from the regulated businesses that use it. A holding company owns three subsidiaries. A technology company owns the code. A Libyan operator serves customers under its own permissions or a partner's. An international remittance company pays recipients abroad through regulated networks.</p>
<figure>${groupSvg}</figure>
<h2>Why this shape</h2>
<div class="grid2">
<ul>
<li><b>Licences match activities.</b> Each regulated business holds exactly the permissions its activity needs, and no more.</li>
<li><b>The IP is protected.</b> The code sits in a company that never holds customer money, so it is insulated from operating risk.</li>
<li><b>Banks can see who owns what.</b> Ownership is disclosed at every level, which partner banks and regulators require.</li>
</ul>
<ul>
<li><b>Corridors can be added one at a time.</b> New countries attach to Tazdan Remit without changing the Libyan business.</li>
<li><b>Software can be sold separately.</b> Tazdan Technology can license the platform to banks and payment providers outside the group.</li>
<li><b>Investors get clear options.</b> Each company can raise money, partner or be sold on its own terms.</li>
</ul>
</div>

<div class="section"></div>
<div class="eyebrow">Entity roles</div>
<h1 class="h">What each company does</h1>
<table>
<tr><th style="width:17%">Company</th><th>Purpose</th><th style="width:19%">Earns</th><th style="width:15%">Holds customer money</th><th style="width:22%">Permission needed</th></tr>
<tr><td><b>Tazdan Holding</b></td><td>Owns the subsidiaries, raises capital, appoints boards, sets group policy.</td><td>Dividends</td><td>No</td><td>Ordinary incorporation</td></tr>
<tr><td><b>Tazdan Technology</b></td><td>Owns the code, brand and data model. Builds, hosts and supports the platform for group companies and outside institutions.</td><td>Licence and service fees; software subscriptions</td><td>No</td><td>Ordinary incorporation; outsourcing and data terms with each client</td></tr>
<tr><td><b>Tazdan Libya</b></td><td>Contracts with Libyan customers. Runs wallets, payments and conversion, either directly or through an approved local partner.</td><td>Transfer fees and FX margin</td><td>Yes, safeguarded at a partner bank</td><td>CBL authorisation, or operation under an authorised partner</td></tr>
<tr><td><b>Tazdan Remit</b></td><td>Pays recipients abroad and, later, collects from senders abroad. Serves customers who never hold a Tazdan wallet.</td><td>Corridor fees and FX margin</td><td>Yes, in transit</td><td>Agent of a regulated principal first; own licence later where justified</td></tr>
</table>

<h2>Agreements between the companies</h2>
<table>
<tr><th style="width:26%">Agreement</th><th style="width:22%">Between</th><th>What it covers</th></tr>
<tr><td>IP assignment</td><td>Founder → Tazdan Technology</td><td>Transfers all code, designs, trademarks and documentation at closing, with a schedule of third-party components and their licences.</td></tr>
<tr><td>Software licence and services</td><td>Technology → Libya and Remit</td><td>Platform access, hosting, support levels, security duties, data processing and an arm's-length fee.</td></tr>
<tr><td>Settlement and liquidity</td><td>Libya ↔ Remit</td><td>Exact obligations per transfer, agreed rates and timestamps, netting rules, credit limits, collateral, settlement dates and default terms.</td></tr>
<tr><td>Brand licence</td><td>Technology → subsidiaries</td><td>Use of the Tazdan name and marks in each market.</td></tr>
<tr><td>Shared services</td><td>Holding → subsidiaries</td><td>Finance, legal, people and compliance services at cost plus an agreed margin.</td></tr>
</table>
<p class="note">Intercompany fees move profit between group companies; they do not add to consolidated revenue. Transfer-pricing treatment will follow local rules in each country.</p>

<div class="section"></div>
<div class="eyebrow">Money flows</div>
<h1 class="h">Customer money and company money never mix</h1>
<p class="lead">Every customer balance is a liability. At launch it will sit in a safeguarded account and be reconciled every day against bank and custody statements. Company revenue follows a separate path. The platform's double-entry ledger, balanced and enforced by the database, already keeps the two apart.</p>
<figure>${flowSvg}</figure>
<h2>Settling between the two operating companies</h2>
<p>Money does not have to cross a border for every customer payment. Each company pays out locally from a prefunded pool, records exactly what it is owed, and the companies settle the net amount on agreed dates.</p>
<table>
<tr><th>Event (illustrative rate: GBP 1 = LYD 8)</th><th>What happens locally</th><th>Between the companies</th></tr>
<tr><td>A sender in Libya pays LYD 8,000 for a UK recipient</td><td>Libya collects LYD; Remit's UK partner pays GBP 1,000 from its pool</td><td>Libya owes Remit GBP 1,000</td></tr>
<tr><td>A sender in the UK pays GBP 600 for a Libyan recipient</td><td>Remit collects GBP; Libya pays LYD 4,800</td><td>Remit owes Libya GBP 600</td></tr>
<tr><td>Netting on the settlement date</td><td>Both customer payments stay individually recorded</td><td>Libya pays Remit the net GBP 400</td></tr>
</table>
<div class="callout warn"><p><b>One-way flow needs capital.</b> Libya-to-abroad volume will exceed the reverse flow for a long time. Payout pools therefore drain and must be refilled through an approved banking route, using the company's own capital or a settlement facility. The financial model sizes this as settlement prefunding. Netting depends on the contracts and on rules in each country; it is not assumed simply because both companies share an owner.</p></div>

<div class="section"></div>
<div class="eyebrow">Governance</div>
<h1 class="h">Who decides what</h1>
<div class="grid2">
<div>
<h3>Board of Tazdan Holding (proposed)</h3>
<table>
<tr><th>Seat</th><th class="n">Number</th></tr>
<tr><td>Founder appointees, including the chief executive</td><td class="n">2</td></tr>
<tr><td>Investor appointees</td><td class="n">2</td></tr>
<tr><td>Independent director, chairing audit and risk</td><td class="n">1</td></tr>
</table>
<h3>Committees</h3>
<ul>
<li><b>Audit and risk:</b> financial statements, safeguarding, reconciliation, external audit.</li>
<li><b>Compliance:</b> AML, sanctions and customer due diligence. The compliance officer reports to it directly.</li>
<li><b>Remuneration:</b> pay, option grants and senior hires.</li>
</ul>
</div>
<div>
<h3>Reserved matters (investor consent)</h3>
<ul>
<li>New shares, option-pool changes or new share classes</li>
<li>Sale of the company, a subsidiary or the IP</li>
<li>Borrowing or guarantees above an agreed limit</li>
<li>Annual budget and business plan</li>
<li>Entering a new country or regulated activity</li>
<li>Related-party transactions, including founder arrangements</li>
<li>Changes to auditors or to the safeguarding arrangements</li>
</ul>
<h3>Controls already built into the platform</h3>
<p>Maker-checker approval for ledger adjustments, refunds and FX overrides; 12 staff roles with 49 permissions; kill switches by feature, currency, corridor and provider; and an append-only audit log.</p>
</div>
</div>
<p class="note">Board composition and reserved matters are proposals for the term sheet. A 50/50 ownership split would need an agreed deadlock procedure; the 40% proposal avoids one.</p>

<div class="section"></div>
<div class="eyebrow">Capitalisation</div>
<h1 class="h">Ownership before and after the proposed investment</h1>
<p class="lead">The founder proposes an ${usdM(deal.total, 0)} transaction for 40% of the company after closing. ${usdM(deal.primary, 0)} is new capital for the company, and ${usdM(deal.secondary, 0)} buys existing shares from the founder. Both portions are priced the same.</p>
<div class="kpis">
<div class="kpi"><div class="v">${usdM(deal.total, 0)}</div><div class="l">Total investment</div></div>
<div class="kpi"><div class="v">40%</div><div class="l">Investor ownership after closing</div></div>
<div class="kpi"><div class="v">${usdM(deal.post, 0)}</div><div class="l">Implied post-money equity value</div></div>
<div class="kpi"><div class="v">${usdM(deal.pre, 0)}</div><div class="l">Implied pre-money equity value</div></div>
</div>
<table>
<tr><th>Shareholder</th><th class="n">Before</th><th class="n">New shares (primary)</th><th class="n">Shares bought from founder</th><th class="n">After</th></tr>
<tr><td>Founder</td><td class="n">100.0%</td><td class="n">—</td><td class="n">(${pct(deal.secondaryPct, 1)})</td><td class="n">60.0%</td></tr>
<tr><td>Investor</td><td class="n">—</td><td class="n">${pct(deal.primaryPct, 1)}</td><td class="n">${pct(deal.secondaryPct, 1)}</td><td class="n">40.0%</td></tr>
<tr class="total"><td>Proceeds</td><td class="n"></td><td class="n">${usdM(deal.primary, 0)} to the company</td><td class="n">${usdM(deal.secondary, 0)} to the founder</td><td class="n">${usdM(deal.total, 0)}</td></tr>
</table>
<div class="grid2">
<div class="card"><h3>Option pool</h3><p>A pool of 8–10% for key hires is recommended. Its size, and whether it sits before or after the investment, belongs in the term sheet. For example, a 10% pool created after closing and shared pro rata would leave the founder at 54% and the investor at 36%.</p></div>
<div class="card"><h3>Assumptions</h3><p>The founder holds 100% of fully diluted equity today, with no debt, preference shares or options outstanding. Figures are before fees and taxes. The table will be rebuilt on the actual share register before signing.</p></div>
</div>

<h2>Formation sequence (first 120 days after a signed term sheet)</h2>
<div class="step"><div class="num">1</div><div><b>Investor onboarding.</b> Identity, beneficial ownership and source of funds for each investing party, then a review by the receiving bank before any money moves.</div></div>
<div class="step"><div class="num">2</div><div><b>Holding and technology companies.</b> Incorporation in the chosen jurisdiction, with bank accounts and the IP assignment from the founder.</div></div>
<div class="step"><div class="num">3</div><div><b>Closing.</b> Shareholder agreement, board appointments, the option pool and both payments: primary to the company, secondary to the founder.</div></div>
<div class="step"><div class="num">4</div><div><b>Tazdan Libya.</b> CBL application route or partner agreement, safeguarding account and pricing approval.</div></div>
<div class="step"><div class="num">5</div><div><b>Tazdan Remit.</b> An agent agreement with a regulated principal for the first corridor, plus the settlement and liquidity agreement with Tazdan Libya.</div></div>
<p class="note">Holding-company jurisdiction is open. Candidates such as the UAE's ADGM or DIFC common-law centres, the UK, or Libya itself will be compared on bank acceptance of the ownership and funding route, access to regulators, investor familiarity, cost and tax. Incorporation alone confers no permission to provide payment services in any country.</p>
`;
