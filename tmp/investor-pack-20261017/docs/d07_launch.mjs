import { cover, chip } from './lib.mjs';
import { platform } from './data.mjs';

const lvl = v => `<span class="lv lv${v[0]}">${v}</span>`;
export const css = `.lv{display:inline-block;font-size:6.9pt;font-weight:600;padding:.3mm 1.6mm;border-radius:1mm}
.lvH{background:#FDE6E5;color:#9B1C14}.lvM{background:#FFF0CC;color:#7A4F00}.lvL{background:#E2F3EB;color:#0B6646}
.phase{display:grid;grid-template-columns:30mm 1fr;gap:4mm;padding:3mm 0;border-bottom:.5px solid #DDE3EA;break-inside:avoid}
.phase .when{font-family:Outfit;font-weight:600;color:#24384F;font-size:10.5pt;line-height:1.25}
.phase .when span{display:block;font-family:Inter;font-weight:500;font-size:7.6pt;color:#66748A;margin-top:.8mm}
.phase h3{margin:0 0 1mm}.phase p{margin:0 0 1mm;font-size:8.8pt}.phase .done{font-size:8pt;color:#0B6646}`;

const phase = (when, sub, title, body, done) => `<div class="phase"><div class="when">${when}<span>${sub}</span></div><div><h3>${title}</h3><p>${body}</p><div class="done">Done when: ${done}</div></div></div>`;

export default () => `
${cover({ eyebrow: '07 · Launch and diligence', title: 'Launch roadmap<br>and risk register', sub: 'What is built, what stands between the platform and its first real customer, the order of work after funding, and the risks an investor should weigh.', docNo: 'Document 07' })}

<div class="eyebrow">Readiness today</div>
<h1 class="h">Built and tested, not yet licensed or live</h1>
<p class="lead">The software is substantially complete and tested against a real database. What remains is mostly outside the code: permissions, bank and payout partners, independent security testing, and an opening reconciliation of balances. No real customer money has moved through the platform.</p>
<div class="kpis">
<div class="kpi"><div class="v">${platform.tests}</div><div class="l">Server tests passing in ${platform.suites} suites, database tests included (17 October 2026)</div></div>
<div class="kpi"><div class="v">${platform.migrations}</div><div class="l">Database migrations applied cleanly to a fresh database</div></div>
<div class="kpi"><div class="v">${platform.screens}</div><div class="l">Mobile screens, plus a ${platform.cockpitPages}-page staff Control Cockpit</div></div>
<div class="kpi"><div class="v">0 / 9</div><div class="l">Release gates signed off; all nine are pending by design</div></div>
</div>
<table>
<tr><th style="width:22%">Status</th><th>Capabilities</th></tr>
<tr><td>${chip('ready', 'Built and tested')}</td><td>Accounts, sessions and two-factor sign-in; wallets; payments by handle, phone and chat; claim links; messaging; savings goals; statements; KYC with manual review; business accounts with roles, bulk pay, approvals, API keys and webhooks; staff Control Cockpit; double-entry ledger; reconciliation; a 17-rule risk engine; sanctions screening against imported lists</td></tr>
<tr><td>${chip('partner', 'Built, awaits partner')}</td><td>Bank deposits (real collection accounts); currency exchange (FX permission); remittance across 12 sandbox corridors (payout partners); bank withdrawals (manual payout today); phone verification codes (SMS provider)</td></tr>
<tr><td>${chip('off', 'Built, off in production')}</td><td>Real-money digital-asset trading and recurring buys; cards (issuer); P2P marketplace (off by default); AI staff assistant</td></tr>
<tr><td>${chip('plan', 'Outside the code')}</td><td>Licences and permissions; partner contracts; external penetration test; restore drill; physical-device testing in English and Arabic; production migration rehearsal; an opening reconciliation that explains a previously reported difference of about 2,444 USDT in test balances</td></tr>
</table>

<div class="section"></div>
<div class="eyebrow">Release gates</div>
<h1 class="h">Nine gates before any real money moves</h1>
<p class="lead">The platform will not start a production release without a signed evidence file. It names the legal entity, the market and the enabled features, and has a reviewer sign each of nine gates. The readiness check enforces this in software. All nine gates are deliberately pending today.</p>
<table>
<tr><th style="width:22%">Gate</th><th>Evidence required</th><th style="width:15%">Status</th></tr>
<tr><td><b>Authorisation</b></td><td>Issued permission, or an approved regulated-partner arrangement, covering the exact entity, activities, customers and fees</td><td>${chip('off', 'Pending')}</td></tr>
<tr><td><b>Providers</b></td><td>Signed live contracts for each enabled bank, payout and identity provider, each one certified end to end</td><td>${chip('off', 'Pending')}</td></tr>
<tr><td><b>Security</b></td><td>External penetration test with findings fixed; secrets and key management verified</td><td>${chip('off', 'Pending')}</td></tr>
<tr><td><b>Money paths</b></td><td>Every enabled money flow tested end to end with reconciliation to statements</td><td>${chip('off', 'Pending')}</td></tr>
<tr><td><b>Device QA</b></td><td>Physical iOS and Android testing in English and Arabic, accessibility included</td><td>${chip('off', 'Pending')}</td></tr>
<tr><td><b>Recovery</b></td><td>Offsite backups and a timed restore drill, including point-in-time recovery</td><td>${chip('off', 'Pending')}</td></tr>
<tr><td><b>Operations</b></td><td>Alerting that reaches a person, an on-call rota, support and complaints handling</td><td>${chip('off', 'Pending')}</td></tr>
<tr><td><b>Safeguarding</b></td><td>Customer money held in segregated accounts and reconciled daily to the ledger</td><td>${chip('off', 'Pending')}</td></tr>
<tr><td><b>Treasury</b></td><td>Funded payout pools, a replenishment route, limits and a stress test for one-way flows</td><td>${chip('off', 'Pending')}</td></tr>
</table>
<p class="note">Gate names and the evidence format follow the platform's release manifest (version 2). The safeguarding and treasury reviewers must be appointed by the owner, not by engineering.</p>

<div class="section"></div>
<div class="eyebrow">Roadmap after funding</div>
<h1 class="h">From closing to a live corridor</h1>
${phase('Months 0–3', 'Foundations', 'Company, people and proof', 'Close the round and form the entities. Hire a compliance officer, an operations lead and a second senior engineer. Start the CBL application route or a partner agreement. Sign a term sheet with a partner bank. Commission the external penetration test, run the restore drill and complete the opening reconciliation.', 'entities formed; key hires in seat; pen-test report received; restore drill timed; opening balances fully explained')}
${phase('Months 3–6', 'Controlled pilot', 'Real money, small and watched', 'Staff and invited customers only, with capped limits. LYD wallets and payments between users, and daily reconciliation against the bank statement. Sign the first payment-operations software pilot with an institution.', '30 days with no unexplained balance differences; first software pilot signed')}
${phase('Months 6–12', 'Libya launch', 'Tripoli, then Benghazi and Misrata', 'Public launch with the growth playbook. Currency exchange within approved pricing. Business accounts and the payroll wedge. Convert the first pilot to a rollout.', 'about 3,800 active customers (base); first rollout accepted')}
${phase('Months 12–24', 'First corridor', 'One bankable corridor', 'Open the first international corridor through a regulated principal: whichever of the UAE, Tunisia, Egypt or Turkey gets partner acceptance first. Negotiate a settlement facility before prefunding needs outgrow equity.', 'corridor live with certified payouts; about 10,400 active customers (base)')}
${phase('Months 24–36', 'Broaden', 'More corridors and products', 'Add corridors one by one. Switch on cards through an issuer and the P2P marketplace if economics and permissions support them.', 'each new product passes its own release gates')}
${phase('Years 4–5', 'Region', 'North Africa, MENA and the Gulf', 'Expand to new countries through the Tazdan Remit structure and software licensing. Not included in the financial forecast.', 'country-by-country approvals')}

<div class="section"></div>
<div class="eyebrow">Risk register</div>
<h1 class="h">Risks an investor should weigh</h1>
<table>
<tr><th style="width:21%">Risk</th><th class="n" style="width:9%">Likelihood</th><th class="n" style="width:8%">Impact</th><th>Mitigation</th></tr>
<tr><td><b>Licensing delayed or refused</b></td><td class="n">${lvl('High')}</td><td class="n">${lvl('High')}</td><td>Operate under an authorised bank or exchange partner first; software revenue does not depend on Tazdan holding a licence</td></tr>
<tr><td><b>No bank accepts the model or ownership</b></td><td class="n">${lvl('Med')}</td><td class="n">${lvl('High')}</td><td>Transparent ownership from day one; receiving-bank review before closing; approach several banks in parallel</td></tr>
<tr><td><b>FX convertibility and one-way flows</b></td><td class="n">${lvl('High')}</td><td class="n">${lvl('High')}</td><td>Own prefunding, then a settlement facility; netting against reverse flows where lawful; quote halts when pools run low</td></tr>
<tr><td><b>Pricing limits</b></td><td class="n">${lvl('Med')}</td><td class="n">${lvl('Med')}</td><td>Model assumes 0.45% all-in under a 0.50% guardrail; software revenue carries the margin in the base case</td></tr>
<tr><td><b>Rate volatility or devaluation</b></td><td class="n">${lvl('Med')}</td><td class="n">${lvl('Med')}</td><td>Quote floor and caps, 5-minute quote expiry, stale-feed widening and halts; LYD inventory limits to be added before launch</td></tr>
<tr><td><b>Sanctions and financial crime</b></td><td class="n">${lvl('Med')}</td><td class="n">${lvl('High')}</td><td>Screening, a 17-rule risk engine and case management; screening of investors and partners; an independent compliance officer reporting to the board</td></tr>
<tr><td><b>Security breach or fraud</b></td><td class="n">${lvl('Med')}</td><td class="n">${lvl('High')}</td><td>Two-factor sign-in, step-up checks, device and session controls, fraud graph; external penetration test before launch</td></tr>
<tr><td><b>Ledger or reconciliation error</b></td><td class="n">${lvl('Low')}</td><td class="n">${lvl('High')}</td><td>Database-enforced double entry, exact conservation checks and an automatic trading halt on drift; the opening difference is explained before launch</td></tr>
<tr><td><b>Key-person dependence</b></td><td class="n">${lvl('High')}</td><td class="n">${lvl('High')}</td><td>Phase-0 hires, more than 150 internal documents, and IP assigned to Tazdan Technology at closing</td></tr>
<tr><td><b>Political and security conditions</b></td><td class="n">${lvl('Med')}</td><td class="n">${lvl('High')}</td><td>Operations in several cities, hosting outside Libya, a remote-capable team and a continuity plan</td></tr>
<tr><td><b>Competition</b></td><td class="n">${lvl('High')}</td><td class="n">${lvl('Med')}</td><td>Price transparency, social payments and Arabic-first design; partner with incumbents through the software line</td></tr>
<tr><td><b>Slower adoption or higher acquisition cost</b></td><td class="n">${lvl('Med')}</td><td class="n">${lvl('Med')}</td><td>Channel kill rules, built-in referral and claim loops; the downside case shows the effect</td></tr>
<tr><td><b>Entity accounting gaps</b></td><td class="n">${lvl('Med')}</td><td class="n">${lvl('Med')}</td><td>One deployment per legal entity until an entity-keyed ledger is built and tested</td></tr>
</table>

<div class="section"></div>
<div class="eyebrow">Due diligence</div>
<h1 class="h">What is available, and what we ask of investors</h1>
<div class="grid2">
<div>
<h3>Available under NDA</h3>
<ul>
<li>Read access to the source code (server, mobile, website and Control Cockpit)</li>
<li>A 24-document technical data room: architecture, ledger, remittance, treasury, reconciliation, compliance, fraud, security, infrastructure, testing, scalability, provider integrations, technical risks and replacement cost</li>
<li>Regulatory design notes: AML, KYC, sanctions controls, customer funds, funds flow, transaction monitoring, data retention and auditability</li>
<li>Validation records and the launch-blocker list</li>
<li>IP inventory and the founder's confirmation of ownership, with the third-party licence schedule</li>
<li>The integrated financial model (in this pack)</li>
<li>A live product demonstration on fictional data</li>
</ul>
</div>
<div>
<h3>We ask each investing party for</h3>
<ul>
<li>The investing entity, its beneficial owners and the authorised decision-maker</li>
<li>Source of wealth and source of funds, through an agreed professional channel</li>
<li>The funding account and currency, so the receiving bank can review the transaction before any money moves</li>
<li>A written indication covering the amount, the primary and secondary split, ownership and governance requested, conditions and a timetable</li>
</ul>
<div class="callout"><p>These checks protect the investment as much as the company. A shareholder that partner banks cannot accept would stop the bank and payout relationships the business depends on.</p></div>
</div>
</div>
`;
