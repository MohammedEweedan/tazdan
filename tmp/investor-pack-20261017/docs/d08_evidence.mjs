import { cover, usd, chip } from './lib.mjs';
import { cbl, platform } from './data.mjs';

const b = v => '$' + (v / 1e9).toFixed(2) + 'bn';
export const css = `.src td:first-child{width:34%}.src a{word-break:break-all;color:#1E5296}`;

export default () => `
${cover({ eyebrow: '08 · Evidence and sources', title: 'Evidence<br>and sources', sub: 'The facts behind the pack: published market data, engineering validation, platform measurements and every outside source cited, with links.', docNo: 'Document 08' })}

<div class="eyebrow">Market evidence</div>
<h1 class="h">Central Bank of Libya foreign-exchange use, January–September 2026</h1>
<p class="lead">The CBL publishes how banks use foreign exchange. Its latest report at the time of writing covers the first nine months of 2026. These are official actuals in US-dollar equivalent, taken from printed page 2 of the report.</p>
<table>
<tr><th>Category</th><th class="n">January–September 2026</th><th class="n">Monthly average</th></tr>
<tr><td>Total bank foreign-exchange use</td><td class="n">${usd(cbl.total)}</td><td class="n">${b(cbl.total / 9)}</td></tr>
<tr><td>Documentary letters of credit</td><td class="n">${usd(cbl.lcs)}</td><td class="n">${b(cbl.lcs / 9)}</td></tr>
<tr><td>Personal purposes</td><td class="n">${usd(cbl.personal)}</td><td class="n">${b(cbl.personal / 9)}</td></tr>
<tr><td>Transfers</td><td class="n">${usd(cbl.transfers)}</td><td class="n">${b(cbl.transfers / 9)}</td></tr>
</table>
<p>Transfers average about <b>${usd(cbl.transfers / 9)}</b> a month, an annual run-rate of roughly <b>${b(cbl.transfers / 9 * 12)}</b> (simple arithmetic, not a CBL forecast). Categories do not sum to the total because merchant cards are reported separately.</p>
<div class="callout"><p><b>How the pack uses this.</b> As context for the size of formal foreign-exchange flows only. "Transfers" covers far more than consumer remittances, and no customer counts, corridor splits or market share are inferred from it. The forecast is built bottom-up from customers and transfers, and the model reports base-case volume as a share of CBL monthly transfers as a sense check.</p></div>
<p class="note">Source: CBL, Uses of foreign exchange (Arabic index page), report to end of September 2026, printed page 2. ${cbl.url}</p>

<h2>Engineering validation, 17 October 2026</h2>
<table>
<tr><th>Check</th><th>Result</th></tr>
<tr><td>Full server regression, database tests enabled</td><td>${chip('ready', 'Passed')} ${platform.suites} suites, ${platform.tests} tests, none skipped</td></tr>
<tr><td>Clean database migration rehearsal</td><td>${chip('ready', 'Passed')} all ${platform.migrations} migrations applied</td></tr>
<tr><td>Server production build and schema validation</td><td>${chip('ready', 'Passed')}</td></tr>
<tr><td>Web and mobile type checks</td><td>${chip('ready', 'Passed')}</td></tr>
<tr><td>Dependency vulnerability audit</td><td>${chip('off', 'Not completed')} advisory registry unreachable; no clean result is claimed</td></tr>
<tr><td>Production data, live providers, devices, load</td><td>${chip('off', 'Not tested')} outside the scope of local validation</td></tr>
</table>
<p class="note">Local results on an isolated test database; production was not accessed. New tests cover exact money conservation, concurrent limits, idempotent treasury references, session revocation and replay protection.</p>

<div class="section"></div>
<div class="eyebrow">Platform measurements</div>
<h1 class="h">What has been built</h1>
<div class="grid2">
<table>
<tr><th>Measure</th><th class="n">Value</th></tr>
<tr><td>Database models</td><td class="n">${platform.models}</td></tr>
<tr><td>API endpoints</td><td class="n">${platform.endpoints}</td></tr>
<tr><td>Mobile screens</td><td class="n">${platform.screens}</td></tr>
<tr><td>Control Cockpit pages</td><td class="n">${platform.cockpitPages}</td></tr>
<tr><td>Source lines: server / mobile / web</td><td class="n">${platform.serverLines} / ${platform.mobileLines} / ${platform.webLines}</td></tr>
<tr><td>Risk rules / staff roles / permissions</td><td class="n">${platform.riskRules} / ${platform.staffRoles} / ${platform.permissions}</td></tr>
<tr><td>Remittance corridors (sandbox)</td><td class="n">${platform.corridors}</td></tr>
<tr><td>Payout adapters (8 sandbox, 1 internal)</td><td class="n">${platform.adapters}</td></tr>
</table>
<div>
<h3>Replacement cost (estimate)</h3>
<p>Rebuilding the platform is estimated at <b>${platform.engMonthsLow}–${platform.engMonthsHigh} engineer-months</b>, or about <b>$0.9–2.4 million</b> at $12,000–20,000 per fully loaded engineer-month. A team of six to eight would need 12 to 18 months.</p>
<p class="note">A judgement-based effort estimate, not a valuation. It excludes licences, partner contracts, compliance staff, security assessments and the cost of time to market.</p>
<h3>Status labels used in this pack</h3>
<p>${chip('ready', 'Built')} works end to end in the codebase and needs no outside activation.<br>${chip('partner', 'Awaits partner')} complete, but needs a bank, licence or payout partner.<br>${chip('off', 'Off in production')} built, and refused in production until its conditions are met.</p>
</div>
</div>
<p class="note">Measured from the repository on 7 October 2026, with migrations, tests and model counts updated on 17 October 2026.</p>

<div class="section"></div>
<div class="eyebrow">Sources</div>
<h1 class="h">Outside sources cited</h1>
<table class="src">
<tr><th>Source</th><th>Link</th></tr>
<tr><td>CBL, uses of foreign exchange (report index)</td><td><a href="https://cbl.gov.ly/uses-of-foreign-exch/">cbl.gov.ly/uses-of-foreign-exch/</a></td></tr>
<tr><td>CBL publications index (circulars incl. 6/2026, 8/2026, 14/2026)</td><td><a href="https://cbl.gov.ly/publications/">cbl.gov.ly/publications/</a></td></tr>
<tr><td>CBL electronic-payment directory</td><td><a href="https://cbl.gov.ly/en/electronic-payment/">cbl.gov.ly/en/electronic-payment/</a></td></tr>
<tr><td>FATF, politically exposed persons guidance</td><td><a href="https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Peps-r12-r22.html">fatf-gafi.org · PEPs R12/R22</a></td></tr>
<tr><td>FATF, beneficial ownership of legal persons</td><td><a href="https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Guidance-Beneficial-Ownership-Legal-Persons.html">fatf-gafi.org · beneficial ownership</a></td></tr>
<tr><td>UN Security Council, Libya sanctions committee (1970)</td><td><a href="https://main.un.org/securitycouncil/en/sanctions/1970">un.org · sanctions 1970</a></td></tr>
<tr><td>OFAC, Libya sanctions programme; ownership guidance</td><td><a href="https://ofac.treasury.gov/sanctions-programs-and-country-information/libya-sanctions">ofac.treasury.gov · Libya</a> · <a href="https://ofac.treasury.gov/faqs/401">FAQ 401</a></td></tr>
<tr><td>CBUAE, Exchange Business Regulation</td><td><a href="https://rulebook.centralbank.ae/en/rulebook/exchange-business-regulation">rulebook.centralbank.ae</a></td></tr>
<tr><td>UK FCA, payment institution applications</td><td><a href="https://www.fca.org.uk/firms/apply-emoney-payment-institution/pi">fca.org.uk</a></td></tr>
<tr><td>Payout network coverage claims (Nium, Thunes)</td><td><a href="https://docs.nium.com/docs/payouts">docs.nium.com</a> · <a href="https://www.thunes.com/direct-global-network/">thunes.com</a></td></tr>
</table>
<p class="note">Provider coverage pages are the providers' own claims. None confirms acceptance of Tazdan, Libya-origin funds or any specific corridor. Regulatory sources are cited for structure, not as legal conclusions; the applicability of each rule needs counsel's review.</p>
`;
