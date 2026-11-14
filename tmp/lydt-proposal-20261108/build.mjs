// LYDT proposal to the Central Bank of Libya — English and Libyan Arabic.
// Facts come from the working sandbox: server/src/services/lydt, the contract
// in contracts/lydt, and their tests. Screens: capture.mjs (+ Pay screens
// from tmp/investor-pdf-20261108). Usage: node build.mjs [en|ar]
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../..');
const require = createRequire(path.join(ROOT, 'client/scripts/app-media/package.json'));
const { chromium } = require('playwright-core');
const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const FONTS = path.join(ROOT, 'client/public/fonts');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Verified in this build: contract tests, LYDT server tests, full server suite.
const EVIDENCE = { contractTests: 12, serverLydtTests: 8, serverSuites: 52, serverTests: 406 };

const T = {
  en: {
    dir: 'ltr', lang: 'en', file: 'LYDT_Proposal_CBL_2026-11_EN.pdf', font: 'Inter', head: 'Outfit',
    footer: 'tazdan · LYDT proposal to the Central Bank of Libya · Confidential', page: `counter(page) " / " counter(pages)`,
    cover: {
      eyebrow: 'Proposal to the Central Bank of Libya · November 2026',
      title: 'LYDT: a digital dinar the Central Bank can supervise from day one',
      sub: 'tazdan proposes to issue LYDT, a digital Libyan dinar backed one-for-one by dinars held at the Central Bank of Libya, under the Bank\'s supervision, with a built-in path for the Bank to take over issuance.',
      meta: [['Peg', '1 LYDT = 1 LYD'], ['Backing', '100% at the CBL'], ['Control', 'CBL can pause, freeze, cap'], ['Status', 'Working sandbox']],
      legal: 'Confidential. LYDT is a sandbox: no LYDT has been issued to the public, and none will be without the written authorisation of the Central Bank of Libya. Screens show test data; figures in them are illustrative.',
    },
    summary: {
      eyebrow: 'Summary', title: 'What we propose',
      lead: 'A digital dinar that settles instantly, can be traced end to end, and never creates new money: every LYDT in circulation is matched by a dinar the Central Bank holds and attests.',
      blocks: [
        ['How it works', 'A customer converts dinars in their tazdan balance into LYDT. The dinars move into a reserve account at the Central Bank of Libya; the same amount of LYDT is issued. Redeeming reverses it, at any time. LYDT moves instantly between verified customers and shops, including by QR code at the till.'],
        ['What the Bank controls', 'Issuance can never exceed the reserve balance the Bank last attested, and stops when the statement is out of date. The Bank can pause new issuance and transfers, freeze any holder, cap any holder\'s balance and see supply, reserves and every movement in real time. Redemption is never paused for ordinary holders.'],
        ['The path to a central-bank digital dinar', 'The design separates the issuer role from the supervisor role. When the Bank decides, it takes over the issuer role and revokes tazdan\'s. LYDT becomes a dinar issued by the Bank itself, running on infrastructure that is already in use, with tazdan as one of the wallets that distribute it.'],
        ['What we ask', 'Admission to a supervised sandbox; a reserve account at the Bank; supervisor access for Bank staff; and agreement on a limited pilot (proposed on the last page).'],
      ],
    },
    why: {
      eyebrow: 'Why now', title: 'What a digital dinar solves',
      rows: [
        ['Cash shortages and bank queues', 'Dinars held as LYDT move instantly between people and shops without banknotes, while the underlying dinars stay in the Bank\'s custody.'],
        ['Payments outside the banking system', 'Every LYDT movement is recorded with both parties identified, giving the Bank visibility that cash does not.'],
        ['Financial inclusion', 'Anyone with a phone and a verified tazdan account can hold, send and receive dinars, in Arabic, without a card or a branch visit.'],
        ['No new credit risk', 'LYDT is fully reserved at the Central Bank. It is not a deposit, pays no interest and is never lent out.'],
        ['A CBDC without starting from zero', 'The Bank gains a working, supervised digital dinar it can adopt as its own, instead of commissioning a platform from scratch.'],
      ],
    },
    how: {
      eyebrow: 'Design', title: 'How LYDT works',
      lead: 'Four flows, each recorded on a double-entry ledger with an audit trail.',
      steps: [
        ['Fund the reserve', 'tazdan moves dinars into the LYDT reserve account at the Central Bank. The Bank attests the balance; that statement sets the most LYDT that can exist.'],
        ['Issue', 'A verified customer converts dinars to LYDT. Their dinar balance falls, the reserve ledger rises by the same amount, and the LYDT is issued — only if total supply stays within the attested reserve.'],
        ['Pay', 'LYDT moves between verified customers and shops instantly, with the same limits, fraud checks and identity verification as every other tazdan payment.'],
        ['Redeem', 'The holder returns LYDT and the same dinars return to their balance immediately. Redemption works even when issuance is paused.'],
      ],
      invariantTitle: 'The rule checked on every operation',
      invariant: 'LYDT in circulation = dinars in the reserve ledger ≤ dinars attested by the Central Bank',
      diagram: { cust: 'Customer', custSub: 'dinar balance', reserve: 'Reserve account', reserveSub: 'Central Bank of Libya', lydt: 'LYDT', lydtSub: 'customers and shops', issue: 'issue', redeem: 'redeem', attest: 'attests balance', pay: 'pay' },
    },
    controls: {
      eyebrow: 'Supervision', title: 'The Bank\'s powers, built in',
      head: ['Power', 'How it works', 'In the sandbox'],
      rows: [
        ['Issuance limit', 'Supply can never exceed the latest reserve balance the Bank attested', 'Enforced on every issue, including simultaneous requests'],
        ['Stale-statement stop', 'No issuance on a reserve statement older than 48 hours (adjustable)', 'Enforced'],
        ['Pause', 'One switch stops new issuance and transfers; redemption continues', 'Enforced; staff control panel'],
        ['Freeze a holder', 'A frozen holder cannot send, receive or redeem', 'Enforced, with an audit record of who and why'],
        ['Holding cap', 'A maximum balance per holder, to protect bank deposits', '10,000 LYDT per holder (adjustable)'],
        ['Verified holders only', 'Only identity-verified customers can hold or receive LYDT', 'Enforced'],
        ['Real-time visibility', 'Supply, reserves, statements and every movement, live', 'Public reserve report; full ledger for supervisors'],
        ['Take over issuance', 'The Bank holds the admin role and can make itself the only issuer', 'Built into the token contract and tested'],
      ],
    },
    phases: {
      eyebrow: 'Technology', title: 'Three phases to a central-bank digital dinar',
      head: ['Phase', 'Where LYDT lives', 'Who issues', 'What moves it forward'],
      rows: [
        ['1 · Pilot', 'tazdan\'s double-entry ledger, with the reserve at the Bank (built)', 'tazdan, under Bank supervision', 'Sandbox admission, reserve account, pilot results'],
        ['2 · Shared ledger', 'A permissioned network the Bank operates, with tazdan and banks as participants; the LYDT contract is written and tested', 'tazdan', 'Bank decision; other banks join as wallets'],
        ['3 · Central-bank dinar', 'The same network', 'The Central Bank of Libya', 'The Bank grants itself the issuer role and revokes tazdan\'s'],
      ],
      contractTitle: 'The token contract (phase 2)',
      contract: 'A standard token (ERC-20) built on audited open-source components, with four roles: the Bank as administrator, supervisor and reserve attester; tazdan as issuer. Three decimal places (millimes). Every rule above is enforced by the contract itself.',
    },
    proto: {
      eyebrow: 'The working sandbox', title: 'What the Bank can test today',
      lead: 'Screens from the current tazdan app with test data. Figures shown are illustrative.',
      screens: [
        ['lydt-home', 'LYDT balance and live reserve report', ['Balance and the peg: 1 LYDT = 1 LYD.', 'Reserve report: LYDT in circulation, dinars attested at the Bank, backing ratio, the latest statement and its reference.', 'Issue, redeem and send from one screen.']],
        ['lydt-issue', 'Converting dinars to LYDT', ['The customer sees exactly what moves: dinars out, the same LYDT in.', 'A review step before confirming; one confirmation per conversion, even on a weak connection.']],
        ['lydt-issued', 'Confirmation with a reference', ['Every issue and redemption carries a reference that matches the ledger entry and the audit trail.']],
        ['pay-merchant', 'Paying a shop by QR code', ['A shop\'s permanent QR code can carry the amount and its own reference.', 'The verified business name is shown before anything moves; LYDT is offered as a payment option once held.']],
        ['pay-receipt', 'An instant receipt at the till', ['The cashier sees the amount, the shop\'s reference and the transfer reference immediately.']],
        ['business-qr', 'Every business gets one QR code', ['A permanent code linked to the business account, printable or saved to Apple Wallet or Google Wallet.', 'Shops can accept LYDT from day one without a card terminal.']],
      ],
    },
    evidence: {
      eyebrow: 'Evidence', title: 'Tested, not described',
      rows: [
        ['Token contract', `${EVIDENCE.contractTests} automated tests pass: reserve limit, stale statements, verified holders only, freezes, pause without blocking redemption, holding cap, and the Bank taking over issuance.`],
        ['LYDT in the tazdan ledger', `${EVIDENCE.serverLydtTests} automated tests against a real database: issuance never exceeds the attested reserve under simultaneous requests; supply always equals the reserve ledger; retries never move money twice; redemption works while paused; frozen holders are blocked.`],
        ['The wider platform', `${EVIDENCE.serverTests} automated tests in ${EVIDENCE.serverSuites} suites pass, covering payments, ledgers, limits, identity and security.`],
      ],
      note: 'Before any live pilot: an independent security test, an independent review of the reserve reconciliation, and the Bank\'s own acceptance testing.',
    },
    risks: {
      eyebrow: 'Risks', title: 'Risks and how the design handles them',
      head: ['Risk', 'Safeguard'],
      rows: [
        ['Deposits leaving banks', 'A per-holder cap and no interest keep LYDT a payment tool, not a savings account.'],
        ['A rush to redeem', 'Every LYDT is backed by a dinar already at the Central Bank; redemption is immediate and never paused for ordinary holders.'],
        ['Money laundering and sanctions', 'Verified holders only, limits by verification level, screening, monitoring and freezes, with a full audit trail.'],
        ['Operational or cyber incident', 'One switch pauses issuance and transfers; reserves sit with the Bank, not tazdan; independent security testing before launch.'],
        ['Legal basis', 'No LYDT is issued to the public without the Bank\'s written authorisation; LYDT is dinars only, with no currency conversion.'],
        ['Concentration on one provider', 'Phase 2 opens the network to other banks as wallets; phase 3 moves issuance to the Bank.'],
      ],
    },
    ask: {
      eyebrow: 'Next steps', title: 'What we ask of the Central Bank',
      items: [
        'Admission of LYDT to a supervised sandbox.',
        'A dedicated LYDT reserve account at the Bank, with a daily statement.',
        'Supervisor access for Bank staff: the live reserve report, the full ledger and the pause and freeze controls.',
        'Agreement on a limited pilot.',
      ],
      pilotTitle: 'Proposed pilot (for discussion)',
      pilot: [['Who', 'Verified tazdan customers and a group of shops in Tripoli'], ['Limits', '10,000 LYDT per holder, adjustable by the Bank'], ['Length', 'Six months, with Bank review at three months'], ['Reporting', 'Daily reserve statements; weekly supply, activity and incident reports'], ['Exit', 'The Bank can end the pilot at any time; all holders redeem to dinars']],
      close: 'We would welcome the opportunity to demonstrate the sandbox to the Bank\'s team.',
    },
  },

  ar: {
    dir: 'rtl', lang: 'ar-LY', file: 'LYDT_Proposal_CBL_2026-11_AR-LY.pdf', font: 'Cairo', head: 'Cairo',
    footer: 'تزدان · مقترح LYDT لمصرف ليبيا المركزي · سرّي', page: `"صفحة " counter(page) " من " counter(pages)`,
    cover: {
      eyebrow: 'مقترح لمصرف ليبيا المركزي · نوفمبر 2026',
      title: 'LYDT: دينار رقمي يقدر المصرف المركزي يراقبه من أول يوم',
      sub: 'تزدان يقترح يصدر LYDT، دينار ليبي رقمي، كل وحدة منه مقابلها دينار محفوظ عند مصرف ليبيا المركزي، تحت رقابة المصرف، وفيه طريق جاهز باش المصرف ياخذ الإصدار بنفسه وقت ما يبي.',
      meta: [['الربط', '1 LYDT = 1 دينار'], ['التغطية', '100% عند المصرف المركزي'], ['التحكم', 'المصرف يوقف ويجمّد ويحدد سقف'], ['الوضع', 'بيئة تجريبية خدامة']],
      legal: 'سرّي. LYDT توا في بيئة تجريبية: ما انصدر منه حتى شي للناس، وما يتصدرش إلا بإذن مكتوب من مصرف ليبيا المركزي. الشاشات فيها بيانات اختبار، والأرقام اللي فيها للتوضيح بس.',
    },
    summary: {
      eyebrow: 'باختصار', title: 'شن نقترحوا',
      lead: 'دينار رقمي يتسوّى في نفس اللحظة، وتقدر تتبّعه من أوله لآخره، وعمره ما يخلق فلوس جديدة: كل LYDT متداول مقابله دينار محفوظ عند المصرف المركزي وموثّق منه.',
      blocks: [
        ['كيف يخدم', 'الزبون يحوّل دنانير من رصيده في تزدان لـLYDT. الدنانير تمشي لحساب احتياطي عند مصرف ليبيا المركزي، وينصدر نفس المبلغ من LYDT. والاسترداد يرجّعها، في أي وقت. وLYDT يتحرك في نفس اللحظة بين الزبائن والمحلات الموثّقة، حتى برمز QR عند الكاشير.'],
        ['شن اللي يتحكم فيه المصرف', 'الإصدار عمره ما يفوت رصيد الاحتياطي اللي وثّقه المصرف آخر مرة، ويوقف لو الكشف قديم. المصرف يقدر يوقف الإصدار والتحويلات، يجمّد أي حائز، يحط سقف لرصيد أي واحد، ويشوف المعروض والاحتياطي وكل حركة في نفس اللحظة. والاسترداد عمره ما يوقف للحائزين العاديين.'],
        ['الطريق لدينار رقمي صادر من المصرف المركزي', 'التصميم يفرّق بين دور المُصدر ودور الرقيب. ووقت ما يقرر المصرف، ياخذ دور المُصدر ويسحبه من تزدان. وهكي يولّي LYDT دينار صادر من المصرف نفسه، على بنية خدامة من قبل، وتزدان واحد من المحافظ اللي توزّعه.'],
        ['شن نطلبوا', 'دخول بيئة تجريبية تحت الرقابة؛ حساب احتياطي عند المصرف؛ صلاحيات رقابة لموظفي المصرف؛ واتفاق على تجربة محدودة (المقترح في آخر صفحة).'],
      ],
    },
    why: {
      eyebrow: 'علاش توا', title: 'شن يحل الدينار الرقمي',
      rows: [
        ['نقص السيولة وطوابير المصارف', 'الدنانير اللي في شكل LYDT تتحرك في نفس اللحظة بين الناس والمحلات بلا عملة ورقية، والدنانير الأصلية تقعد في عهدة المصرف المركزي.'],
        ['مدفوعات برّا المنظومة المصرفية', 'كل حركة LYDT مسجّلة والطرفين معروفين، وهكي المصرف يشوف اللي ما يقدرش يشوفه في الكاش.'],
        ['الشمول المالي', 'أي واحد عنده تلفون وحساب تزدان موثّق يقدر يخلّي دنانير ويبعث ويستلم، بالعربي، بلا بطاقة وبلا ما يمشي لفرع.'],
        ['بلا مخاطر ائتمان جديدة', 'LYDT مغطّى بالكامل عند المصرف المركزي. مش وديعة، وما يجيبش فوائد، وعمره ما ينسلّف.'],
        ['عملة رقمية للمصرف المركزي بلا ما نبدوا من الصفر', 'المصرف ياخذ دينار رقمي خدام وتحت رقابته، يقدر يعتمده كيف ما هو، بدل ما يطلب منصة جديدة من الأول.'],
      ],
    },
    how: {
      eyebrow: 'التصميم', title: 'كيف يخدم LYDT',
      lead: 'أربع حركات، وكل وحدة مسجّلة في دفتر قيد مزدوج ومعاها سجل تدقيق.',
      steps: [
        ['تمويل الاحتياطي', 'تزدان يحط دنانير في حساب احتياطي LYDT عند المصرف المركزي. والمصرف يوثّق الرصيد؛ والكشف هادا هو اللي يحدد أكثر كمية LYDT ممكن تكون موجودة.'],
        ['الإصدار', 'زبون موثّق يحوّل دنانير لـLYDT. رصيده بالدينار ينقص، ودفتر الاحتياطي يزيد بنفس المبلغ، وينصدر LYDT — بشرط إن المعروض الكلي يقعد داخل الاحتياطي الموثّق.'],
        ['الدفع', 'LYDT يتحرك بين الزبائن والمحلات الموثّقة في نفس اللحظة، بنفس الحدود وفحوصات الاحتيال والتحقق من الهوية اللي على أي دفعة في تزدان.'],
        ['الاسترداد', 'الحائز يرجّع LYDT، ونفس الدنانير ترجع لرصيده في نفس اللحظة. والاسترداد يخدم حتى لو الإصدار موقوف.'],
      ],
      invariantTitle: 'القاعدة اللي تتشيّك مع كل عملية',
      invariant: 'LYDT المتداول = الدنانير في دفتر الاحتياطي ≤ الدنانير اللي وثّقها المصرف المركزي',
      diagram: { cust: 'الزبون', custSub: 'رصيده بالدينار', reserve: 'حساب الاحتياطي', reserveSub: 'مصرف ليبيا المركزي', lydt: 'LYDT', lydtSub: 'الزبائن والمحلات', issue: 'إصدار', redeem: 'استرداد', attest: 'يوثّق الرصيد', pay: 'دفع' },
    },
    controls: {
      eyebrow: 'الرقابة', title: 'صلاحيات المصرف، مبنية من الأساس',
      head: ['الصلاحية', 'كيف تخدم', 'في البيئة التجريبية'],
      rows: [
        ['سقف الإصدار', 'المعروض عمره ما يفوت آخر رصيد احتياطي وثّقه المصرف', 'مطبّق مع كل إصدار، حتى لو جوا طلبات مع بعض في نفس الوقت'],
        ['وقف لو الكشف قديم', 'ما فيش إصدار على كشف احتياطي أقدم من 48 ساعة (قابل للتعديل)', 'مطبّق'],
        ['إيقاف', 'مفتاح واحد يوقف الإصدار والتحويلات الجديدة؛ والاسترداد يقعد يخدم', 'مطبّق؛ من لوحة تحكم الموظفين'],
        ['تجميد حائز', 'الحائز المجمّد ما يقدرش يبعث ولا يستلم ولا يسترد', 'مطبّق، ومعاه سجل تدقيق فيه شكون جمّد وعلاش'],
        ['سقف الحيازة', 'أقصى رصيد لكل حائز، باش نحميوا ودائع المصارف', '10,000 LYDT لكل حائز (قابل للتعديل)'],
        ['حائزين موثّقين بس', 'ما يقدرش يخلّي ولا يستلم LYDT إلا الزبائن اللي هويتهم موثّقة', 'مطبّق'],
        ['رؤية مباشرة', 'المعروض والاحتياطي والكشوف وكل حركة، في نفس اللحظة', 'تقرير احتياطي عام؛ والدفتر كامل للرقابة'],
        ['أخذ الإصدار', 'المصرف عنده دور المدير ويقدر يخلّي روحه المُصدر الوحيد', 'مبني في عقد الرمز ومختبَر'],
      ],
    },
    phases: {
      eyebrow: 'التقنية', title: 'ثلاث مراحل لدينار رقمي صادر من المصرف المركزي',
      head: ['المرحلة', 'وين يعيش LYDT', 'شكون يصدر', 'شن ينقّلنا للمرحلة الجاية'],
      rows: [
        ['1 · التجربة', 'دفتر القيد المزدوج متاع تزدان، والاحتياطي عند المصرف (مبني)', 'تزدان، تحت رقابة المصرف', 'دخول البيئة التجريبية، حساب الاحتياطي، ونتايج التجربة'],
        ['2 · دفتر مشترك', 'شبكة بصلاحيات يشغّلها المصرف، وتزدان والمصارف أطراف فيها؛ وعقد LYDT مكتوب ومختبَر', 'تزدان', 'قرار من المصرف؛ والمصارف الثانية تدخل كمحافظ'],
        ['3 · دينار المصرف المركزي', 'نفس الشبكة', 'مصرف ليبيا المركزي', 'المصرف ياخذ دور المُصدر ويسحبه من تزدان'],
      ],
      contractTitle: 'عقد الرمز (المرحلة الثانية)',
      contract: 'رمز قياسي (ERC-20) مبني على مكوّنات مفتوحة المصدر ومدقّقة، وفيه أربع أدوار: المصرف مدير ورقيب وموثّق للاحتياطي؛ وتزدان مُصدر. ثلاث خانات عشرية (المليمات). وكل قاعدة من القواعد اللي فوق يطبّقها العقد نفسه.',
    },
    proto: {
      eyebrow: 'البيئة التجريبية الخدامة', title: 'شن يقدر المصرف يجرّب توا',
      lead: 'شاشات من تطبيق تزدان الحالي فيها بيانات اختبار. والأرقام اللي فيها للتوضيح بس.',
      screens: [
        ['lydt-home', 'رصيد LYDT وتقرير الاحتياطي المباشر', ['الرصيد والربط: 1 LYDT = 1 دينار.', 'تقرير الاحتياطي: LYDT المتداول، الدنانير الموثّقة عند المصرف، نسبة التغطية، وآخر كشف ومرجعه.', 'إصدار واسترداد وإرسال من شاشة وحدة.']],
        ['lydt-issue', 'تحويل الدنانير لـLYDT', ['الزبون يشوف بالضبط شن يتحرك: دنانير طالعة، ونفس المبلغ LYDT داخل.', 'خطوة مراجعة قبل التأكيد؛ وتأكيد واحد لكل تحويل، حتى لو النت ضعيف.']],
        ['lydt-issued', 'تأكيد بمرجع', ['كل إصدار واسترداد عنده مرجع يطابق القيد في الدفتر وسجل التدقيق.']],
        ['pay-merchant', 'الدفع لمحل برمز QR', ['رمز QR الثابت متاع المحل يقدر يحمل المبلغ والمرجع متاعه.', 'اسم النشاط الموثّق يبان قبل ما يتحرك أي شي؛ وLYDT يطلع كطريقة دفع لما يكون عندك.']],
        ['pay-receipt', 'إيصال فوري عند الكاشير', ['الكاشير يشوف المبلغ ومرجع المحل ومرجع التحويل في نفس اللحظة.']],
        ['business-qr', 'كل نشاط تجاري عنده رمز QR واحد', ['رمز ثابت مربوط بحساب النشاط، ينطبع ولا يتحفظ في Apple Wallet ولا Google Wallet.', 'المحلات تقدر تستلم LYDT من أول يوم بلا جهاز بطاقات.']],
      ],
    },
    evidence: {
      eyebrow: 'الأدلة', title: 'مختبَر، مش بس كلام',
      rows: [
        ['عقد الرمز', `${EVIDENCE.contractTests} اختبار آلي ناجح: سقف الاحتياطي، الكشوف القديمة، الحائزين الموثّقين بس، التجميد، الإيقاف بلا ما يوقف الاسترداد، سقف الحيازة، والمصرف ياخذ الإصدار.`],
        ['LYDT في دفتر تزدان', `${EVIDENCE.serverLydtTests} اختبارات آلية على قاعدة بيانات حقيقية: الإصدار عمره ما يفوت الاحتياطي الموثّق حتى مع طلبات في نفس الوقت؛ المعروض ديما يساوي دفتر الاحتياطي؛ إعادة المحاولة عمرها ما تحرّك الفلوس مرتين؛ الاسترداد يخدم وقت الإيقاف؛ والحائز المجمّد ممنوع.`],
        ['المنصة كاملة', `${EVIDENCE.serverTests} اختبار آلي في ${EVIDENCE.serverSuites} مجموعة ناجحين، يغطّوا المدفوعات والدفاتر والحدود والهوية والأمان.`],
      ],
      note: 'قبل أي تجربة حقيقية: اختبار أمني مستقل، ومراجعة مستقلة لمطابقة الاحتياطي، واختبارات القبول متاع المصرف نفسه.',
    },
    risks: {
      eyebrow: 'المخاطر', title: 'المخاطر وكيف التصميم يتعامل معاها',
      head: ['الخطر', 'الحماية'],
      rows: [
        ['خروج الودائع من المصارف', 'سقف لكل حائز وبلا فوائد، باش LYDT يقعد أداة دفع، مش حساب توفير.'],
        ['هجمة على الاسترداد', 'كل LYDT مقابله دينار موجود من قبل عند المصرف المركزي؛ والاسترداد فوري وعمره ما يوقف للحائزين العاديين.'],
        ['غسل الأموال والعقوبات', 'حائزين موثّقين بس، حدود حسب مستوى التوثيق، فحص ومتابعة وتجميد، ومعاهم سجل تدقيق كامل.'],
        ['حادث تشغيلي ولا سيبراني', 'مفتاح واحد يوقف الإصدار والتحويلات؛ الاحتياطي عند المصرف مش عند تزدان؛ واختبار أمني مستقل قبل الإطلاق.'],
        ['الأساس القانوني', 'ما ينصدرش LYDT للناس إلا بإذن مكتوب من المصرف؛ وLYDT دينار بس، بلا أي صرف عملات.'],
        ['الاعتماد على مزوّد واحد', 'المرحلة الثانية تفتح الشبكة للمصارف الثانية كمحافظ؛ والمرحلة الثالثة تنقل الإصدار للمصرف.'],
      ],
    },
    ask: {
      eyebrow: 'الخطوات الجاية', title: 'شن نطلبوا من المصرف المركزي',
      items: [
        'دخول LYDT لبيئة تجريبية تحت الرقابة.',
        'حساب احتياطي خاص بـLYDT عند المصرف، وعليه كشف يومي.',
        'صلاحيات رقابة لموظفي المصرف: تقرير الاحتياطي المباشر، الدفتر كامل، ومفاتيح الإيقاف والتجميد.',
        'اتفاق على تجربة محدودة.',
      ],
      pilotTitle: 'التجربة المقترحة (للنقاش)',
      pilot: [['شكون', 'زبائن تزدان الموثّقين ومجموعة محلات في طرابلس'], ['الحدود', '10,000 LYDT لكل حائز، والمصرف يقدر يعدّلها'], ['المدة', 'ستة شهور، ومراجعة من المصرف بعد ثلاث شهور'], ['التقارير', 'كشوف احتياطي يومية؛ وتقارير أسبوعية عن المعروض والنشاط والحوادث'], ['الخروج', 'المصرف يقدر يوقف التجربة في أي وقت؛ وكل الحائزين يستردوا دنانيرهم']],
      close: 'يسعدنا نعرضوا البيئة التجريبية على فريق المصرف.',
    },
  },
};

function diagram(d, rtl, font) {
  // Customer ⇄ reserve at the CBL; LYDT issued to customers and shops.
  const W = 640, H = 210;
  const box = (x, y, w, title, sub, fill, ink) => `
    <rect x="${x}" y="${y}" width="${w}" height="64" rx="10" fill="${fill}" stroke="#CBD3DC" stroke-width="0.8"/>
    <text x="${x + w / 2}" y="${y + 28}" text-anchor="middle" font-size="13" font-weight="600" fill="${ink}">${esc(title)}</text>
    <text x="${x + w / 2}" y="${y + 47}" text-anchor="middle" font-size="10" fill="${ink === '#FFFFFF' ? '#C9D6E3' : '#66748A'}">${esc(sub)}</text>`;
  const [L, R] = rtl ? [430, 30] : [30, 430];
  const arrow = (x1, x2, y, label, dashed) => `
    <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#24384F" stroke-width="1.4" ${dashed ? 'stroke-dasharray="4 3"' : ''} marker-end="url(#ah)"/>
    <text x="${(x1 + x2) / 2}" y="${y - 6}" text-anchor="middle" font-size="10.5" fill="#3C4A58">${esc(label)}</text>`;
  const cx = (x) => x + 90;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="font-family:${font}" xmlns="http://www.w3.org/2000/svg">
    <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#24384F"/></marker></defs>
    ${box(L, 10, 180, d.cust, d.custSub, '#F3F6F9', '#15202B')}
    ${box(R, 10, 180, d.reserve, d.reserveSub, '#24384F', '#FFFFFF')}
    ${arrow(rtl ? L - 6 : L + 186, rtl ? R + 186 : R - 6, 34, d.issue)}
    ${arrow(rtl ? R + 186 : R - 6, rtl ? L - 6 : L + 186, 62, d.redeem, true)}
    ${box(230, 136, 180, d.lydt, d.lydtSub, '#E3F2EC', '#0F7A55')}
    <line x1="${cx(L)}" y1="80" x2="${rtl ? 400 : 240}" y2="140" stroke="#24384F" stroke-width="1.4" marker-end="url(#ah)"/>
    <text x="${rtl ? 470 : 170}" y="120" text-anchor="middle" font-size="10.5" fill="#3C4A58">${esc(d.issue)}</text>
    <path d="M ${rtl ? 236 : 404} 168 q ${rtl ? -60 : 60} 0 ${rtl ? -60 : 60} -30" fill="none" stroke="#0F7A55" stroke-width="1.2" marker-end="url(#ah)"/>
    <text x="${rtl ? 168 : 472}" y="166" text-anchor="middle" font-size="10.5" fill="#0F7A55">${esc(d.pay)}</text>
    <text x="${cx(R)}" y="96" text-anchor="middle" font-size="10" fill="#66748A">↻ ${esc(d.attest)}</text>
  </svg>`;
}

async function build(loc) {
  const L = T[loc], rtl = loc === 'ar';
  const F = rtl ? 'Cairo' : 'Inter', H = rtl ? 'Cairo' : 'Outfit';
  const img = (id) => 'file://' + path.join(HERE, 'img', loc, id + '.jpg');
  const fontCss = [
    ...[400, 500, 600, 700].map((w) => `@font-face{font-family:'Inter';src:url('file://${FONTS}/Inter-${w}.woff2') format('woff2');font-weight:${w}}`),
    ...[400, 500, 600, 700].map((w) => `@font-face{font-family:'Outfit';src:url('file://${FONTS}/Outfit-latin-${w}.woff2') format('woff2');font-weight:${w}}`),
    ...[400, 500, 600, 700, 800].flatMap((w) => [
      `@font-face{font-family:'Cairo';src:url('file://${FONTS}/Cairo-arabic-${w}.woff2') format('woff2');font-weight:${w};unicode-range:U+0600-06FF,U+0750-077F,U+08A0-08FF,U+200C-200F,U+FB50-FDFF,U+FE70-FEFC}`,
      `@font-face{font-family:'Cairo';src:url('file://${FONTS}/Cairo-latin-${w}.woff2') format('woff2');font-weight:${w};unicode-range:U+0000-00FF,U+2000-206F,U+20AC,U+2190-21FF,U+2212,U+2264}`,
    ]),
  ].join('\n');
  const css = `${fontCss}
  @page{size:A4;margin:20mm 17mm 18mm;
    @bottom-${rtl ? 'right' : 'left'}{content:"${L.footer}";font-family:${F};font-size:7pt;color:#7A8796}
    @bottom-${rtl ? 'left' : 'right'}{content:${L.page};font-family:${F};font-size:7pt;color:#7A8796}}
  @page :first{margin:0;@bottom-left{content:none}@bottom-right{content:none}}
  *{box-sizing:border-box}
  html,body{margin:0;background:#fff}
  body{font-family:${F},sans-serif;font-size:${rtl ? 9.6 : 9.2}pt;line-height:${rtl ? 1.75 : 1.55};color:#15202B;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .cover{width:210mm;height:297mm;position:relative;overflow:hidden;color:#fff;background:linear-gradient(160deg,#0F1B29 0%,#16283B 50%,#24384F 100%);padding:22mm 20mm 20mm;display:flex;flex-direction:column;break-after:page}
  .cover .logo{height:9mm;width:auto;align-self:flex-start}
  .cover .eyebrow{color:#9FB2C6;margin-top:auto}
  .cover h1{font-family:${H};font-weight:${rtl ? 700 : 600};font-size:${rtl ? 28 : 30}pt;line-height:${rtl ? 1.4 : 1.12};margin:4mm 0 5mm;max-width:165mm}
  .cover .sub{font-size:12pt;line-height:1.6;color:#C9D6E3;max-width:155mm;margin:0}
  .cover .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:6mm;margin-top:14mm;padding-top:5mm;border-top:.6px solid rgba(255,255,255,.22);font-size:8.4pt;color:#9FB2C6}
  .cover .meta b{display:block;color:#fff;font-weight:600;font-size:11.5pt;margin-top:1mm}
  .cover .legal{font-size:7.4pt;color:#8DA0B4;margin-top:9mm;max-width:165mm;line-height:1.6}
  .cover .ring{position:absolute;${rtl ? 'left' : 'right'}:-48mm;top:30mm;width:150mm;height:150mm;border-radius:50%;border:.7px solid rgba(255,255,255,.07)}
  .cover .ring.r2{${rtl ? 'left' : 'right'}:-22mm;top:56mm;width:98mm;height:98mm}
  .section{break-before:page}
  .eyebrow{font-size:7.4pt;font-weight:600;letter-spacing:${rtl ? 0 : '.13em'};text-transform:uppercase;color:#66748A;margin-bottom:1.5mm}
  h1.h{font-family:${H};font-weight:${rtl ? 700 : 600};font-size:20pt;line-height:1.25;color:#24384F;margin:0 0 3mm}
  h2{font-family:${H};font-weight:${rtl ? 700 : 600};font-size:12pt;margin:5mm 0 1.8mm;color:#15202B;break-after:avoid}
  p{margin:0 0 2.4mm}
  .lead{font-size:10.6pt;line-height:1.6;color:#3C4A58;margin-bottom:4mm}
  ul,ol{margin:0 0 3mm;padding-${rtl ? 'right' : 'left'}:5mm;padding-${rtl ? 'left' : 'right'}:0}
  li{margin:0 0 1.4mm}
  li::marker{color:#9AA6B4}
  .note{font-size:7.8pt;line-height:1.55;color:#66748A}
  b{font-weight:600}
  table{width:100%;border-collapse:collapse;font-size:8.5pt;line-height:1.5;margin:2mm 0 4mm}
  th{text-align:start;font-weight:600;color:#66748A;font-size:7.2pt;border-bottom:1.1px solid #15202B;padding:1.5mm 2mm}
  td{border-bottom:.5px solid #DDE3EA;padding:1.8mm 2mm;vertical-align:top}
  tr{break-inside:avoid}
  .blocks{display:grid;grid-template-columns:1fr 1fr;gap:5mm 8mm;margin-top:2mm}
  .block h2{margin-top:0}
  .rule{background:#24384F;color:#fff;border-radius:3mm;padding:4mm 5mm;margin:4mm 0}
  .rule .k{font-size:7.4pt;color:#9FB2C6;letter-spacing:${rtl ? 0 : '.1em'};text-transform:uppercase}
  .rule .v{font-family:${H};font-size:12.5pt;font-weight:600;margin-top:1mm}
  .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm}
  .step{background:#F3F6F9;border-radius:2.4mm;padding:3.5mm}
  .step .n{font-family:${rtl ? 'Cairo' : 'Outfit'};color:#24384F;font-weight:700;font-size:13pt}
  .step b{display:block;margin:1mm 0 1mm}
  .shots{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm;break-inside:avoid}
  .shot{display:block;width:100%;border-radius:5mm;border:.6px solid #CBD3DC;box-shadow:0 1mm 4mm rgba(15,27,41,.12);margin-bottom:3mm}
  .screen h3{font-family:${H};font-size:10.5pt;font-weight:${rtl ? 700 : 600};margin:0 0 1mm}
  .screen ul{font-size:${rtl ? 8.4 : 8.1}pt}
  .ask{background:#F3F6F9;border-radius:3mm;padding:4mm 5mm;margin-top:4mm}
  `;

  const S = L.proto.screens;
  const screen = ([id, title, bullets]) => `<div class="screen"><img class="shot" src="${img(id)}"/><h3>${esc(title)}</h3><ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></div>`;

  const html = `<!doctype html><html lang="${L.lang}" dir="${L.dir}"><head><meta charset="utf-8"><style>${css}</style></head><body>
  <div class="cover">
    <img class="logo" src="file://${path.join(ROOT, 'client/public/logo-white.png')}"/>
    <div class="ring"></div><div class="ring r2"></div>
    <div class="eyebrow">${esc(L.cover.eyebrow)}</div>
    <h1>${esc(L.cover.title)}</h1>
    <p class="sub">${esc(L.cover.sub)}</p>
    <div class="meta">${L.cover.meta.map(([k, v]) => `<div>${esc(k)}<b>${esc(v)}</b></div>`).join('')}</div>
    <div class="legal">${esc(L.cover.legal)}</div>
  </div>

  <div>
    <div class="eyebrow">${esc(L.summary.eyebrow)}</div>
    <h1 class="h">${esc(L.summary.title)}</h1>
    <p class="lead">${esc(L.summary.lead)}</p>
    <div class="blocks">${L.summary.blocks.map(([h, t]) => `<div class="block"><h2>${esc(h)}</h2><p>${esc(t)}</p></div>`).join('')}</div>
    <div class="eyebrow" style="margin-top:7mm">${esc(L.why.eyebrow)}</div>
    <h1 class="h">${esc(L.why.title)}</h1>
    <table><tbody>${L.why.rows.map(([k, v]) => `<tr><td style="width:30%"><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
  </div>

  <div class="section">
    <div class="eyebrow">${esc(L.how.eyebrow)}</div>
    <h1 class="h">${esc(L.how.title)}</h1>
    <p class="lead">${esc(L.how.lead)}</p>
    ${diagram(L.how.diagram, rtl, F)}
    <div class="steps" style="margin-top:4mm">${L.how.steps.map(([h, t], i) => `<div class="step"><div class="n">${i + 1}</div><b>${esc(h)}</b>${esc(t)}</div>`).join('')}</div>
    <div class="rule"><div class="k">${esc(L.how.invariantTitle)}</div><div class="v">${esc(L.how.invariant)}</div></div>
  </div>

  <div class="section">
    <div class="eyebrow">${esc(L.controls.eyebrow)}</div>
    <h1 class="h">${esc(L.controls.title)}</h1>
    <table><thead><tr>${L.controls.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${L.controls.rows.map(([a, b, c]) => `<tr><td style="width:22%"><b>${esc(a)}</b></td><td style="width:45%">${esc(b)}</td><td>${esc(c)}</td></tr>`).join('')}</tbody></table>
    <div class="eyebrow" style="margin-top:6mm">${esc(L.phases.eyebrow)}</div>
    <h1 class="h">${esc(L.phases.title)}</h1>
    <table><thead><tr>${L.phases.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${L.phases.rows.map(([a, b, c, d]) => `<tr><td style="width:18%"><b>${esc(a)}</b></td><td style="width:36%">${esc(b)}</td><td style="width:20%">${esc(c)}</td><td>${esc(d)}</td></tr>`).join('')}</tbody></table>
    <h2>${esc(L.phases.contractTitle)}</h2><p>${esc(L.phases.contract)}</p>
  </div>

  <div class="section">
    <div class="eyebrow">${esc(L.proto.eyebrow)}</div>
    <h1 class="h">${esc(L.proto.title)}</h1>
    <p class="lead">${esc(L.proto.lead)}</p>
    <div class="shots">${S.slice(0, 3).map(screen).join('')}</div>
  </div>
  <div class="section">
    <div class="shots">${S.slice(3).map(screen).join('')}</div>
  </div>

  <div class="section">
    <div class="eyebrow">${esc(L.evidence.eyebrow)}</div>
    <h1 class="h">${esc(L.evidence.title)}</h1>
    <table><tbody>${L.evidence.rows.map(([k, v]) => `<tr><td style="width:24%"><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
    <p class="note">${esc(L.evidence.note)}</p>
    <div class="eyebrow" style="margin-top:6mm">${esc(L.risks.eyebrow)}</div>
    <h1 class="h">${esc(L.risks.title)}</h1>
    <table><thead><tr>${L.risks.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${L.risks.rows.map(([a, b]) => `<tr><td style="width:30%"><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join('')}</tbody></table>
  </div>

  <div class="section">
    <div class="eyebrow">${esc(L.ask.eyebrow)}</div>
    <h1 class="h">${esc(L.ask.title)}</h1>
    <ol>${L.ask.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
    <div class="ask">
      <h2 style="margin-top:0">${esc(L.ask.pilotTitle)}</h2>
      <table style="margin-bottom:0"><tbody>${L.ask.pilot.map(([k, v]) => `<tr><td style="width:22%"><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
    </div>
    <p style="margin-top:6mm">${esc(L.ask.close)}</p>
    <p class="note" style="margin-top:6mm">${esc(L.cover.legal)}</p>
  </div>
  </body></html>`;

  const htmlFile = path.join(HERE, `out/${loc}.html`);
  await fs.mkdir(path.dirname(htmlFile), { recursive: true });
  await fs.writeFile(htmlFile, html);
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const page = await browser.newPage();
    await page.goto('file://' + htmlFile, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(ROOT, 'deliverables', L.file);
    await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
    console.log(out);
  } finally { await browser.close(); }
}

for (const loc of process.argv[2] ? [process.argv[2]] : ['en', 'ar']) await build(loc);
