import { cover, usd, int, chip } from './lib.mjs';
import { cases } from './data.mjs';

const B = cases.Base.years, G = cases.Growth.years;
const ch = [['Merchant and field teams', 4500, 600, .55, .5, .4], ['Creators and community demos', 3500, 650, .4, .4, .35], ['Referral rewards (earned)', 4000, 400, .7, .65, .5], ['Intent search and retargeting', 4000, 650, .35, .35, .3], ['Creative and measurement', 2000, 0, 0, 0, 0]];
const rows = ch.map(([n, b, l, k, s, r]) => ({ n, b, l, k, s, r, u: l * k * s }));
const tot = rows.reduce((a, r) => ({ b: a.b + r.b, l: a.l + r.l, u: a.u + r.u }), { b: 0, l: 0, u: 0 });

const play = (n, t, what, cost, kpi, line) => `<div class="card play"><div class="pn">${n}</div><h3>${t}</h3><p>${what}</p>
<div class="meta"><span><b>Cost</b> ${cost}</span><span><b>Measure</b> ${kpi}</span></div>${line ? `<div class="guard">${line}</div>` : ''}</div>`;

export const css = `
.play{position:relative;padding:3.2mm 3.6mm 3mm}
.play h3{font-size:9.6pt;margin:0 0 1.2mm;padding-right:8mm}
.play p{font-size:8.4pt;line-height:1.48;margin-bottom:1.6mm}
.play .pn{position:absolute;right:3.4mm;top:2.6mm;font-family:Outfit;font-weight:600;font-size:13pt;color:#C3CDD8}
.play .meta{display:flex;flex-direction:column;gap:.5mm;font-size:7.7pt;color:#3C4A58;border-top:.5px solid #DDE3EA;padding-top:1.4mm}
.play .meta b{color:#66748A;font-weight:600;margin-right:1mm;text-transform:uppercase;font-size:6.8pt;letter-spacing:.05em}
.play .guard{font-size:7.5pt;color:#7A4F00;background:#FFF6E0;border-radius:1.4mm;padding:1.1mm 2mm;margin-top:1.6mm}
.fronts{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:3mm 0 4mm}
.front{background:#24384F;color:#fff;border-radius:2.4mm;padding:3.4mm 3.6mm}
.front b{font-family:Outfit;font-size:12.5pt;font-weight:600;display:block;margin-bottom:1mm}
.front span{font-size:7.9pt;color:#C9D6E3;line-height:1.4;display:block}
.never li{margin-bottom:1.6mm}
.never li::marker{content:'✕  ';color:#B42318;font-weight:700}
.cal td:first-child{font-weight:600;white-space:nowrap}
`;

export default () => `
${cover({ eyebrow: '05 · Growth playbook', title: 'Guerrilla growth<br>playbook', sub: 'How Tazdan wins its first customers street by street: field crews, merchant takeovers, payment loops that spread on their own, and the moments that matter in Libyan life. With budgets, targets and the lines we never cross.', docNo: 'Document 05' })}

<div class="eyebrow">The plan on a page</div>
<h1 class="h">Win the street before anyone buys a billboard</h1>
<p class="lead">Libyans trust what a friend, a shopkeeper or a colleague shows them in person. Tazdan grows the same way: crews where people already queue, shops that take payments on day one, and an app in which every payment is an invitation. Spend goes only where it produces a verified customer who completes a real transaction.</p>
<div class="kpis">
<div class="kpi"><div class="v">${int(B[0].active)}</div><div class="l">Active customers by month 12 (base); ${int(G[0].active)} in the growth case</div></div>
<div class="kpi"><div class="v">${int(B[1].active)}</div><div class="l">Active customers by month 24 (base); ${int(G[1].active)} in growth</div></div>
<div class="kpi"><div class="v">$18k</div><div class="l">Monthly acquisition budget in year 1 (base), rewards included</div></div>
<div class="kpi"><div class="v">$30</div><div class="l">Target all-in cost per settled customer</div></div>
</div>
<div class="fronts">
<div class="front"><b>Streets</b><span>Field crews, pop-up desks, campus ambassadors</span></div>
<div class="front"><b>Shops</b><span>Merchant takeovers, phone shops, payroll, fleets</span></div>
<div class="front"><b>Phones</b><span>Claim links, handle land-grab, referral sprints</span></div>
<div class="front"><b>Moments</b><span>Eid, Ramadan, Hajj, weddings, football</span></div>
</div>
<h2>Five rules</h2>
<div class="step"><div class="num">1</div><div><b>Be where the pain is.</b> Bank queues, cash shortages and unclear exchange rates are daily frustrations. Show up there with something that works.</div></div>
<div class="step"><div class="num">2</div><div><b>Make every payment an invitation.</b> Payments between users are free, and money sent to a non-user arrives as a claim link. The product does the recruiting.</div></div>
<div class="step"><div class="num">3</div><div><b>Pay only for real customers.</b> A customer counts once they are verified and have completed a settled transaction. Crews, ambassadors and referrers are paid on that event, not on downloads.</div></div>
<div class="step"><div class="num">4</div><div><b>Go deep before going wide.</b> Saturate one district, one campus, one market street, then move on. Density makes word of mouth visible.</div></div>
<div class="step"><div class="num">5</div><div><b>Be bold in reach, strict in claims.</b> Loud, fast and everywhere, but every financial claim is true, approved and shown with its price.</div></div>

<div class="section"></div>
<div class="eyebrow">Front 1 · Streets</div>
<h1 class="h">Field crews and campus armies</h1>
<div class="grid2">
${play(1, 'Queue crews', 'Teams in branded jackets work the pavements outside busy banks and markets in Tripoli, Benghazi and Misrata. They hand out tea and water and help people sign up and verify in about two minutes. The line: <i>your money moves without a branch</i>.', '8 part-time crew; paid per settled customer plus a day rate', 'Settled customers per crew-hour; KYC completion on the spot', 'Public pavement only, never inside bank premises; municipal permission where required.')}
${play(2, 'Pop-up rate desks', 'A booth with a screen that shows the spread-included rate and a calculator: type an amount, see exactly what you get before you confirm. Rotates between market streets weekly.', 'Booth kit, screen and two staff, about $1,500 a month', 'Calculator uses, then signups per desk-day', 'Only after the FX permission. Shows the price, never a forecast or advice.')}
${play(3, 'Campus army', '20 ambassadors at the universities of Tripoli, Benghazi and Misrata. Splitting bills, paying student societies and collecting trip money all happen in the app. Ambassadors climb a leaderboard and earn per settled referral, up to a cap.', 'Hoodies, events and capped commissions, about $1,200 a month', 'Settled referrals per ambassador; campus share of signups', 'Over-18s only. Rewards capped, single level, no recruitment chains.')}
${play(4, 'Street stencils and QR', 'Clean-wash stencils of the logo and a QR code on dusty pavements near markets and campuses, made by washing dirt away rather than painting. Stickers go in partner shop windows.', 'Stencils and pressure washers, about $300 a month', 'Scans by QR location code', 'Permitted surfaces only; partner premises with written consent.')}
</div>
<div class="callout"><p><b>Why field first.</b> Field teams convert best in the pilot funnel: an estimated 55% of opt-ins verify and half of those complete a first transaction. Each crew member is also a trust signal: a real person answering real questions about where the money goes.</p></div>

<div class="section"></div>
<div class="eyebrow">Front 2 · Shops</div>
<h1 class="h">Take over the high street, one shop at a time</h1>
<div class="grid2">
${play(5, 'Merchant takeover', 'Sign 300 shops in 90 days along dense streets: phone shops, cafés, grocers, pharmacies. Each gets a free QR stand and a window sign. Receiving is free, and a bonus follows the first 20 customer payments. Shop staff become recruiters at the counter.', 'QR kits and merchant bonuses, about $2,000 a month', 'Active merchants (5+ payments a week); customers first seen at a merchant', 'Bonuses only on payments from distinct, verified customers.')}
${play(6, 'Phone-shop alliance', 'Phone repair and SIM shops set up the app on new phones and help with verification. They earn a bounty when that customer completes a first transaction.', 'Bounty per settled customer', 'Settled customers per shop per week', 'The customer completes verification personally; shops never hold customer IDs.')}
${play(7, 'Payroll wedge', 'Target companies that still pay staff in cash. Bulk pay to Tazdan users is free during launch, with a second approver above set thresholds. One employer brings 20 to 200 customers in a single afternoon.', 'Two business sellers on the field budget', 'Employees paid per employer; their 30-day repeat rate', 'Employees choose to join; salary never paid to an unverified account.')}
${play(8, 'Fleets and drivers', 'Taxi, ride and delivery drivers get paid through Tazdan and display a QR code for tips and fares. Every rider sees the product working in a real payment.', 'Headrest QR cards and a driver bonus', 'Rider payments per driver; riders who sign up', 'Tips are voluntary; no pressure on passengers.')}
</div>
<h2>The merchant pitch, in one breath</h2>
<p>"Take payments by QR or @handle for free, get paid instantly into your balance, and see every payment with a receipt. No terminal, no monthly fee. We'll set it up now."</p>

<div class="section"></div>
<div class="eyebrow">Front 3 · Phones</div>
<h1 class="h">Loops that recruit while you sleep</h1>
<div class="grid2">
${play(9, 'Claim links by default', 'Sending to a phone number that is not on Tazdan creates a claim link: "Omar sent you LYD 50, claim it". The recipient joins to collect. Every outgoing payment is a warm, personal invitation.', 'Built in; no media cost', 'Claim-link conversion; new customers who joined through a claim', 'Unclaimed money returns to the sender; the link expires.')}
${play(10, 'Handle land-grab', 'Before launch: "Claim your @name before someone else does." Short handles unlock with referrals, and the first 5,000 customers get a founding-member badge. Scarcity fills the waitlist.', 'Built-in handles; badge design', 'Waitlist size and the share who verify at launch', 'Offensive, impersonating and brand handles blocked; no handle resale.')}
${play(11, 'Referral sprints', 'Two-week sprints with city and campus leaderboards. Both sides earn a reward, and the top referrers win capped, non-cash prizes. <b>Change before launch:</b> the app pays when a friend completes KYC; move the trigger to the friend\'s first settled transaction.', 'Inside the $4,000 monthly referral budget', 'Referral share of new customers; invites × conversion (k-factor)', 'Single level only; device and identity checks; rewards held until settlement.')}
${play(12, 'Rate Watch channel', 'A daily opt-in post on messaging channels and social pages with the live price including its spread and a link to the calculator. It is useful enough to follow and gets forwarded on its own.', 'Content time; human approval of every post', 'Followers, forwards and calculator opens', 'Published only once legally cleared; never a forecast or advice; opt-in only.')}
</div>
<div class="callout"><p><b>The cheapest customer is the one a customer brings.</b> In the pilot funnel, earned referrals are the cheapest channel at about ${usd(rows[2].b / rows[2].u)} per settled customer. Claim links add customers without any reward at all.</p></div>

<div class="section"></div>
<div class="eyebrow">Front 4 · Moments</div>
<h1 class="h">Own the moments when money moves</h1>
<div class="grid2">
${play(13, 'Eid money by link', 'Eid gifts for children and family, sent as claim links with a greeting card. Each gift reaches someone new in the family. Runs before Eid al-Fitr (expected early March 2027) and Eid al-Adha (expected mid-May 2027).', 'Card designs and a seasonal creative push', 'Gift links sent; recipients who join', 'Dates follow the moon sighting; no prize draws without permits.')}
${play(14, 'Ramadan nights', 'Iftar pop-ups near mosques and markets, "send iftar to family" requests, and donation links for registered charities only.', 'Pop-up kit and food, about $2,500 for the month', 'Signups per night; donation-link use', 'Registered charities only; Tazdan takes no fee on donations.')}
${play(15, 'Hajj and Umrah savings', 'Savings goals such as "Hajj 2027", with scheduled contributions and a lock until the date. Co-marketed with licensed travel agencies.', 'Agency co-marketing', 'Goals created; monthly contributions', 'Savings goals are not deposits and pay no interest; say so plainly.')}
${play(16, 'Weddings and football', 'Wedding gifts by link instead of cash envelopes. Sponsored five-a-side tournaments, where team fees and half-time collections run through the app.', 'Tournament sponsorships, about $1,000 each', 'Gift links per wedding; teams onboarded', 'Competitions follow local rules; no gambling mechanics.')}
</div>
<h2>Abroad: the corridor communities</h2>
<p>When a corridor goes live, the same playbook runs among Libyan communities in Tunisia, Egypt, Turkey and the UK: students, patients and workers who send and receive money with family at home. Work with community organisers in person, offer value first (rate transparency, help with transfers), and never spam groups. The approved line: <i>Send home what they're actually owed.</i></p>

<div class="section"></div>
<div class="eyebrow">Guardrails</div>
<h1 class="h">Aggressive is not reckless</h1>
<p class="lead">A money app's marketing is a regulated financial promotion. One misleading claim or spam campaign can cost a licence, an app-store listing or a bank partner. These rules apply to staff, crews, ambassadors, creators and agencies alike.</p>
<div class="grid2">
<div>
<h3>We never</h3>
<ul class="never">
<li>Use bots, fake accounts, fake reviews or purchased followers</li>
<li>Message people who have not opted in, or add people to groups without consent</li>
<li>Promise returns, predict exchange rates or present a rate as advice</li>
<li>Advertise a feature before it is live and permitted for that customer</li>
<li>Call the service anonymous or claim encryption it does not have</li>
<li>Pay rewards before verification and a settled transaction</li>
<li>Run multi-level or recruitment-chain incentives</li>
<li>Post on private or public property without permission</li>
<li>Name or disparage competitors without accurate, documented comparisons</li>
<li>Use crypto-hype language or imagery</li>
</ul>
</div>
<div>
<h3>We always</h3>
<ul>
<li>Show the full price (rate, spread, fee and amount received) before confirmation</li>
<li>Have a named compliance reviewer approve every outbound claim, script and post</li>
<li>Keep a log of approved copy, dates and channels</li>
<li>Train crews on what they may and may not say, with a one-page script</li>
<li>Respect privacy: first name and last initial in public places, coarse location only</li>
<li>Let customers opt out of messages in one step</li>
</ul>
<h3>Fraud-proof incentives</h3>
<ul>
<li>Rewards trigger on a settled transaction above a minimum, after KYC</li>
<li>Per-device and per-identity caps, with a holding period before payout</li>
<li>The Control Cockpit's linked-account graph flags referral rings</li>
<li>Crew and ambassador pay is clawed back on reversed or fraudulent signups</li>
</ul>
</div>
</div>

<div class="section"></div>
<div class="eyebrow">Budget and economics</div>
<h1 class="h">Where the first $18,000 a month goes</h1>
<table>
<tr><th style="width:30%">Channel</th><th class="n">Budget</th><th class="n">Leads</th><th class="n">Verify</th><th class="n">1st txn</th><th class="n">Settled</th><th class="n">Cost each</th><th class="n">D30 repeat</th></tr>
${rows.map(r => `<tr><td>${r.n}</td><td class="n">${usd(r.b)}</td><td class="n">${r.l ? int(r.l) : '—'}</td><td class="n">${r.k ? Math.round(r.k * 100) + '%' : '—'}</td><td class="n">${r.s ? Math.round(r.s * 100) + '%' : '—'}</td><td class="n">${r.u ? int(r.u) : '—'}</td><td class="n">${r.u ? usd(r.b / r.u, 2) : '—'}</td><td class="n">${r.r ? Math.round(r.r * 100) + '%' : '—'}</td></tr>`).join('')}
<tr class="total"><td>Total</td><td class="n">${usd(tot.b)}</td><td class="n">${int(tot.l)}</td><td class="n"></td><td class="n"></td><td class="n">${int(tot.u)}</td><td class="n">${usd(tot.b / tot.u, 2)}</td><td class="n"></td></tr>
</table>
<p class="note">Source: model sheet "Acquisition". Conversion rates are pilot assumptions to be tested, not observed results.</p>
<div class="callout warn"><p><b>The pilot funnel lands at about ${usd(tot.b / tot.u)}, against a $30 target.</b> Closing the gap of roughly ${Math.round((1 - 30 / (tot.b / tot.u)) * 100)}% comes from moving money out of paid search and into referrals and merchants, and from free claim-link signups, which the funnel does not count. Any channel above $45 per settled customer after four weeks is cut or rebuilt.</p></div>
<h2>Budget by year (base case)</h2>
<table>
<tr><th>Period</th><th class="n">Monthly budget</th><th>Emphasis</th></tr>
<tr><td>Before launch</td><td class="n">$8,000</td><td>Waitlist, handle land-grab, crew and ambassador recruitment, merchant pipeline, creative</td></tr>
<tr><td>Year 1</td><td class="n">$18,000</td><td>Tripoli, then Benghazi and Misrata; merchant takeover; first referral sprints</td></tr>
<tr><td>Year 2</td><td class="n">$24,000</td><td>Payroll wedge at scale; first corridor communities abroad; Eid and Ramadan moments</td></tr>
<tr><td>Year 3</td><td class="n">$30,000</td><td>Smaller cities; additional corridors; partnerships with institutions using Tazdan software</td></tr>
</table>

<div class="section"></div>
<div class="eyebrow">Execution</div>
<h1 class="h">The first 90 days</h1>
<table class="cal">
<tr><th style="width:17%">When</th><th>Do</th><th style="width:30%">Done when</th></tr>
<tr><td>Weeks −8 to −5</td><td>Hire the growth lead, field manager and first crew. Open the waitlist and the handle land-grab. List 300 target merchants by street. Write and approve scripts and creative.</td><td>5,000 waitlist sign-ups; 300 merchants mapped; all copy approved</td></tr>
<tr><td>Weeks −4 to −1</td><td>Recruit 20 campus ambassadors. Pre-sign 100 merchants with QR kits ready. Train crews on scripts, KYC help and the guardrails. Test the referral and claim-link flows end to end.</td><td>100 merchants signed; crews certified; incentive anti-fraud checks live</td></tr>
<tr><td>Weeks 0–2</td><td>Launch in Tripoli across six zones: queue crews, merchant takeover in zone 1, referral sprint 1, Rate Watch channel once cleared.</td><td>First 1,000 settled customers; channel costs visible daily</td></tr>
<tr><td>Weeks 3–6</td><td>Extend to Benghazi and Misrata. Campus army goes live. First 10 employers on the payroll wedge.</td><td>Merchants with 5+ payments a week; first payroll runs</td></tr>
<tr><td>Weeks 7–12</td><td>First cultural moment campaign. Cut channels above $45; double the best two. Prepare the corridor-community launch for when a corridor is permitted.</td><td>Blended cost per settled customer trending to $30; 30-day repeat at or above 35%</td></tr>
</table>
<h2>Weekly scorecard</h2>
<div class="grid2">
<ul>
<li>Verified sign-ups and KYC completion rate</li>
<li>First settled transaction rate and time to first transaction</li>
<li>Cost per settled customer, by channel and by crew</li>
<li>30-day repeat rate by acquisition channel</li>
<li>Share of new customers from referrals and claim links</li>
</ul>
<ul>
<li>Active merchants and payments per merchant</li>
<li>Employers on payroll and employees paid</li>
<li>Rejected or reversed rewards (fraud rate)</li>
<li>Complaints per 1,000 customers and time to resolve</li>
<li>Approved-copy log complete (yes or no)</li>
</ul>
</div>
<h2>Team</h2>
<p>Growth lead · field manager with 8 part-time crew · ambassador manager with 20 campus ambassadors · 2 merchant and business sellers · community and creator manager · designer · a named compliance reviewer (shared with the compliance team). The cost of this team sits in the model's headcount and acquisition budget.</p>
`;
