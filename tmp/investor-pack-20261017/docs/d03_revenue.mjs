import { cover, chip, usd, usdM, pct, int, groupedBars, legend, C } from './lib.mjs';
import { cases, fee } from './data.mjs';

const B = cases.Base.years, Y5 = B[4];
const R = 6, pip = 0.0001;
const pipRows = [100, 200, 250, 300, 400, 500].map(p => ({ p, side: p * pip / R }));
const vols = [1e6, 5e6, 10e6, 25e6, 50e6];

// Market-maker quote diagram: reference line, ask above, bid below, floor and caps.
export const mmSvg = (() => {
  const w = 640, h = 200, X0 = 84, X1 = 440, y = v => 100 - v * 0.112; // v in pips relative to reference
  const row = (v, label, sub, col, dash = '') => `<line x1="${X0}" x2="${X1}" y1="${y(v)}" y2="${y(v)}" stroke="${col}" stroke-width="${dash ? 1 : 1.8}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>${label ? `<text x="${X0 - 8}" y="${y(v) + 3}" font-size="9" text-anchor="end" fill="#15202B" font-weight="600">${label}</text>` : ''}<text x="${X1 + 8}" y="${y(v) + 3}" font-size="8" fill="#66748A">${sub}</text>`;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="display:block;font-family:Inter">
  <rect x="${X0}" y="${y(800)}" width="${X1 - X0}" height="${y(300) - y(800)}" fill="#EAF1FA"/>
  <rect x="${X0}" y="${y(-100)}" width="${X1 - X0}" height="${y(-800) - y(-100)}" fill="#FDF0EA"/>
  ${row(800, 'Ask cap', 'Ask cap: base spread + 300 pips', '#2a78d6', '3 3')}
  ${row(500, 'Ask', 'Ask: what a customer pays for USD', '#2a78d6')}
  ${row(0, 'Reference', 'Live reference rate (Fulus)', '#15202B')}
  ${row(-100, '', 'Bid limit: at least 100 pips below', '#eb6834', '3 3')}
  ${row(-500, 'Bid', 'Bid: what a customer gets for USD', '#eb6834')}
  <text x="${(X0 + X1) / 2}" y="${y(650) + 3}" font-size="8" fill="#1E5296" text-anchor="middle">demand moves the ask up in 25-pip steps; it never falls below the reference</text>
  <text x="${(X0 + X1) / 2}" y="${y(-300) + 3}" font-size="8" fill="#9A3C12" text-anchor="middle">buying USD from customers always earns the minimum spread</text>
  </svg>`;
})();

const revSvg = groupedBars({
  categories: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
  series: [
    { name: 'Consumer', color: C.s1, values: B.map(y => y.consumer) },
    { name: 'Software subscriptions', color: C.s2, values: B.map(y => y.sub) },
    { name: 'Pilots and rollouts', color: C.s3, values: B.map(y => y.project) },
  ], height: 210,
});

export default () => `
${cover({ eyebrow: '03 · Revenue and pricing', title: 'Revenue models<br>and pricing', sub: 'How Tazdan earns money: the FX margin, transfer fees, business accounts and payment-operations software. Includes the pricing rules that keep each stream inside its approved limits.', docNo: 'Document 03' })}

<div class="eyebrow">Summary</div>
<h1 class="h">Two engines: consumer volume and business software</h1>
<p class="lead">Consumers bring volume. They pay a small, visible margin on currency conversion and cross-border transfers. Institutions bring margin: they pay for pilots, rollouts and annual subscriptions to Tazdan's payment-operations software. The base case grows total revenue to ${usdM(Y5.revenue)} in year 5, and recurring software makes up more than half of it.</p>
<div class="kpis">
  <div class="kpi"><div class="v">${usdM(Y5.revenue)}</div><div class="l">Base-case revenue, year 5</div></div>
  <div class="kpi"><div class="v">${pct(fee['All-in consumer charge rate'], 2)}</div><div class="l">All-in consumer charge on a transfer (base pricing)</div></div>
  <div class="kpi"><div class="v">${usdM(Y5.arr)}</div><div class="l">Software run-rate, end of year 5 (base)</div></div>
  <div class="kpi"><div class="v">0.50%</div><div class="l">Provisional all-in pricing guardrail</div></div>
</div>
<figure><div class="fig-title">Base-case revenue by stream, USD</div>${legend([['Consumer', C.s1], ['Software subscriptions', C.s2], ['Pilots and rollouts', C.s3]])}${revSvg}
<figcaption>Source: Tazdan Integrated Financial Model, Base case. Pilot and rollout revenue is booked on accepted delivery, so it arrives in quarterly steps.</figcaption></figure>

<div class="grid3">
<div class="card"><h3>Consumers</h3><p>Free payments between users pull people in. Revenue comes when money changes currency or crosses a border, at a margin shown before confirmation.</p></div>
<div class="card"><h3>Institutions</h3><p>Banks and payment providers license the operations software Tazdan built for itself. Pilots lead to rollouts and then to annual subscriptions.</p></div>
<div class="card"><h3>Later streams</h3><p>Business payouts, P2P, cards and digital assets are built. They switch on as partners and approvals arrive and are not counted in the forecast.</p></div>
</div>

<div class="section"></div>
<div class="eyebrow">Streams and prices</div>
<h1 class="h">What each stream charges</h1>
<table>
<tr><th style="width:21%">Stream</th><th>How it earns</th><th style="width:22%">Proposed launch price</th><th style="width:17%">Status</th><th class="n" style="width:9%">In forecast</th></tr>
<tr><td><b>Transfers and conversion</b></td><td>A small explicit fee plus an FX margin over the reference rate, both shown before the customer confirms.</td><td>0.10% fee + 0.35% FX margin = 0.45% all-in</td><td>${chip('partner', 'Awaits FX permission')}</td><td class="n">Yes</td></tr>
<tr><td><b>Cross-border corridors</b></td><td>Per-corridor fixed fee, percentage fee and FX spread, set per corridor in the Control Cockpit.</td><td>Repriced to within the 0.50% guardrail</td><td>${chip('partner', 'Sandbox · partner pending')}</td><td class="n">Yes</td></tr>
<tr><td><b>Payment-operations software</b></td><td>Reconciliation, exceptions, treasury visibility and approvals sold to banks and payment providers.</td><td>$25k pilot · $75k rollout · $120k a year</td><td>${chip('ready', 'Built · first buyer pending')}</td><td class="n">Yes</td></tr>
<tr><td><b>Business accounts</b></td><td>Bulk payouts, approvals, API access and webhooks for companies paying staff and suppliers.</td><td>Free to open; per-payout pricing after launch</td><td>${chip('ready', 'Built')}</td><td class="n">No (upside)</td></tr>
<tr><td><b>P2P marketplace</b></td><td>A taker fee deducted from escrow at release. No fee is taken today.</td><td>To be set; shown before confirm</td><td>${chip('off', 'Off by default')}</td><td class="n">No</td></tr>
<tr><td><b>Withdrawals</b></td><td>A flat fee per withdrawal, set by an administrator. The current setting is zero.</td><td>At cost</td><td>${chip('ready', 'Built')}</td><td class="n">No</td></tr>
<tr><td><b>Cards</b></td><td>Interchange and programme fees through a card issuer.</td><td>Issuer terms</td><td>${chip('off', 'Off until issuer signed')}</td><td class="n">No</td></tr>
<tr><td><b>Digital-asset trading</b></td><td>A disclosed spread on buy and sell quotes (2.5% default).</td><td>Not offered at launch</td><td>${chip('off', 'Real-money trading off')}</td><td class="n">No</td></tr>
</table>
<p class="note">Excluded on purpose: interest or yield earned on customer money. Customer balances belong to customers. They are not company revenue or working capital, and no float income is assumed anywhere in this pack.</p>

<h2>Launch fee schedule (proposed)</h2>
<table>
<tr><th>Service</th><th>Price to the customer</th><th>Why</th></tr>
<tr><td>Payments between Tazdan users (@handle, phone, chat)</td><td><b>Free</b></td><td>Network growth: every payment brings the other person in</td></tr>
<tr><td>Claim links and payment requests</td><td><b>Free</b></td><td>The main viral loop: recipients join to claim</td></tr>
<tr><td>Receiving money, QR and payment link</td><td><b>Free</b></td><td>Merchants and freelancers adopt at no cost</td></tr>
<tr><td>Currency exchange</td><td>Spread up to 0.50% per side</td><td>Shown before confirm; set through approval</td></tr>
<tr><td>Cross-border transfer</td><td>0.10% fee + FX margin up to 0.35%</td><td>All-in at or below 0.45%, inside the guardrail</td></tr>
<tr><td>Withdrawal to a bank</td><td>At cost</td><td>No profit on access to your own money</td></tr>
<tr><td>Business account and bulk pay to Tazdan users</td><td>Free during launch</td><td>Payroll brings every employee onto the platform</td></tr>
</table>
<p class="note">All prices are proposals subject to regulatory approval. CBL circular 8/2026 addresses margins on FX sales; its scope for this business and any permitted separate charges still need confirmation. Until then, 0.50% all-in is the planning ceiling.</p>

<div class="section"></div>
<div class="eyebrow">The FX engine</div>
<h1 class="h">How a currency quote is built</h1>
<p class="lead">Every Libyan dinar price comes from one two-sided quoting engine built around a live reference rate. The engine earns a spread on every conversion. Its rules stop the price drifting against customers, and its controls stop quoting when its information is stale.</p>
<figure>${mmSvg}<figcaption>Quote structure on USD/LYD. 1 pip = 0.0001 LYD. Distances are drawn to scale for the code defaults; launch settings must sit inside the approved margin.</figcaption></figure>
<div class="grid2">
<div>
<h3>Pricing rules (enforced in code)</h3>
<ul>
<li><b>Two-sided quote.</b> Ask = reference + half-spread (+ demand skew); bid = reference − half-spread (+ skew).</li>
<li><b>Floor.</b> The ask never falls below the reference rate, however strong selling pressure is.</li>
<li><b>Capped upside.</b> Demand can lift the ask by at most 300 pips above the base spread, in 25-pip steps, at no more than 50 pips a minute.</li>
<li><b>Minimum bid spread.</b> Buying USD from a customer always earns at least 100 pips.</li>
<li><b>Fair demand signal.</b> Skew needs at least three customers and $5,000 of net flow. A customer's round trips cancel out, and each customer's influence is capped at $5,000.</li>
</ul>
</div>
<div>
<h3>Controls</h3>
<ul>
<li><b>Stale reference.</b> After 15 minutes without a fresh reference the quote widens by 200 pips. After 60 minutes, LYD quoting stops.</li>
<li><b>Approval only.</b> Spread settings take effect only through an approved FX-override request, recorded in the audit log.</li>
<li><b>Kill switches.</b> Staff can halt the USD/LYD pair or every LYD pair at once from the Control Cockpit.</li>
<li><b>Disclosure.</b> The customer sees the rate, the spread and the amount received before confirming.</li>
</ul>
</div>
</div>

<div class="section"></div>
<div class="eyebrow">Rate margins</div>
<h1 class="h">Margin by spread setting</h1>
<p>At an illustrative reference rate of 6.0000 LYD per USD, each 100 pips is 0.17% of the price. The code default of 500 pips per side is above the provisional 0.50% guardrail, so launch settings will be 300 pips or less unless a higher margin is approved.</p>
<table>
<tr><th>Half-spread</th><th class="n">Per-side margin</th><th class="n">Margin per $1,000 converted</th>${vols.map(v => `<th class="n">$${v / 1e6}M a month</th>`).join('')}</tr>
${pipRows.map(r => `<tr${r.side > 0.005 + 1e-9 ? ' class="sub"' : ''}><td>${r.p} pips${r.p === 500 ? ' (code default)' : r.p === 300 ? ' (guardrail)' : ''}</td><td class="n">${pct(r.side, 2)}</td><td class="n">${usd(1000 * r.side, 2)}</td>${vols.map(v => `<td class="n">${usd(v * r.side)}</td>`).join('')}</tr>`).join('')}
</table>
<p class="note">Gross margin before slippage, hedging and inventory risk. Greyed rows exceed the provisional guardrail. Reference rate is illustrative only and is not a CBL, Fulus or executable quote. Source: model sheet "Rate margins".</p>

<h2>Worked example: one transfer, line by line</h2>
<p class="lead">A customer sends LYD 6,000 to a recipient who is paid in US dollars. Base-case pricing applies: a 0.10% explicit fee plus a 0.35% FX margin. Everything the customer pays is shown before they confirm.</p>
<div class="grid2">
<table>
<tr><th>Customer view</th><th class="n">Amount</th></tr>
<tr><td>Customer sends</td><td class="n">LYD 6,000.00</td></tr>
<tr><td>Explicit fee (0.10%)</td><td class="n">LYD ${fee['Explicit fee in local currency'].toFixed(2)}</td></tr>
<tr><td>Converted</td><td class="n">LYD ${fee['Local principal converted'].toLocaleString('en-US', { minimumFractionDigits: 2 })}</td></tr>
<tr><td>Customer rate (reference 6.0000)</td><td class="n">${fee['Customer local currency per recipient USD'].toFixed(4)}</td></tr>
<tr class="total"><td>Recipient receives</td><td class="n">${usd(fee['Recipient receives USD'], 2)}</td></tr>
<tr class="sub"><td>All-in cost to the customer</td><td class="n">${pct(fee['All-in consumer charge rate'], 2)}</td></tr>
</table>
<table>
<tr><th>Company view</th><th class="n">USD</th></tr>
<tr><td>Explicit fee</td><td class="n">${usd(fee['Explicit fee USD equivalent'], 2)}</td></tr>
<tr><td>FX margin</td><td class="n">${usd(fee['FX gross margin USD'], 2)}</td></tr>
<tr><td>Partner revenue share (10%)</td><td class="n">(${usd(fee['Partner share USD'], 2)})</td></tr>
<tr><td>Payout rail cost</td><td class="n">(${usd(fee['Rail fee USD'], 2)})</td></tr>
<tr><td>Expected losses</td><td class="n">(${usd(fee['Expected loss USD'], 2)})</td></tr>
<tr><td>FX slippage</td><td class="n">(${usd(fee['FX slippage USD'], 2)})</td></tr>
<tr class="total"><td>Contribution per transfer</td><td class="n">${usd(fee['Contribution per transfer USD'], 2)}</td></tr>
</table>
</div>

<div class="section"></div>
<div class="eyebrow">Unit economics</div>
<h1 class="h">Consumer unit economics (base case)</h1>
<div class="kpis">
  <div class="kpi"><div class="v">${usd(fee['Monthly consumer contribution per customer'], 2)}</div><div class="l">Contribution per active customer per month</div></div>
  <div class="kpi"><div class="v">$30</div><div class="l">All-in cost to acquire a settled customer</div></div>
  <div class="kpi"><div class="v">${usd(fee['Indicative contribution LTV'])}</div><div class="l">Indicative lifetime contribution (3.5% monthly attrition)</div></div>
  <div class="kpi"><div class="v">${Math.round(fee['CAC payback months'])} mo</div><div class="l">Payback on acquisition cost (LTV/CAC ${fee['Contribution LTV divided by CAC'].toFixed(1)}×)</div></div>
</div>
<div class="callout"><p><b>Read this honestly.</b> At a 0.45% all-in price the consumer business is thin. It pays back its acquisition cost, but slowly. Its job in the plan is distribution: it builds volume, data and a trusted brand that institutions want to plug into. The margin in the base case comes from software. The levers below show how quickly the consumer line improves when its inputs move.</p></div>
<table>
<tr><th>Lever</th><th>Change</th><th class="n">Effect (base case)</th></tr>
<tr><td>Approved margin</td><td>+0.10% on the all-in price</td><td class="n">+${usdM(Y5.volume * 0.001 * 0.9)} revenue in year 5</td></tr>
<tr><td>Payout rail cost</td><td>−0.05% through better partner terms</td><td class="n">+${usdM(Y5.volume * 0.0005)} contribution in year 5</td></tr>
<tr><td>Retention</td><td>Monthly attrition 3.5% → 2.5%</td><td class="n">Lifetime contribution ${usd(fee['Monthly consumer contribution per customer'] / 0.035)} → ${usd(fee['Monthly consumer contribution per customer'] / 0.025)}</td></tr>
<tr><td>Ticket size</td><td>+10% average transfer</td><td class="n">+10% volume and consumer revenue</td></tr>
</table>

<div class="section"></div>
<div class="eyebrow">Business software</div>
<h1 class="h">Payment-operations software</h1>
<p class="lead">Banks, e-wallets and payment processors spend hours every day reconciling statements and chasing exceptions. Tazdan already runs that work for itself: reconciliation, an operations console, treasury controls, maker-checker approvals and an audit trail. The same modules are offered as a private deployment for one institution at a time.</p>
<table>
<tr><th>Stage</th><th class="n">Price</th><th>Buyer receives</th><th>Collection</th></tr>
<tr><td><b>Paid pilot</b></td><td class="n">$25,000</td><td>One workflow and one statement format; read-only reconciliation and exception review with synthetic or redacted data</td><td>$10k at signed scope, $15k on acceptance</td></tr>
<tr><td><b>Production rollout</b></td><td class="n">$75,000</td><td>Integration, isolated deployment, access configuration, training and acceptance</td><td>$30k / $30k / $15k by milestone</td></tr>
<tr><td><b>Annual subscription</b></td><td class="n">$120,000</td><td>Non-exclusive use, maintenance and defined support for one deployment</td><td>Annually in advance (forecast assumes monthly)</td></tr>
<tr class="total"><td>First-year billings per customer</td><td class="n">$220,000</td><td colspan="2">of which $120,000 is recurring</td></tr>
</table>
<div class="kpis k3">
  <div class="kpi"><div class="v">${B[4].b2b.toFixed(1)}</div><div class="l">Subscribed institutions by end of year 5 (base, one new rollout a quarter)</div></div>
  <div class="kpi"><div class="v">30%</div><div class="l">Direct cost of recurring delivery and support</div></div>
  <div class="kpi"><div class="v">${usdM(Y5.arr)}</div><div class="l">Annual subscription run-rate, end of year 5</div></div>
</div>
<p class="note">Prices are opening proposals, not observed market prices. No institution has signed yet. A first discovery list of licensed Libyan payment providers is kept for the sales track.</p>

`;
