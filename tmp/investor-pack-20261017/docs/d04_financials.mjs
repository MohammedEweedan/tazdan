import { cover, usd, usdM, int, pct, groupedBars, lines, legend, C } from './lib.mjs';
import { cases, param, cumLoss, sum } from './data.mjs';

const D = cases.Downside, B = cases.Base, G = cases.Growth;
const yrs = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'];
const caseSeries = (k, f) => [
  { name: 'Downside', color: C.s2, values: D.years.map(f) },
  { name: 'Base', color: C.s1, values: B.years.map(f) },
  { name: 'Growth', color: C.s3, values: G.years.map(f) },
];
const revChart = groupedBars({ categories: yrs, series: caseSeries('revenue', y => y.revenue), height: 200 });
const opChart = groupedBars({ categories: yrs, series: caseSeries('op', y => y.op), height: 190 });
const months = Array.from({ length: 60 }, (_, i) => `Month ${i + 1}`);
const cashChart = lines({ xLabels: months, every: 12, height: 200, series: [
  { name: 'Downside', color: C.s2, values: D.monthly.map(m => m.free) },
  { name: 'Base', color: C.s1, values: B.monthly.map(m => m.free) },
  { name: 'Growth', color: C.s3, values: G.monthly.map(m => m.free) }] });
const zM = v => Math.abs(v) < 5e3 ? '≈ $0' : usdM(v);
const caseLegend = legend([['Downside', C.s2], ['Base', C.s1], ['Growth', C.s3]]);

const row = (label, f, fmt = usd, cls = '') => `<tr${cls ? ` class="${cls}"` : ''}><td>${label}</td>${B.years.map(y => `<td class="n">${fmt(f(y))}</td>`).join('')}</tr>`;
const p = k => param[k];
const a = (k, fmt) => `<tr><td>${p(k).label}</td><td class="n">${fmt(p(k).downside)}</td><td class="n">${fmt(p(k).base)}</td><td class="n">${fmt(p(k).growth)}</td></tr>`;
const fP = v => (v * 100).toFixed(2).replace(/\.?0+$/, '') + '%', fU = v => usd(v), fN = v => String(v);

export default () => `
${cover({ eyebrow: '04 · Financial model', title: 'Financial model<br>summary', sub: 'A five-year forecast in three cases, built up from customers, transfers, prices and costs. Shows what the $10 million of new capital does, where the cash goes, and what has to be true.', docNo: 'Document 04' })}

<div class="eyebrow">Overview</div>
<h1 class="h">Three cases, one set of formulas</h1>
<p class="lead">The workbook drives a 60-month forecast from one case selector. Revenue is built from active customers, transfers per customer, average ticket and price, plus institutions subscribing to the software. Every cost is shown separately. Customer money is never counted as revenue or as company cash.</p>
<div class="kpis">
<div class="kpi"><div class="v">${usdM(B.years[4].revenue)}</div><div class="l">Base revenue, year 5 (growth case ${usdM(G.years[4].revenue)})</div></div>
<div class="kpi"><div class="v">Breakeven</div><div class="l">Base operating result in year 5 (growth case ${usdM(G.years[4].op)})</div></div>
<div class="kpi"><div class="v">${int(B.years[4].active)}</div><div class="l">Base active customers, end of year 5</div></div>
<div class="kpi"><div class="v">${usdM(-cumLoss('Base'))}</div><div class="l">Base cumulative losses over five years, setup included</div></div>
</div>
<figure><div class="fig-title">Total company revenue by case, USD</div>${caseLegend}${revChart}</figure>
<table>
<tr><th>Case</th><th class="n">Revenue Y1</th><th class="n">Revenue Y3</th><th class="n">Revenue Y5</th><th class="n">Operating result Y5</th><th class="n">Customers Y5</th><th class="n">Peak prefunding</th><th class="n">Funding gap</th></tr>
${[['Downside', D], ['Base', B], ['Growth', G]].map(([n, c]) => `<tr><td><b>${n}</b></td><td class="n">${usdM(c.years[0].revenue)}</td><td class="n">${usdM(c.years[2].revenue)}</td><td class="n">${usdM(c.years[4].revenue)}</td><td class="n">${zM(c.years[4].op)}</td><td class="n">${int(c.years[4].active)}</td><td class="n">${usdM(c.peakPrefund)}</td><td class="n">${c.gap ? usdM(c.gap) : 'None'}</td></tr>`).join('')}
</table>
<p class="note">Operating result is before one-time setup, tax and financing. Funding gap is the most additional corporate cash needed at any month beyond the proposed $10 million of new capital. The cases are sensitivities, not probabilities.</p>

<div class="section"></div>
<div class="eyebrow">Base case</div>
<h1 class="h">Five-year base-case forecast</h1>
<table>
<tr><th>USD</th>${yrs.map(y => `<th class="n">${y}</th>`).join('')}</tr>
${row('Customer transfer volume (principal)', y => y.volume)}
<tr class="sub"><td colspan="6">Revenue</td></tr>
${row('Consumer revenue, after partner share', y => y.consumer)}
${row('Software subscriptions', y => y.sub)}
${row('Pilots and rollouts', y => y.project)}
${row('Total company revenue', y => y.revenue, usd, 'total')}
${row('Gross profit', y => y.gp)}
${row('Operating result before setup and tax', y => y.op)}
${row('One-time setup', y => -y.setup)}
${row('Result before tax', y => y.result, usd, 'total')}
<tr class="sub"><td colspan="6">Operating measures, end of year</td></tr>
${row('Active consumer customers', y => y.active, int)}
${row('Subscribed institutions', y => y.b2b, v => v.toFixed(1))}
${row('Annual subscription run-rate', y => y.arr)}
${row('Free corporate cash after reserves', y => y.free)}
</table>
<figure><div class="fig-title">Operating result by case, USD</div>${caseLegend}${opChart}<figcaption>The base case reaches breakeven in year 5. The growth case turns profitable in year 2 and earns ${usdM(G.years[4].op)} in year 5.</figcaption></figure>

<div class="section"></div>
<div class="eyebrow">Cash and capital</div>
<h1 class="h">Most of the $10 million stays on the balance sheet</h1>
<p class="lead">In the base case only about ${usdM(-cumLoss('Base'), 1)} of the new capital is spent on losses over five years. The largest use is settlement prefunding: the company's own money sitting in payout pools so recipients are paid on time. That money is recovered when volume falls or a bank facility replaces it.</p>
<div class="grid2">
<table>
<tr><th>Use of the $10M (base case)</th><th class="n">USD</th></tr>
<tr><td>Settlement prefunding at its peak (year 5)</td><td class="n">${usdM(B.peakPrefund)}</td></tr>
<tr><td>Restricted collateral reserve</td><td class="n">${usdM(p('restricted').base)}</td></tr>
<tr><td>Cumulative losses, including ${usdM(p('setup').base)} setup</td><td class="n">${usdM(-cumLoss('Base'))}</td></tr>
<tr class="total"><td>Lowest free cash in any month</td><td class="n">${usdM(B.minFree)}</td></tr>
</table>
<div>
<h3>Reading the cash line</h3>
<ul>
<li><b>Prefunding</b> is ${p('prefund').base} days of converted volume, multiplied by ${p('stress').base} for stress. It grows with volume and is working capital, not spending.</li>
<li><b>Collateral</b> is a planning reserve for guarantees partners may require; the real figure depends on the licence and the bank.</li>
<li><b>No float income</b> is assumed on customer money, and no debt is used.</li>
</ul>
</div>
</div>
<figure><div class="fig-title">Free corporate cash after prefunding and reserves, by month</div>${cashChart}
<figcaption>The growth case runs out of free cash in year 3 because prefunding grows with volume. It needs about ${usdM(G.gap, 1)} more by year 5. In practice that would come from a settlement credit line or partner prefunding, not new equity. The growth case still earns ${usdM(sum('Growth', 'op', 5) - sum('Growth', 'op', 1), 1)} of operating profit in years 2 to 5.</figcaption></figure>

<div class="section"></div>
<div class="eyebrow">Assumptions</div>
<h1 class="h">The drivers behind each case</h1>
<table>
<tr><th>Driver</th><th class="n">Downside</th><th class="n">Base</th><th class="n">Growth</th></tr>
${a('launch', v => 'Month ' + v)}
${a('cac', fU)}
${a('churn', fP)}
${a('frequency', fN)}
${a('ticket', fU)}
${a('fee', fP)}
${a('spread', fP)}
${a('provider', fP)}
${a('share', fP)}
${a('mkt1', fU)}
${a('staff1', fN)}
${a('staff5', fN)}
${a('salary', fU)}
${a('annual', fU)}
${a('b2bNew', fN)}
${a('setup', fU)}
</table>
<p class="note">All inputs are planning estimates. No provider pricing has been signed, no pricing approval is documented, and no customer behaviour has been observed yet. The full list of drivers and their basis is on the workbook's Assumptions sheet.</p>
<h2>What has to be true</h2>
<div class="grid2">
<ul>
<li><b>A lawful route for LYD collection, conversion and payout</b>, through Tazdan's own permission or an authorised partner.</li>
<li><b>Pricing approval near 0.45% all-in.</b> Each extra 0.10% of approved margin adds about ${usdM(B.years[4].volume * 0.001 * 0.9)} of revenue in year 5.</li>
<li><b>Acquisition near $30 per settled customer</b>, with monthly attrition at or below 3.5%.</li>
</ul>
<ul>
<li><b>One new institutional rollout per quarter</b> from year 1, at $120,000 a year per subscription.</li>
<li><b>Payout liquidity</b>: own prefunding in the base case, then a settlement facility as volume grows.</li>
<li><b>Costs held to plan</b>: 10 people in year 1, rising to 22 by year 5.</li>
</ul>
</div>

<div class="section"></div>
<div class="eyebrow">The workbook</div>
<h1 class="h">How to use the model</h1>
<p>File: <b>Tazdan_Integrated_Financial_Model.xlsx</b> in this folder. Blue cells are inputs, black cells are formulas and green cells link to other sheets. Change the case on the Assumptions sheet (1 Downside, 2 Base, 3 Growth) and every sheet updates.</p>
<table>
<tr><th style="width:22%">Sheet</th><th>What it shows</th></tr>
<tr><td>Summary</td><td>Five-year results, capital needs and a monthly revenue and operating-result chart</td></tr>
<tr><td>Assumptions</td><td>Every driver for all three cases, with its basis; the case selector; evidence flags</td></tr>
<tr><td>Forecast</td><td>The 60-month engine: customers, transfers, revenue, costs, cash, prefunding and reserves</td></tr>
<tr><td>Fee calculator</td><td>One transfer priced line by line, unit economics and the pricing guardrail check</td></tr>
<tr><td>Rate margins</td><td>The LYD market-maker quote, margin by spread setting and volume, and corridor pricing checks</td></tr>
<tr><td>Acquisition</td><td>Channel budgets and the funnel to a settled customer, with blended cost</td></tr>
<tr><td>Deal structure</td><td>The proposed investment: primary and secondary amounts, ownership and implied values</td></tr>
<tr><td>CBL actuals</td><td>Published Central Bank of Libya foreign-exchange figures for January to September 2026</td></tr>
<tr><td>Review</td><td>Reconciliation checks that must equal zero, plus evidence still pending</td></tr>
<tr><td>Model guide</td><td>Definitions, accounting treatment and limitations</td></tr>
</table>
<h2>Checks</h2>
<ul>
<li>Every case was recalculated independently in code and matched the workbook to within $0.001 on every summary line.</li>
<li>The cash, receivables and contribution reconciliations on the Review sheet equal zero.</li>
<li>Changing a later-year input flows through to the forecast, and the workbook contains no formula errors.</li>
</ul>
<p class="note">The model is a planning tool. It is not audited, statutory or tax accounting. Settlement in production uses exact amounts in each currency, not spreadsheet arithmetic.</p>
`;
