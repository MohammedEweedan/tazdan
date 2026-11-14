import fs from 'node:fs';
import path from 'node:path';
import { cover, chip, esc, WORK } from './lib.mjs';
import { features, chapters, statusCounts } from './data.mjs';

const seg = JSON.parse(fs.readFileSync(path.join(WORK, 'video/segments.json'), 'utf8'));
const at = Object.fromEntries(seg.index.map(s => [s.id, s]));
const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export const css = `.ix td{font-size:7.7pt;line-height:1.35;padding-top:.9mm;padding-bottom:.9mm}.ix .chip{font-size:6.4pt}.ix td:first-child{color:#66748A;font-variant-numeric:tabular-nums}
.stills{display:grid;grid-template-columns:repeat(6,1fr);gap:3.2mm 3mm}
.st{text-align:left;break-inside:avoid}.st img{width:100%;border-radius:2.6mm;border:1.1mm solid #0B0F14;display:block;background:#0B0F14;margin-bottom:1.2mm}
.st b{display:block;font-size:7.4pt;line-height:1.3;margin-bottom:.6mm}.st .chip{font-size:6pt;padding:.2mm 1.4mm}`;

export default () => `
${cover({ eyebrow: '06 · Product demo', title: 'Feature coverage<br>index', sub: `Every feature in the ${mmss(seg.total)} demo video: when it appears, what it shows and its status today. Includes a still of each screen and what the video does not cover.`, docNo: 'Document 06' })}

<div class="eyebrow">The video, feature by feature</div>
<h1 class="h">${features.length} features in ${chapters.length} chapters</h1>
<p>File: <b>Tazdan_Product_Demo.mp4</b> (1920×1080, ${mmss(seg.total)}, silent with on-screen captions). Status today: ${chip('ready', statusCounts.ready + ' built')} ${chip('partner', statusCounts.partner + ' awaiting a partner')} ${chip('off', statusCounts.off + ' off in production')}</p>
<table class="ix">
<tr><th style="width:7%">Time</th><th style="width:15%">Chapter</th><th style="width:19%">Feature</th><th>What the clip shows</th><th style="width:21%">Status</th></tr>
<tr><td>0:00</td><td colspan="4">Title card and recording notice</td></tr>
${features.map(f => `<tr><td>${mmss(at[f.id].start)}</td><td>${esc(chapters[f.ch])}</td><td><b>${esc(f.title)}</b></td><td>${esc(f.desc)}</td><td>${chip(f.kind, esc(f.status))}</td></tr>`).join('')}
<tr><td>${mmss(at.outro.start)}</td><td colspan="4">Summary card</td></tr>
</table>

<div class="section"></div>
<div class="eyebrow">How it was recorded</div>
<h1 class="h">Real app, fictional customer</h1>
<div class="grid2">
<div>
<p>Every clip was recorded from the Tazdan mobile app itself (the same code that ships to phones, run as a web build at iPhone size and 2× resolution). It shows a fictional, fully verified customer, Amira (@amira), with invented contacts, balances, rates and history.</p>
<p>Every server response is a prepared fixture. No database, payment rail or real money was involved, and no customer data appears anywhere.</p>
</div>
<div>
<p><b>Edits.</b> Long flows play at up to 1.4× speed, and short screens hold on their last frame so the captions can be read. One on-screen label was removed: the chat screen's "End-to-end encrypted" badge, because that claim has not been independently verified.</p>
<p><b>Status labels</b> follow the platform's feature matrix: ${chip('ready', 'Built')} works end to end without outside activation; ${chip('partner', 'Awaits partner')} needs a bank, licence or payout partner; ${chip('off', 'Off')} is refused in production until its conditions are met.</p>
</div>
</div>
<h2>Not shown in the video</h2>
<table>
<tr><th style="width:26%">Area</th><th>What exists</th><th style="width:15%">Status</th></tr>
<tr><td><b>Control Cockpit (web)</b></td><td>32 staff pages: global search and customer 360, KYC, deposit and withdrawal queues, maker-checker approvals, kill switches, remittance centre, FX overrides, treasury pools, providers, reconciliation, compliance cases and watchlists, fraud graph, support escalations, finance, system health and the audit log</td><td>${chip('ready', 'Built')}</td></tr>
<tr><td><b>In-app staff screens</b></td><td>25 administrator screens in the mobile app for queues, rates, fees, users and diagnostics</td><td>${chip('ready', 'Built')}</td></tr>
<tr><td><b>Onboarding</b></td><td>A six-scene animated introduction, sign-up, email verification and two-factor setup</td><td>${chip('ready', 'Built')}</td></tr>
<tr><td><b>Arabic everywhere</b></td><td>The video shows the Arabic home screen; the app's other screens are also translated, with right-to-left layout</td><td>${chip('ready', 'Built · device QA pending')}</td></tr>
<tr><td><b>Public business API</b></td><td>Balances, rates, payouts and signed webhooks, with idempotency keys</td><td>${chip('ready', 'Built')}</td></tr>
</table>
<p class="note">A live demonstration of the app and the Control Cockpit, on the same fictional data, is available on request.</p>

<div class="section"></div>
<div class="eyebrow">Screens</div>
<h1 class="h">A still of every feature</h1>
<div class="stills">
${features.map(f => `<div class="st"><img src="file://${f.still}"><b>${esc(f.title)}</b>${chip(f.kind, esc(f.status))}</div>`).join('')}
</div>
`;
