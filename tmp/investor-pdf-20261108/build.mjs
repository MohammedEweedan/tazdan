// Investor overview PDFs, Nov 2026 — English and Libyan Arabic.
// Figures: tmp/investor-pack-20261017/financial-results.json (the Oct model,
// built for $10M primary); free cash is restated for $8M by subtracting $2M,
// since the model's free cash is funding less uses. Screens: capture.mjs.
// Usage: node build.mjs [en|ar]
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../..');
const require = createRequire(path.join(ROOT, 'client/scripts/app-media/package.json'));
const { chromium } = require('playwright-core');
const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const FONTS = path.join(ROOT, 'client/public/fonts');
const fin = JSON.parse(await fs.readFile(path.join(ROOT, 'tmp/investor-pack-20261017/financial-results.json'), 'utf8'));
const CASES = ['Downside', 'Base', 'Growth'];
const Y = (c) => fin.caseResults[c].years;
const COLORS = { Downside: '#eb6834', Base: '#2a78d6', Growth: '#1baf7a' }; // validated categorical slots, fixed order

// Deal (owner, 2026-11-08): $8M to the two founders for 20% of their shares
// (secondary, never company money) + $11M of new shares (primary), both at a
// $40M pre-money price per share.
const PRE = 40e6, SECONDARY = 8e6, PRIMARY = 11e6, POST = PRE + PRIMARY, MODEL_FUNDING = 10e6;
const OWN = { bought: (SECONDARY / PRE) * (PRE / POST), fresh: PRIMARY / POST };
OWN.total = OWN.bought + OWN.fresh; OWN.founders = 1 - OWN.total;
const pct = (x) => (x * 100).toFixed(1) + '%';
// The model's free cash is funding less uses, so it shifts one-for-one with the primary amount.
const freeCash = (c) => Y(c).map((y) => y.free - (MODEL_FUNDING - PRIMARY));
const PEAK = fin.caseResults.Base.peakPrefund;
const COV4 = (100 * Y('Base')[3].revenue / (Y('Base')[3].revenue - Y('Base')[3].op)).toFixed(0);
const cumLoss = (c) => Y(c).reduce((a, y) => a + Math.min(0, y.result), 0);
const fee = Object.fromEntries(fin.feeExample.filter((r) => r[0]));
const param = Object.fromEntries(fin.params.map((p) => [p.key, p.base]));
// Contribution per transfer is linear in its size (the $1,000 worked example):
// retained revenue less the proportional rail, loss and slippage costs, less
// the fixed rail fee. Lifetime value = transfers a month × contribution ÷ churn.
const perDollar = (fee['Retained revenue USD'] - (fee['Rail fee USD'] - param.providerFixed) - fee['Expected loss USD'] - fee['FX slippage USD']) / 1000;
const ltvAt = (ticket) => param.frequency * (perDollar * ticket - param.providerFixed) / param.churn;
const paybackAt = (ticket) => param.cac / (param.frequency * (perDollar * ticket - param.providerFixed));
const INTL_TICKET = 5500; // owner's figure: $418 lifetime value for international transfers
if (Math.abs(ltvAt(param.ticket) - fee['Indicative contribution LTV']) > 0.5) throw Error('LTV formula drifted from the model');
const STATS = { screens: 88, routes: 424, models: 97, migrations: 59, suites: 51, tests: 398 };

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const m = (v, d = 2) => `${v < 0 ? '−' : ''}$${(Math.abs(v) / 1e6).toFixed(d)}M`;
const int = (v) => Math.round(v).toLocaleString('en-US');
const ltr = (s) => `<span class="ltr">${s}</span>`;
// Arabic running text says "دولار" rather than mixing "$" into RTL words.
const mAr = (v, d = 2) => `${v < 0 ? '−' : ''}${(Math.abs(v) / 1e6).toFixed(d)} مليون دولار`;

// ── Copy ─────────────────────────────────────────────────────────────
const T = {
  en: {
    dir: 'ltr', lang: 'en', file: 'Tazdan_Investor_2026-11_EN.pdf', font: 'Inter', head: 'Outfit',
    footer: 'tazdan · Investor overview · Confidential', page: (n) => `counter(page) " / " counter(pages)`,
    cover: {
      eyebrow: 'Investor overview · November 2026',
      title: 'Pay, send and hold money at the real rate. Built for Libya.',
      sub: 'tazdan is a Libyan money app: pay shops by QR or @username, send to people, hold dinars and dollars side by side, and run a business account, in Arabic and English.',
      meta: [['Total round', '$19,000,000'], ['Into the company', '$11M of new shares'], ['To the founders', '$8M for 20% of their shares'], ['Investor ends with', pct(OWN.total)]],
      legal: 'Confidential. For discussion with prospective investors only; not an offer of securities. Projections are model estimates, not forecasts or promises. Screens show a demo account with fictional people, businesses and balances.',
    },
    glance: {
      eyebrow: 'At a glance', title: 'One app for everyday money in Libya',
      lead: 'Libyans juggle cash, bank queues and two exchange rates. tazdan puts payments, transfers, savings and the real market rate in one app, with business accounts that let any shop accept payment from a single QR code.',
      kpis: [[String(STATS.screens), 'app screens, Arabic and English'], [String(STATS.routes), 'API routes'], [String(STATS.models), 'data models, ' + STATS.migrations + ' migrations'], [String(STATS.tests), 'automated tests in ' + STATS.suites + ' suites']],
      h1: 'Why now',
      why: [
        'Demand for foreign currency is large: the Central Bank of Libya reports <b>$19.34 billion</b> of foreign-exchange use in January–September 2026, <b>$6.51 billion</b> of it for personal purposes and <b>$2.68 billion</b> for transfers.',
        'Everyday prices follow the parallel market, yet most apps show the official rate. tazdan shows a live market rate and the spread, before anyone confirms.',
        'Shops still run on cash. A permanent QR code, a Wallet card and an instant receipt make accepting digital payment as simple as showing a sticker.',
      ],
      h2: 'What is built', built: 'The product is built and tested end to end: payments and the Pay tab, multi-currency wallets, chat with payments, savings goals, business accounts with bulk pay and approvals, an exchange flow, remittance corridors in sandbox, a staff control cockpit with maker-checker and kill switches, and home-screen widgets.',
      h3: 'Where it stands', stands: 'Pre-launch. Real-money activity stays switched off in production until nine release gates are cleared with evidence: authorisation, providers, safeguarding, treasury, security, money paths, device QA, recovery and operations. The licence process with the Central Bank of Libya is in progress; bank partners are in discussion.',
      h4: 'The ask', ask: `<b>$19 million in total.</b> $11 million of new shares funds the company for its first three years: launch, licensing, the team and payout liquidity. $8 million buys 20% of the founders' existing shares and is paid to the founders, not the company. Both parts are priced at $40 million pre-money; the investor ends with ${pct(OWN.total)}.`,
      source: 'Source: Central Bank of Libya, uses of foreign exchange report (cbl.gov.ly/uses-of-foreign-exch), January–September 2026.',
    },
    tour: { eyebrow: 'Product', title: 'The app, screen by screen', lead: 'Captured from the current build. Every screen is real; the account, people, shops and balances are fictional. Status shows what is live in the code today and what waits for a partner, licence or switch.', demo: 'Demo account · fictional data' },
    also: { title: 'Also built', items: ['Claim links: send to someone not yet on tazdan; they join to claim', 'Audit-ready PDF statements by period and currency', 'Referrals with tracked invites', 'Home-screen widgets for payments, chats and prices (iOS and Android; ships with the next native build)', 'Cards: virtual and physical controls (off until an issuer signs)', 'Recurring buys and digital-asset trading (real-money execution switched off)', 'Control cockpit for staff: roles and permissions, maker-checker, sanctions lists, fund-integrity checks, exposure limits and kill switches'] },
    model: {
      eyebrow: 'Business model', title: 'How tazdan earns',
      lead: 'Three revenue lines in the model, plus merchant payments as upside that the numbers below do not include.',
      rows: [
        ['Cross-border transfers and FX', 'A 0.10% fee plus a 0.35% markup on the reference rate (base case), kept under a 0.50% all-in guardrail.'],
        ['Business software', 'Subscriptions for institutions using the platform: $120,000 a year in the base case, after a $25,000 paid pilot.'],
        ['Projects', 'Integration and rollout work for business clients.'],
        ['Merchant payments (not in the model)', 'Paying a shop inside tazdan is free today, to win the habit. Merchant pricing is upside on top of these projections.'],
      ],
      exTitle: 'Worked example: one transfer (base pricing)',
      ex: [
        ['Customer sends', '6,000 LYD'], ['Explicit fee (0.10%)', '6 LYD'], ['Recipient receives', `$${fee['Recipient receives USD'].toFixed(2)}`],
        ['Gross revenue', `$${fee['Gross revenue USD'].toFixed(2)}`], ['Partner share', `($${fee['Partner share USD'].toFixed(2)})`], ['Retained revenue', `$${fee['Retained revenue USD'].toFixed(2)}`],
        ['Payout rail, expected loss and FX slippage', `($${(fee['Rail fee USD'] + fee['Expected loss USD'] + fee['FX slippage USD']).toFixed(2)})`], ['Contribution per transfer', `$${fee['Contribution per transfer USD'].toFixed(2)}`],
      ],
      exNote: `The model uses a reference rate of 6 LYD per dollar for this example. All-in charge to the customer: ${(fee['All-in consumer charge rate'] * 100).toFixed(2)}%.`,
      honest: `<b>Lifetime value of an international-transfer customer: about $${ltvAt(INTL_TICKET).toFixed(0)}</b> at an average transfer of $${int(INTL_TICKET)} (1.3 transfers a month, 3.5% monthly attrition), against a $${param.cac} acquisition cost recovered in about ${paybackAt(INTL_TICKET).toFixed(0)} months. The five-year projections deliberately use a lower $${param.ticket} average; at that size a customer contributes about $${ltvAt(param.ticket).toFixed(0)}, which is why business software carries the margin in the numbers that follow.`,
    },
    fin: {
      eyebrow: 'Financial projections', title: 'Five years, three cases',
      lead: 'From the 60-month operating model. The base case reaches operating breakeven in year 5; the growth case is profitable from year 2. These are estimates built on stated assumptions, not forecasts.',
      revTitle: 'Revenue by year, $ millions', opTitle: 'Operating result by year, $ millions (after launch setup costs)',
      cases: { Downside: 'Downside', Base: 'Base', Growth: 'Growth' }, year: (i) => `Year ${i + 1}`,
      table: ['Case', 'Revenue Y1', 'Revenue Y3', 'Revenue Y5', 'Result Y5', '5-yr result', 'Customers Y5', 'Business clients Y5'],
      assumptionsTitle: 'Key assumptions (base case)',
      assumptions: [
        'Launch in month 6; 10 staff in year 1 rising to 22 by year 5, at $4,000 loaded cost a month.',
        'Average transfer $750, 1.3 transfers per active customer a month, 3.5% monthly attrition, $30 to acquire a customer.',
        'Pricing 0.10% fee + 0.35% FX markup; 10% partner share; payout costs and expected losses deducted.',
        'Business clients from month 4, one new client a month on average; $120,000 a year each.',
        'Settlement prefunding: 5 days of converted volume × 1.5 for stress, funded with the company\'s own capital — never customer money.',
      ],
      cashTitle: 'What the $11 million funds',
      cash: (b, g, d) => `The $11 million of new money is sized for three years. In the base case the company still holds <b>${m(b[2])}</b> of free cash at the end of year 3, after its operating losses, a $1 million regulatory reserve and payout prefunding. From year 4 revenue pays the running costs — <b>${COV4}%</b> of them in year 4, with breakeven in year 5 — so no further equity is needed: free cash is still <b>${m(b[4])}</b> at the end of year 5 while payout prefunding grows to ${m(PEAK, 1)}. Prefunding is working capital that comes back when volume falls or a bank facility replaces it. The growth case is profitable from year 2, but its prefunding grows with volume, so it needs a settlement facility of about ${m(-g[4], 1)} by year 5; the downside case keeps ${m(d[4], 1)} of free cash. The $8 million share purchase goes to the founders and is not part of these figures.`,
    },
    risk: {
      eyebrow: 'Status and risks', title: 'What has to be true before launch',
      lead: 'Stated plainly, because they decide the timeline. The code enforces the first one: production refuses new money activity until every gate has dated, reviewed evidence.',
      head: ['Area', 'Where it stands', 'What clears it'],
      rows: [
        ['Licence', 'Process with the Central Bank of Libya in progress', 'Issued permission or an approved regulated-partner arrangement'],
        ['Partners', 'Bank accounts, payout partners and a card issuer not yet signed; banks in discussion', 'Signed agreements and tested connections, corridor by corridor'],
        ['Liquidity', 'Payout pools need the company\'s own capital', 'This round covers the base case; a settlement facility if volume grows faster'],
        ['Ledger', 'A historic ~2,444 USDT discrepancy in test data is being investigated', 'Independent explanation and approved correcting entries before launch'],
        ['Security', 'Hardened, with automated tests; no external penetration test yet', 'Independent test, fixes, and secret rotation'],
        ['Team', 'Small founding team; key-person dependency', 'Hiring funded by this round'],
        ['Market', 'FX policy changes can move the parallel rate and demand', 'Diversified revenue: business software and merchant payments'],
      ],
    },
    ask: {
      eyebrow: 'The ask', title: '$19 million: $11M into the company, $8M to the founders',
      terms: [['Total', '$19,000,000'], ['New money (primary)', '$11,000,000 of new shares, funding the company for three years'], ['Share purchase (secondary)', '$8,000,000 paid to the two founders for 20% of their existing shares. This money goes to the founders, not the company.'], ['Price', '$40 million pre-money for both parts (the same price per share) · $51 million post-money'], ['Ownership after closing', `Investor ${pct(OWN.total)} (${pct(OWN.bought)} bought from the founders + ${pct(OWN.fresh)} new shares) · founders ${pct(OWN.founders)}`], ['Focus', 'Libya in years 1–3; North Africa and the Gulf from year 4'], ['Governance', 'To be agreed in the term sheet'], ['Conditions', 'Due diligence, definitive agreements, investor KYC, anti-money-laundering and sanctions screening, and any regulatory approvals required. The share purchase and the new money close together.']],
      useTitle: 'Use of the $11 million',
      use: [
        ['Settlement prefunding and payout liquidity', 6.2e6, `The company's own money in payout pools so recipients are paid on time. Covers the base-case peak (${m(PEAK)} in year 5) without a bank facility. Recoverable working capital.`],
        ['Operating runway, years 1–3', 2.1e6, 'Team, compliance, technology and marketing until revenue covers costs. Base-case cumulative operating losses: ' + m(-cumLoss('Base')) + ' over five years, including launch setup.'],
        ['Regulatory and partner collateral', 1.0e6, 'Reserves and deposits that licensing and payout partners require.'],
        ['Contingency', 1.7e6, 'Delays in licensing or partner onboarding, or faster growth.'],
      ],
      milestonesTitle: 'What the new money funds',
      milestones: [
        'Licence, or an approved regulated-partner arrangement, for payments and FX in Libya.',
        'Clear the nine release gates and switch on real money for a scoped pilot.',
        'Roll out Pay and the business QR with the first verified businesses.',
        'First live cross-border corridor with a licensed payout partner.',
        `Base-case plan: about ${int(Y('Base')[1].active)} active customers and ${m(Y('Base')[1].revenue)} revenue in year 2.`,
        `From year 4, revenue pays the running costs: ${COV4}% of them in year 4 and breakeven in year 5 (base case).`,
      ],
      total: 'Total',
    },
    chip: { ready: 'Built', partner: 'Waits on a partner', off: 'Off in production' },
  },

  ar: {
    dir: 'rtl', lang: 'ar-LY', file: 'Tazdan_Investor_2026-11_AR-LY.pdf', font: 'Cairo', head: 'Cairo',
    footer: 'تزدان · عرض للمستثمرين · سرّي', page: () => `"صفحة " counter(page) " من " counter(pages)`,
    cover: {
      eyebrow: 'عرض للمستثمرين · نوفمبر 2026',
      title: 'ادفع وابعث وخلّي فلوسك بالسعر الحقيقي. مبني لليبيا.',
      sub: 'تزدان (tazdan) تطبيق فلوس ليبي: تدفع للمحلات برمز QR ولا بـ@اسم المستخدم، تبعث للناس، تخلّي الدينار والدولار جنب بعض، وتدير حساب لنشاطك التجاري، بالعربي والإنجليزي.',
      meta: [['مجموع الجولة', '19 مليون دولار'], ['للشركة', '11 مليون دولار أسهم جديدة'], ['للمؤسسين', '8 مليون دولار مقابل 20% من أسهمهم'], ['حصة المستثمر في الآخر', pct(OWN.total)]],
      legal: 'سرّي. للنقاش مع المستثمرين المحتملين بس، وهو مش عرض لبيع أوراق مالية. التوقعات تقديرات من نموذج مالي، مش وعود. الشاشات من حساب تجريبي فيه ناس ومحلات وأرصدة وهمية.',
    },
    glance: {
      eyebrow: 'باختصار', title: 'تطبيق واحد لفلوس الناس اليومية في ليبيا',
      lead: 'الليبيين عايشين بين الكاش وطوابير المصارف وسعرين للدولار. تزدان يجمع الدفع والتحويل والادخار والسعر الحقيقي للسوق في تطبيق واحد، وفيه حسابات للأنشطة التجارية تخلّي أي محل يستلم الفلوس من رمز QR واحد.',
      kpis: [[String(STATS.screens), 'شاشة في التطبيق، عربي وإنجليزي'], [String(STATS.routes), 'مسار API'], [String(STATS.models), `نموذج بيانات، و${STATS.migrations} ترحيل`], [String(STATS.tests), `اختبار آلي في ${STATS.suites} مجموعة`]],
      h1: 'علاش توا',
      why: [
        `الطلب على العملة الأجنبية كبير هلبا: مصرف ليبيا المركزي يقول إن استخدامات النقد الأجنبي من يناير لسبتمبر 2026 وصلت <b>19.34 مليار دولار</b>، منها <b>6.51 مليار دولار</b> للأغراض الشخصية و<b>2.68 مليار دولار</b> للحوالات.`,
        'الأسعار اليومية ماشية مع السوق الموازي، لكن أغلب التطبيقات توريك السعر الرسمي. تزدان يوريك سعر السوق الحي والفرق (السبريد) قبل ما حد يأكّد.',
        'المحلات مازالت تخدم بالكاش. رمز QR ثابت، وبطاقة في المحفظة، وإيصال في نفس اللحظة، يخلّوا استلام الدفع الرقمي ساهل كيف إنك توري ملصق.',
      ],
      h2: 'شن بنينا', built: 'المنتج مبني ومختبَر من أوله لآخره: الدفع وتبويب «ادفع»، محافظ بعملات متعددة، دردشة فيها دفع، أهداف ادخار، حسابات تجارية بدفع جماعي وموافقات، الصرف، ممرات تحويل للخارج في بيئة تجريبية، لوحة تحكم للموظفين فيها مُنشئ ومُراجع ومفاتيح إيقاف، وودجت على الشاشة الرئيسية.',
      h3: 'وين وصلنا', stands: 'قبل الإطلاق. الحركة بالفلوس الحقيقية مقفولة في الإنتاج لين تتفتح تسع بوابات إطلاق بأدلة: الترخيص، المزوّدين، حماية أموال الزبائن، الخزينة، الأمان، مسارات الفلوس، اختبار الأجهزة، الاسترجاع والتشغيل. إجراءات الترخيص مع مصرف ليبيا المركزي ماشية، والمصارف الشريكة في مرحلة نقاش.',
      h4: 'شن نبوا', ask: `<b>19 مليون دولار في المجموع.</b> 11 مليون دولار أسهم جديدة تموّل الشركة أول ثلاث سنين: الإطلاق، الترخيص، الفريق وسيولة الصرف. و8 مليون دولار يشري بيها المستثمر 20% من أسهم المؤسسين الحالية، وتمشي للمؤسسين مش للشركة. الجزئين بنفس السعر، قيمة الشركة 40 مليون دولار قبل الاستثمار، والمستثمر يطلع بـ${pct(OWN.total)}.`,
      source: 'المصدر: مصرف ليبيا المركزي، تقرير استخدامات النقد الأجنبي (cbl.gov.ly/uses-of-foreign-exch)، يناير–سبتمبر 2026.',
    },
    tour: { eyebrow: 'المنتج', title: 'التطبيق شاشة بشاشة', lead: 'الصور من النسخة الحالية. كل شاشة حقيقية، أما الحساب والناس والمحلات والأرصدة فهي وهمية. الحالة توريك شن اللي خدام في الكود توا، وشن اللي يستنى شريك ولا ترخيص ولا تفعيل.', demo: 'حساب تجريبي · بيانات وهمية' },
    also: { title: 'وزادة مبني', items: ['روابط استلام: تبعث فلوس لحد مش عنده تزدان، يسجّل ويستلمها', 'كشوف حساب PDF جاهزة للتدقيق حسب الفترة والعملة', 'دعوات الأصحاب مع متابعة الدعوات', 'ودجت على الشاشة الرئيسية للمدفوعات والدردشات والأسعار (iOS وAndroid، تنزل مع النسخة الجاية)', 'البطاقات: تحكّم في البطاقات الافتراضية والفعلية (مقفولة لين يمضي مُصدر بطاقات)', 'الشراء الدوري وتداول الأصول الرقمية (التنفيذ بفلوس حقيقية مقفول)', 'لوحة تحكم للموظفين: أدوار وصلاحيات، مُنشئ ومُراجع، قوائم العقوبات، فحص سلامة الأموال، حدود التعرّض ومفاتيح إيقاف'] },
    model: {
      eyebrow: 'نموذج العمل', title: 'كيف تزدان يكسب',
      lead: 'ثلاث مصادر دخل في النموذج، وزادة مدفوعات المحلات كمكسب إضافي مش محسوب في الأرقام اللي تحت.',
      rows: [
        ['التحويل للخارج والصرف', 'رسوم 0.10% وهامش 0.35% على السعر المرجعي (السيناريو الأساسي)، وتحت سقف إجمالي 0.50%.'],
        ['برمجيات للأنشطة التجارية', `اشتراكات للمؤسسات اللي تستعمل المنصة: 120,000 دولار في السنة في السيناريو الأساسي، بعد تجربة مدفوعة بـ25,000 دولار.`],
        ['مشاريع', 'شغل ربط وإطلاق للعملاء التجاريين.'],
        ['مدفوعات المحلات (مش في النموذج)', 'الدفع لمحل داخل تزدان مجاني توا، باش الناس تتعوّد عليه. تسعير المحلات مكسب زيادة فوق التوقعات هادي.'],
      ],
      exTitle: 'مثال محسوب: تحويل واحد (التسعير الأساسي)',
      ex: [
        ['الزبون يبعث', '6,000 د.ل'], ['الرسوم الظاهرة (0.10%)', '6 د.ل'], ['المستلم ياخذ', `${fee['Recipient receives USD'].toFixed(2)} $`],
        ['إجمالي الإيراد', `${fee['Gross revenue USD'].toFixed(2)} $`], ['نصيب الشريك', `(${fee['Partner share USD'].toFixed(2)} $)`], ['الإيراد الصافي', `${fee['Retained revenue USD'].toFixed(2)} $`],
        ['تكلفة الصرف والخسارة المتوقعة وفرق السعر', `(${(fee['Rail fee USD'] + fee['Expected loss USD'] + fee['FX slippage USD']).toFixed(2)} $)`], ['المساهمة من كل تحويل', `${fee['Contribution per transfer USD'].toFixed(2)} $`],
      ],
      exNote: `النموذج يستعمل سعر مرجعي 6 د.ل للدولار في المثال هادا. إجمالي اللي يدفعه الزبون: ${(fee['All-in consumer charge rate'] * 100).toFixed(2)}%.`,
      honest: `<b>قيمة زبون التحويلات الدولية على عمره: حوالي ${ltvAt(INTL_TICKET).toFixed(0)} دولار</b> لما يكون متوسط التحويل ${int(INTL_TICKET)} دولار (1.3 تحويل في الشهر، و3.5% يبطّلوا كل شهر)، مقابل ${param.cac} دولار تكلفة جلبه ترجع في حوالي ${paybackAt(INTL_TICKET).toFixed(0)} شهر. توقعات الخمس سنين تستعمل عن قصد متوسط أقل، ${param.ticket} دولار؛ وبالحجم هادا الزبون يساهم بحوالي ${ltvAt(param.ticket).toFixed(0)} دولار، وهادا علاش البرمجيات للأنشطة التجارية هي اللي تشيل الهامش في الأرقام الجاية.`,
    },
    fin: {
      eyebrow: 'التوقعات المالية', title: 'خمس سنين، ثلاث سيناريوهات',
      lead: 'من نموذج تشغيلي على 60 شهر. السيناريو الأساسي يوصل لنقطة التعادل التشغيلي في السنة الخامسة، وسيناريو النمو يربح من السنة الثانية. هادي تقديرات مبنية على فرضيات واضحة، مش توقعات مضمونة.',
      revTitle: 'الإيرادات حسب السنة، بالمليون دولار', opTitle: 'النتيجة التشغيلية حسب السنة، بالمليون دولار (بعد تكاليف الإطلاق)',
      cases: { Downside: 'المتحفّظ', Base: 'الأساسي', Growth: 'النمو' }, year: (i) => `السنة ${i + 1}`,
      table: ['السيناريو', 'إيراد س1', 'إيراد س3', 'إيراد س5', 'نتيجة س5', 'نتيجة 5 سنين', 'زبائن س5', 'عملاء تجاريين س5'],
      assumptionsTitle: 'أهم الفرضيات (السيناريو الأساسي)',
      assumptions: [
        `الإطلاق في الشهر السادس؛ 10 موظفين في السنة الأولى ويوصلوا 22 في الخامسة، بتكلفة 4,000 دولار للموظف في الشهر.`,
        `متوسط التحويل 750 دولار، و1.3 تحويل للزبون النشط في الشهر، و3.5% يبطّلوا كل شهر، و30 دولار لجلب الزبون.`,
        'التسعير: رسوم 0.10% + هامش صرف 0.35%؛ 10% نصيب الشريك؛ وتكاليف الصرف والخسائر المتوقعة مخصومة.',
        `العملاء التجاريين من الشهر الرابع، بمعدل عميل جديد كل شهر؛ 120,000 دولار في السنة لكل واحد.`,
        'تمويل التسويات المسبق: 5 أيام من حجم التحويل × 1.5 للضغط، من فلوس الشركة نفسها — عمره ما يكون من فلوس الزبائن.',
      ],
      cashTitle: 'شن تموّل الـ11 مليون',
      cash: (b, g, d) => `الـ11 مليون دولار الجديدة محسوبة على ثلاث سنين. في السيناريو الأساسي الشركة يقعدلها <b>${mAr(b[2])}</b> سيولة حرة في آخر السنة الثالثة، بعد ما تغطي خسايرها التشغيلية واحتياطي تنظيمي بمليون دولار والتمويل المسبق للتسويات. من السنة الرابعة الإيرادات هي اللي تدفع المصاريف — ${COV4}% منها في السنة الرابعة، والتعادل في الخامسة — يعني ما نحتاجوش أسهم جديدة زيادة: السيولة الحرة تقعد <b>${mAr(b[4])}</b> في آخر السنة الخامسة، والتمويل المسبق للتسويات يكبر لين ${mAr(PEAK, 1)}. التمويل المسبق رأس مال عامل يرجع لما يقل الحجم ولا يحل محله تسهيل من مصرف. سيناريو النمو يربح من السنة الثانية، لكن التمويل المسبق متاعه يكبر مع الحجم، فيحتاج تسهيل تسويات حوالي ${mAr(-g[4], 1)} في السنة الخامسة؛ والسيناريو المتحفّظ يقعدله ${mAr(d[4], 1)} سيولة حرة. الـ8 مليون متاع شراء الأسهم تمشي للمؤسسين ومش داخلة في الأرقام هادي.`,
    },
    risk: {
      eyebrow: 'الوضع والمخاطر', title: 'شن لازم يصير قبل الإطلاق',
      lead: 'نقولوها بصراحة، لأنها هي اللي تحدد الجدول الزمني. الكود نفسه يفرض أول بند: الإنتاج يرفض أي حركة فلوس جديدة لين كل بوابة يكون عندها دليل مؤرّخ ومراجَع.',
      head: ['المجال', 'وين وصل', 'شن يحلّه'],
      rows: [
        ['الترخيص', 'الإجراءات مع مصرف ليبيا المركزي ماشية', 'إذن صادر ولا ترتيب معتمد مع شريك مرخّص'],
        ['الشركاء', 'حسابات المصارف وشركاء الصرف ومُصدر البطاقات لسّه ما مضوش؛ المصارف في نقاش', 'اتفاقيات ممضية وربط مُختبَر، ممر بممر'],
        ['السيولة', 'صناديق الصرف تحتاج فلوس الشركة نفسها', 'الجولة هادي تغطي السيناريو الأساسي؛ وتسهيل تسويات لو الحجم كبر أسرع'],
        ['الدفاتر', 'فرق قديم حوالي 2,444 USDT في بيانات الاختبار تحت التحقيق', 'تفسير مستقل وقيود تصحيح معتمدة قبل الإطلاق'],
        ['الأمان', 'مُحصّن وعليه اختبارات آلية؛ ما صارش اختبار اختراق خارجي لسّه', 'اختبار مستقل، إصلاحات، وتغيير المفاتيح السرّية'],
        ['الفريق', 'فريق مؤسس صغير؛ اعتماد على أشخاص محددين', 'توظيف ممول من الجولة هادي'],
        ['السوق', 'تغيّر سياسات الصرف يقدر يحرّك السعر الموازي والطلب', 'تنويع الدخل: برمجيات للأنشطة التجارية ومدفوعات المحلات'],
      ],
    },
    ask: {
      eyebrow: 'شن نبوا', title: '19 مليون دولار: 11 للشركة و8 للمؤسسين',
      terms: [['المجموع', '19,000,000 دولار'], ['فلوس جديدة للشركة', '11,000,000 دولار أسهم جديدة، تموّل الشركة ثلاث سنين'], ['شراء أسهم من المؤسسين', '8,000,000 دولار تندفع للمؤسسين الاثنين مقابل 20% من أسهمهم الحالية. الفلوس هادي تمشي للمؤسسين، مش للشركة.'], ['السعر', '40 مليون دولار قبل الاستثمار للجزئين (نفس سعر السهم) · 51 مليون دولار بعده'], ['الملكية بعد الإغلاق', `المستثمر ${pct(OWN.total)} (${pct(OWN.bought)} مشتراة من المؤسسين + ${pct(OWN.fresh)} أسهم جديدة) · المؤسسين ${pct(OWN.founders)}`], ['التركيز', 'ليبيا في السنين 1–3؛ شمال أفريقيا والخليج من السنة الرابعة'], ['الحوكمة', 'يتّفق عليها في ورقة الشروط'], ['الشروط', 'العناية الواجبة، الاتفاقيات النهائية، التحقق من هوية المستثمر وفحص مكافحة غسل الأموال والعقوبات، وأي موافقات تنظيمية لازمة. شراء الأسهم والفلوس الجديدة يتقفلوا مع بعض.']],
      useTitle: 'وين تمشي الـ11 مليون',
      use: [
        ['تمويل التسويات المسبق وسيولة الصرف', 6.2e6, `فلوس الشركة في صناديق الصرف باش المستلمين ياخذوا فلوسهم في وقتها. يغطي أعلى احتياج في السيناريو الأساسي (${mAr(PEAK)} في السنة الخامسة) بلا تسهيل من مصرف. رأس مال عامل يرجع.`],
        ['تشغيل أول ثلاث سنين', 2.1e6, `الفريق، الامتثال، التقنية والتسويق لين الإيرادات تغطي المصاريف. الخسائر التشغيلية المتراكمة في السيناريو الأساسي: ${mAr(-cumLoss('Base'))} على خمس سنين، شاملة تكاليف الإطلاق.`],
        ['ضمانات للجهات التنظيمية والشركاء', 1.0e6, 'احتياطيات وودائع يطلبوها الترخيص وشركاء الصرف.'],
        ['احتياطي للطوارئ', 1.7e6, 'لو تأخر الترخيص ولا دخول الشركاء، ولا لو كان النمو أسرع.'],
      ],
      milestonesTitle: 'شن تموّل الفلوس الجديدة',
      milestones: [
        'ترخيص، ولا ترتيب معتمد مع شريك مرخّص، للدفع والصرف في ليبيا.',
        'نفتحوا بوابات الإطلاق التسعة ونشغّلوا الفلوس الحقيقية في تجربة محدودة.',
        'نطلقوا «ادفع» ورمز QR للأنشطة التجارية مع أول المحلات الموثّقة.',
        'أول ممر تحويل للخارج يخدم مع شريك صرف مرخّص.',
        `خطة السيناريو الأساسي: حوالي ${int(Y('Base')[1].active)} زبون نشط و${mAr(Y('Base')[1].revenue)} إيراد في السنة الثانية.`,
        `من السنة الرابعة الإيرادات تدفع المصاريف: ${COV4}% منها في السنة الرابعة والتعادل في الخامسة (السيناريو الأساسي).`,
      ],
      total: 'المجموع',
    },
    chip: { ready: 'جاهز', partner: 'يستنى شريك', off: 'مقفول في الإنتاج' },
  },
};

// [id, kind, en{title,status,lead,bullets}, ar{...}]
const SCREENS = [
  ['home', 'ready',
    { t: 'Home and balances', s: 'Built', l: 'Everything you hold in one balance, with contacts and recent activity a thumb away.', b: ['Total balance in the display currency you choose, and each currency on its own page.', 'Top up, Send, Buy and More one tap from the top.', 'A contacts row for paying the same people again.', 'Assets and activity with live prices and the 24-hour change.', 'Privacy mode hides balances in public; prices stay visible.'] },
    { t: 'الرئيسية والأرصدة', s: 'جاهز', l: 'كل فلوسك في رصيد واحد، وجهات الاتصال وآخر العمليات قدام صبعك.', b: ['الرصيد الإجمالي بعملة العرض اللي تختارها، وكل عملة في صفحة بروحها.', 'شحن، إرسال، شراء و«المزيد» بضغطة وحدة من فوق.', 'صف جهات الاتصال باش تعاود تدفع لنفس الناس بسرعة.', 'الأصول والعمليات بالأسعار الحية والتغيّر في 24 ساعة.', 'وضع الخصوصية يخبّي الأرصدة قدام الناس، والأسعار تبقى باينة.'] }],
  ['pay', 'ready',
    { t: 'Pay: scan or @username', s: 'Built · new', l: 'The tab that replaced P2P: pay a shop or a person in seconds.', b: ['One large Scan to pay button for the till.', 'Search by name or exact @username; private profiles show only a first name and last initial.', 'Recent payees, with a check mark for verified businesses.', 'A shop\'s name and logo appear only after business verification (KYB), so a fake shop name can\'t fool a customer.'] },
    { t: 'ادفع: امسح ولا @اسم المستخدم', s: 'جاهز · جديد', l: 'التبويب اللي خذا بلاصة P2P: تدفع لمحل ولا لشخص في ثواني.', b: ['زر واحد كبير «امسح للدفع» للكاشير.', 'تدوّر بالاسم ولا بـ@اسم المستخدم بالضبط؛ والحسابات الخاصة ما يبان منها كان الاسم الأول وأول حرف من اللقب.', 'آخر الناس والمحلات اللي دفعتلهم، مع علامة للأنشطة التجارية الموثّقة.', 'اسم المحل وشعاره ما يبانوش إلا بعد توثيق النشاط التجاري (KYB)، باش حد ما يقدر يدير اسم محل مزيّف ويضحك على الزبون.'] }],
  ['pay-merchant', 'ready',
    { t: 'Paying a shop\'s code', s: 'Built', l: 'A shop\'s code can carry the amount and its own reference, so the customer only confirms.', b: ['Verified business name, @handle and reference shown before any money moves.', 'Amount and currency fixed by the code: no typing, no mistakes.', 'Spending limits checked before Face ID or any security code.', 'One review, one confirmation; a retried payment is never charged twice.'] },
    { t: 'الدفع برمز المحل', s: 'جاهز', l: 'رمز المحل يقدر يحمل المبلغ والمرجع متاعه، والزبون يأكّد وبس.', b: ['اسم المحل الموثّق و@المعرّف والمرجع يبانوا قبل ما يتحرك أي دينار.', 'المبلغ والعملة محددين من الرمز: لا كتابة ولا غلط.', 'حدود الصرف تتشيّك قبل Face ID وقبل أي رمز أمان.', 'مراجعة وحدة وتأكيد واحد؛ ولو عاودت المحاولة ما تنخصمش مرتين.'] }],
  ['pay-receipt', 'ready',
    { t: 'A receipt for the counter', s: 'Built', l: 'A confirmation the cashier can read at a glance.', b: ['Amount at the currency\'s precision: dinars to three decimals.', 'Payee, the shop\'s reference, the tazdan transfer reference and the time.', 'Stays on screen until Done, so it can be shown at the till.', 'The payment appears in both sides\' activity and statements.'] },
    { t: 'إيصال للكاشير', s: 'جاهز', l: 'تأكيد الكاشير يقراه من أول نظرة.', b: ['المبلغ بدقة العملة: الدينار بثلاث خانات بعد الفاصلة.', 'اسم المستلم، مرجع المحل، مرجع التحويل في تزدان والوقت.', 'يقعد على الشاشة لين تضغط «تم»، باش توريه للكاشير.', 'الدفعة تظهر في سجل العمليات وكشوف الحساب عند الطرفين.'] }],
  ['business-qr', 'partner',
    { t: 'One QR code per business', s: 'Built · Wallet cards need Apple and Google issuer setup', l: 'Every business gets one permanent code to be paid into.', b: ['Linked to the business account itself, not its @handle: a printed sticker keeps working after a rename and can never be taken over.', 'Print a counter poster, save the image or share the link.', 'Add it to Apple Wallet or Google Wallet to show as a card; issued only to verified businesses.', 'Any team member can open it; the money always lands in the business account.'] },
    { t: 'رمز QR واحد لكل نشاط تجاري', s: 'جاهز · بطاقات المحفظة تستنى إعداد Apple وGoogle', l: 'كل نشاط تجاري ياخذ رمز ثابت واحد يستلم بيه الفلوس.', b: ['الرمز مربوط بحساب النشاط نفسه مش بـ@المعرّف: الملصق المطبوع يقعد يخدم حتى لو تبدّل الاسم، وحد ما يقدر يستولي عليه.', 'تطبع ملصق للكاشير، تحفظ الصورة، ولا تبعث الرابط.', 'تضيفه لـApple Wallet ولا Google Wallet وتوريه كبطاقة؛ للأنشطة الموثّقة بس.', 'أي واحد في الفريق يقدر يفتحه، والفلوس ديما تمشي لحساب النشاط.'] }],
  ['business-home', 'ready',
    { t: 'Business accounts', s: 'Built · tazdan recipients', l: 'A dashboard for verified businesses: what came in, what went out, and who may do what.', b: ['Verification (KYB) status and today\'s volume.', 'Bulk pay to many tazdan accounts in one batch.', 'A second approver above a set threshold (maker-checker).', 'Team roles (owner, admin, analyst, developer), API keys and signed webhooks.'] },
    { t: 'حسابات الأنشطة التجارية', s: 'جاهز · لحسابات تزدان', l: 'لوحة للأنشطة الموثّقة: شن دخل، شن طلع، وشكون يقدر يدير شنو.', b: ['حالة التوثيق (KYB) وحجم اليوم.', 'دفع جماعي لحسابات تزدان هلبا في دفعة وحدة.', 'فوق حد معيّن لازم موافقة شخص ثاني (مُنشئ ومُراجع).', 'أدوار الفريق (مالك، مدير، محلل، مطوّر)، مفاتيح API وwebhooks موقّعة.'] }],
  ['send', 'ready',
    { t: 'Send to anyone', s: 'Built', l: 'Pay a person by @handle or from contacts, in any currency you hold.', b: ['Pick the person and the currency, then type the amount on a large keypad.', 'The recipient is checked before you confirm, not after.', 'Not on tazdan yet? Send a claim link they redeem after signing up.', 'If the connection drops mid-payment, the money never goes twice.'] },
    { t: 'ابعث لأي حد', s: 'جاهز', l: 'تبعث لشخص بـ@المعرّف ولا من جهات الاتصال، بأي عملة عندك.', b: ['تختار الشخص والعملة، وتكتب المبلغ على لوحة أرقام كبيرة.', 'المستلم يتشيّك قبل ما تأكّد، مش بعدين.', 'مش عنده تزدان؟ ابعثله رابط استلام يفعّله بعد ما يسجّل.', 'لو طاح النت في النص، الفلوس ما تمشيش مرتين.'] }],
  ['messages', 'ready',
    { t: 'Chats with money built in', s: 'Built', l: 'Conversations and payments live in the same place.', b: ['Unread counts, payment and support filters, pinned chats.', 'Pay inside a chat; the receipt appears in the thread.', 'Delivery built for weak networks: retries, catch-up after reconnecting, no duplicates.', 'Push notifications with control over message previews.'] },
    { t: 'دردشة وفلوس في نفس البلاصة', s: 'جاهز', l: 'المحادثات والمدفوعات في مكان واحد.', b: ['عدد الرسائل الغير مقروءة، فلاتر للمدفوعات والدعم، وتثبيت المحادثات.', 'تدفع وانت في المحادثة، والإيصال يطلع في نفس المحادثة.', 'التوصيل مبني على شبكات ضعيفة: إعادة إرسال، ومزامنة بعد ما يرجع النت، وبلا تكرار.', 'إشعارات مع تحكّم في عرض نص الرسالة.'] }],
  ['wallet', 'ready',
    { t: 'Multi-currency wallets', s: 'Built', l: 'Dinars, dollars, euros, pounds and digital assets side by side.', b: ['Each balance valued in the display currency at live rates.', 'The split between currencies and digital assets at a glance.', 'Top up, send and receive from the same screen.', 'Full history and audit-ready PDF statements.'] },
    { t: 'محافظ بعملات متعددة', s: 'جاهز', l: 'الدينار والدولار واليورو والجنيه والأصول الرقمية جنب بعض.', b: ['كل رصيد محسوب بعملة العرض بالأسعار الحية.', 'نسبة العملات والأصول الرقمية من أول نظرة.', 'شحن وإرسال واستلام من نفس الشاشة.', 'سجل كامل وكشوف حساب PDF جاهزة للتدقيق.'] }],
  ['exchange', 'partner',
    { t: 'Exchange at the real rate', s: 'Built · awaits FX permission', l: 'Convert between currencies at a live market rate, with the spread stated before you confirm.', b: ['The dinar rate comes from a real-time parallel-market feed, with fallbacks.', 'The rate includes the spread, and the app says so plainly.', 'Market-maker settings, rate-jump guards and kill switches for staff.', 'Switched on only with lawful FX permission.'] },
    { t: 'الصرف بالسعر الحقيقي', s: 'جاهز · يستنى إذن الصرف', l: 'تصرف بين العملات بسعر السوق الحي، والفرق (السبريد) مكتوب قبل ما تأكّد.', b: ['سعر الدينار من مصدر حي للسوق الموازي، ومعاه مصادر احتياطية.', 'السعر فيه السبريد، والتطبيق يقولها بوضوح.', 'إعدادات لصانع السوق، حماية من القفزات المفاجئة في السعر، ومفاتيح إيقاف للموظفين.', 'ما يتفعّلش إلا بإذن قانوني للصرف.'] }],
  ['remit', 'partner',
    { t: 'Send abroad', s: 'Sandbox · payout partner pending', l: 'Quote, recipient, review and tracking across twelve configured corridors.', b: ['The UK, Turkey, Egypt, the UAE, the euro area, Tunisia and more are configured.', 'Fee, rate and exactly what arrives, shown before confirming.', 'A status timeline from compliance check to delivery.', 'Goes live corridor by corridor, once a licensed payout partner signs.'] },
    { t: 'التحويل للخارج', s: 'تجريبي · يستنى شريك الصرف', l: 'عرض سعر، مستلم، مراجعة وتتبّع على 12 ممر تحويل مجهّزين.', b: ['بريطانيا، تركيا، مصر، الإمارات، منطقة اليورو، تونس وغيرهم.', 'الرسوم والسعر وقداش يوصل بالضبط، يبانوا قبل التأكيد.', 'خط زمني للحالة من فحص الامتثال لين التسليم.', 'يتفعّل ممر بممر، بعد ما يمضي شريك صرف مرخّص.'] }],
  ['budgets', 'ready',
    { t: 'Savings goals', s: 'Built', l: 'Goals like Hajj 2027, with scheduled contributions and an optional lock.', b: ['A target amount and date, with progress.', 'Automatic contributions on a schedule.', 'Lock until a date, to protect savings from spending on impulse.', 'The money stays in the customer\'s wallet, set aside for the goal.'] },
    { t: 'أهداف الادخار', s: 'جاهز', l: 'أهداف كيف «حج 2027»، بمساهمات مجدولة وقفل اختياري.', b: ['مبلغ وتاريخ مستهدف، وتشوف قداش وصلت.', 'مساهمات أوتوماتيكية على جدول.', 'تقفلها لين تاريخ معيّن، باش ما تصرفهمش على غفلة.', 'الفلوس تقعد في محفظة الزبون، محجوزة للهدف.'] }],
  ['p2p', 'off',
    { t: 'P2P market, now under More', s: 'Built · off by default in production', l: 'Person-to-person offers with escrow and disputes, moved off the tab bar when Pay took its place.', b: ['Buy and sell offers with price, limits and payment methods.', '"Near me" uses a coarse area only, never an exact location.', 'Sellers show a first name and last initial.', 'Escrow, chat and disputes; staff can pause it at any time.'] },
    { t: 'سوق P2P، توا تحت «المزيد»', s: 'جاهز · مقفول افتراضياً في الإنتاج', l: 'عروض بين الناس بضمان ونزاعات، طلعت من الشريط اللي تحت لما «ادفع» خذا بلاصتها.', b: ['عروض بيع وشراء بالسعر والحدود وطرق الدفع.', '«قريب مني» يستعمل منطقة تقريبية بس، عمره ما يبيّن المكان بالضبط.', 'البايع يبان بالاسم الأول وأول حرف من اللقب.', 'ضمان ودردشة ونزاعات، والموظفين يقدروا يوقفوه في أي وقت.'] }],
  ['devices', 'ready',
    { t: 'Security centre', s: 'Built', l: 'Two-factor authentication, trusted devices and remote sign-out.', b: ['See every signed-in device and sign the others out.', 'Two-factor authentication with an authenticator app, with recovery.', 'Extra checks (Face ID or a 6-digit code) for new devices and large amounts.', 'Three identity-verification levels, with limits shown before every confirmation.'] },
    { t: 'مركز الأمان', s: 'جاهز', l: 'تحقق بخطوتين، أجهزة موثوقة، وتسجيل خروج عن بُعد.', b: ['تشوف كل جهاز داخل لحسابك وتطلّع الباقين.', 'تحقق بخطوتين بتطبيق المصادقة، مع طريقة استرجاع.', 'تحقق زيادة (Face ID ولا رمز من 6 أرقام) للأجهزة الجديدة والمبالغ الكبيرة.', 'ثلاث مستويات لتوثيق الهوية، والحدود تبان قبل كل تأكيد.'] }],
];

// ── Charts (static print: legend + direct value labels + table) ──────
function bars({ series, years, cases, rtl, font, unitLabel }) {
  const W = 640, H = 230, padL = rtl ? 18 : 46, padR = rtl ? 46 : 18, padT = 18, padB = 34;
  const vals = series.flatMap((s) => s.values);
  const max = Math.max(0, ...vals), min = Math.min(0, ...vals);
  const step = (max - min) > 6e6 ? 2e6 : (max - min) > 2.4e6 ? 1e6 : 0.5e6;
  const top = Math.ceil(max / step) * step, bot = Math.floor(min / step) * step;
  const y = (v) => padT + (top - v) / (top - bot || 1) * (H - padT - padB);
  const groupW = (W - padL - padR) / years.length, barW = Math.min(26, (groupW - 18) / series.length - 2);
  let out = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="font-family:${font}" xmlns="http://www.w3.org/2000/svg">`;
  for (let v = bot; v <= top + 1; v += step) {
    const yy = y(v);
    out += `<line x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" stroke="${v === 0 ? '#9AA6B4' : '#E6EAEF'}" stroke-width="${v === 0 ? 1 : 0.6}"/>`;
    out += `<text x="${rtl ? W - padR + 6 : padL - 6}" y="${yy + 3}" font-size="8" fill="#66748A" text-anchor="${rtl ? 'start' : 'end'}" direction="ltr">${(v / 1e6).toFixed(step < 1e6 ? 1 : 0)}</text>`;
  }
  years.forEach((label, i) => {
    const gx = padL + i * groupW, inner = series.length * (barW + 2) - 2, x0 = gx + (groupW - inner) / 2;
    series.forEach((s, j) => {
      const v = s.values[i], x = x0 + j * (barW + 2), y1 = y(Math.max(v, 0)), y2 = y(Math.min(v, 0)), h = Math.max(1, y2 - y1);
      const r = Math.min(3, barW / 2, h / 2);
      // Rounded at the data end, square at the baseline.
      const d = v >= 0
        ? `M${x},${y2} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + barW - r} Q${x + barW},${y1} ${x + barW},${y1 + r} V${y2} Z`
        : `M${x},${y1} V${y2 - r} Q${x},${y2} ${x + r},${y2} H${x + barW - r} Q${x + barW},${y2} ${x + barW},${y2 - r} V${y1} Z`;
      out += `<path d="${d}" fill="${s.color}"/>`;
      const ly = v >= 0 ? y1 - 3 : y2 + 8;
      out += `<text x="${x + barW / 2}" y="${ly}" font-size="6.6" fill="#3C4A58" text-anchor="middle" direction="ltr">${v < 0 ? '−' : ''}${(Math.abs(v) / 1e6).toFixed(Math.abs(v) >= 1e7 ? 1 : 2)}</text>`;
    });
    out += `<text x="${gx + groupW / 2}" y="${H - 12}" font-size="8.4" fill="#3C4A58" text-anchor="middle">${esc(label)}</text>`;
  });
  out += `</svg>`;
  const legend = `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(cases[s.key])}</span>`).join('')}<span class="unit">${esc(unitLabel)}</span></div>`;
  return legend + out;
}

// ── Page assembly ───────────────────────────────────────────────────
async function build(loc) {
  const L = T[loc], rtl = loc === 'ar';
  const img = (id) => 'file://' + path.join(HERE, 'img', loc, id + '.jpg');
  const S = SCREENS.map(([id, kind, en, ar]) => ({ id, kind, ...(rtl ? ar : en) }));
  const chip = (kind, text) => `<span class="chip ${kind}">${esc(text)}</span>`;
  const years = [0, 1, 2, 3, 4].map(L.fin.year);
  const series = (k) => CASES.map((c) => ({ key: c, color: COLORS[c], values: Y(c).map((y) => y[k]) }));
  const b = freeCash('Base'), g = freeCash('Growth'), d = freeCash('Downside');

  const fontCss = [
    ...[400, 500, 600, 700].map((w) => `@font-face{font-family:'Inter';src:url('file://${FONTS}/Inter-${w}.woff2') format('woff2');font-weight:${w}}`),
    ...[400, 500, 600, 700].map((w) => `@font-face{font-family:'Outfit';src:url('file://${FONTS}/Outfit-latin-${w}.woff2') format('woff2');font-weight:${w}}`),
    ...[400, 500, 600, 700, 800].flatMap((w) => [
      `@font-face{font-family:'Cairo';src:url('file://${FONTS}/Cairo-arabic-${w}.woff2') format('woff2');font-weight:${w};unicode-range:U+0600-06FF,U+0750-077F,U+08A0-08FF,U+200C-200F,U+FB50-FDFF,U+FE70-FEFC}`,
      `@font-face{font-family:'Cairo';src:url('file://${FONTS}/Cairo-latin-${w}.woff2') format('woff2');font-weight:${w};unicode-range:U+0000-00FF,U+2000-206F,U+20AC,U+2212}`,
    ]),
  ].join('\n');
  const F = rtl ? 'Cairo' : 'Inter', H = rtl ? 'Cairo' : 'Outfit';
  const css = `${fontCss}
  @page{size:A4;margin:20mm 17mm 18mm;
    @bottom-${rtl ? 'right' : 'left'}{content:"${L.footer}";font-family:${F};font-size:7pt;color:#7A8796}
    @bottom-${rtl ? 'left' : 'right'}{content:${L.page()};font-family:${F};font-size:7pt;color:#7A8796}}
  @page :first{margin:0;@bottom-left{content:none}@bottom-right{content:none}}
  *{box-sizing:border-box}
  html,body{margin:0;background:#fff}
  body{font-family:${F},sans-serif;font-size:${rtl ? 9.6 : 9.2}pt;line-height:${rtl ? 1.75 : 1.55};color:#15202B;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .ltr{direction:ltr;unicode-bidi:isolate;display:inline}
  .cover{width:210mm;height:297mm;position:relative;overflow:hidden;color:#fff;background:linear-gradient(160deg,#0F1B29 0%,#16283B 50%,#24384F 100%);padding:22mm 20mm 20mm;display:flex;flex-direction:column;break-after:page}
  .cover .logo{height:9mm;width:auto;align-self:flex-start}
  .cover .eyebrow{color:#9FB2C6;margin-top:auto}
  .cover h1{font-family:${H};font-weight:${rtl ? 700 : 600};font-size:${rtl ? 30 : 32}pt;line-height:${rtl ? 1.35 : 1.1};margin:4mm 0 5mm;max-width:160mm}
  .cover .sub{font-size:12pt;line-height:1.6;color:#C9D6E3;max-width:150mm;margin:0}
  .cover .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:6mm;margin-top:14mm;padding-top:5mm;border-top:.6px solid rgba(255,255,255,.22);font-size:8.4pt;color:#9FB2C6}
  .cover .meta b{display:block;color:#fff;font-weight:600;font-size:12pt;margin-top:1mm}
  .cover .legal{font-size:7.4pt;color:#8DA0B4;margin-top:9mm;max-width:165mm;line-height:1.6}
  .cover .ring{position:absolute;${rtl ? 'left' : 'right'}:-48mm;top:30mm;width:150mm;height:150mm;border-radius:50%;border:.7px solid rgba(255,255,255,.07)}
  .cover .ring.r2{${rtl ? 'left' : 'right'}:-22mm;top:56mm;width:98mm;height:98mm}
  .cover .ring.r3{${rtl ? 'left' : 'right'}:4mm;top:82mm;width:46mm;height:46mm;background:rgba(255,255,255,.035)}
  .section{break-before:page}
  .eyebrow{font-size:7.4pt;font-weight:600;letter-spacing:${rtl ? 0 : '.13em'};text-transform:uppercase;color:#66748A;margin-bottom:1.5mm}
  h1.h{font-family:${H};font-weight:${rtl ? 700 : 600};font-size:20pt;line-height:1.25;color:#24384F;margin:0 0 3mm}
  h2{font-family:${H};font-weight:${rtl ? 700 : 600};font-size:12pt;margin:5.5mm 0 2mm;color:#15202B;break-after:avoid}
  p{margin:0 0 2.4mm}
  .lead{font-size:${rtl ? 10.6 : 10.6}pt;line-height:1.6;color:#3C4A58;margin-bottom:4mm}
  ul{margin:0 0 3mm;padding-${rtl ? 'right' : 'left'}:4.6mm;padding-${rtl ? 'left' : 'right'}:0}
  li{margin:0 0 1.2mm}
  li::marker{color:#9AA6B4}
  .note{font-size:7.6pt;line-height:1.55;color:#66748A}
  b{font-weight:600}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:3mm 0 4mm}
  .kpi{background:#F3F6F9;border-radius:2.4mm;padding:3.2mm 3.6mm}
  .kpi .v{font-family:${rtl ? 'Cairo' : 'Outfit'};font-size:17pt;font-weight:600;color:#24384F;line-height:1.1}
  .kpi .l{font-size:7.6pt;color:#66748A;margin-top:1.2mm;line-height:1.4}
  .ask{background:#24384F;color:#fff;border-radius:3mm;padding:4.5mm 5mm;margin-top:4mm}
  .ask h2{color:#fff;margin-top:0}
  .ask p{margin:0;color:#DCE5EE}
  table{width:100%;border-collapse:collapse;font-size:8.4pt;line-height:1.5;margin:2mm 0 4mm}
  th{text-align:start;font-weight:600;color:#66748A;font-size:7.2pt;border-bottom:1.1px solid #15202B;padding:1.5mm 2mm 1.5mm 0}
  td{border-bottom:.5px solid #DDE3EA;padding:1.7mm 2mm 1.7mm 0;vertical-align:top}
  ${rtl ? 'th,td{padding:1.5mm 0 1.5mm 2mm}' : ''}
  .n{text-align:end;font-variant-numeric:tabular-nums;white-space:nowrap;direction:ltr;unicode-bidi:isolate}
  tr{break-inside:avoid}
  tr.total td{font-weight:600;border-top:1px solid #15202B;border-bottom:none}
  .chip{display:inline-block;font-size:7pt;font-weight:600;padding:.5mm 2.2mm;border-radius:1.6mm;line-height:1.5}
  .chip.ready{background:#E3F2EC;color:#0F7A55}.chip.partner{background:#FBF0DC;color:#8A5A00}.chip.off{background:#ECEFF3;color:#4B5867}
  .tour{display:grid;grid-template-columns:1fr 1fr;gap:9mm;break-inside:avoid}
  .tour + .tour{break-before:page}
  .screen{break-inside:avoid}
  .shot{display:block;height:112mm;width:auto;margin:0 auto 4mm;border-radius:6mm;border:.6px solid #CBD3DC;box-shadow:0 1mm 4mm rgba(15,27,41,.12)}
  .num{font-family:${rtl ? 'Cairo' : 'Outfit'};font-size:8pt;color:#9AA6B4;font-weight:600}
  .screen h3{font-family:${H};font-size:12pt;font-weight:${rtl ? 700 : 600};margin:.5mm 0 1.4mm;color:#15202B}
  .screen .l{color:#3C4A58;margin:1.6mm 0 1.8mm}
  .screen ul{font-size:${rtl ? 8.8 : 8.5}pt}
  .demo{font-size:7pt;color:#9AA6B4;text-align:center;margin:-2.5mm 0 3mm}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:8mm}
  .legend{display:flex;gap:5mm;font-size:8pt;color:#3C4A58;margin:1mm 0 1mm;align-items:center}
  .legend i{display:inline-block;width:2.6mm;height:2.6mm;border-radius:.6mm;margin-${rtl ? 'left' : 'right'}:1.5mm;vertical-align:-.3mm}
  .legend .unit{margin-${rtl ? 'right' : 'left'}:auto;color:#66748A}
  figure{margin:0 0 3mm;break-inside:avoid}
  .fig-title{font-weight:600;font-size:9pt;margin-bottom:1mm}
  `;

  const tourPages = [];
  for (let i = 0; i < S.length; i += 2) tourPages.push(S.slice(i, i + 2));
  const screen = (s, n) => `<div class="screen">
      <img class="shot" src="${img(s.id)}"/>
      <div class="demo">${esc(L.tour.demo)}</div>
      <div class="num">${String(n).padStart(2, '0')}</div>
      <h3>${esc(s.t)}</h3>
      ${chip(s.kind, s.s)}
      <p class="l">${esc(s.l)}</p>
      <ul>${s.b.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    </div>`;

  const caseRow = (c) => {
    const ys = Y(c), five = ys.reduce((a, y) => a + y.result, 0);
    return `<tr><td><b>${esc(L.fin.cases[c])}</b></td><td class="n">${m(ys[0].revenue)}</td><td class="n">${m(ys[2].revenue)}</td><td class="n">${m(ys[4].revenue)}</td><td class="n">${m(ys[4].result)}</td><td class="n">${m(five)}</td><td class="n">${int(ys[4].active)}</td><td class="n">${Math.round(ys[4].b2b)}</td></tr>`;
  };
  const useTotal = L.ask.use.reduce((a, u) => a + u[1], 0);

  const html = `<!doctype html><html lang="${L.lang}" dir="${L.dir}"><head><meta charset="utf-8"><style>${css}</style></head><body>
  <div class="cover">
    <img class="logo" src="file://${path.join(ROOT, 'client/public/logo-white.png')}"/>
    <div class="ring"></div><div class="ring r2"></div><div class="ring r3"></div>
    <div class="eyebrow">${esc(L.cover.eyebrow)}</div>
    <h1>${esc(L.cover.title)}</h1>
    <p class="sub">${esc(L.cover.sub)}</p>
    <div class="meta">${L.cover.meta.map(([k, v]) => `<div>${esc(k)}<b style="display:block">${esc(v)}</b></div>`).join('')}</div>
    <div class="legal">${esc(L.cover.legal)}</div>
  </div>

  <div>
    <div class="eyebrow">${esc(L.glance.eyebrow)}</div>
    <h1 class="h">${esc(L.glance.title)}</h1>
    <p class="lead">${esc(L.glance.lead)}</p>
    <div class="kpis">${L.glance.kpis.map(([v, l]) => `<div class="kpi"><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <h2>${esc(L.glance.h1)}</h2>
    <ul>${L.glance.why.map((x) => `<li>${x}</li>`).join('')}</ul>
    <h2>${esc(L.glance.h2)}</h2><p>${esc(L.glance.built)}</p>
    <h2>${esc(L.glance.h3)}</h2><p>${esc(L.glance.stands)}</p>
    <div class="ask"><h2>${esc(L.glance.h4)}</h2><p>${L.glance.ask}</p></div>
    <p class="note" style="margin-top:4mm">${esc(L.glance.source)}</p>
  </div>

  <div class="section">
    <div class="eyebrow">${esc(L.tour.eyebrow)}</div>
    <h1 class="h">${esc(L.tour.title)}</h1>
    <p class="lead">${esc(L.tour.lead)}</p>
  </div>
  ${tourPages.map((pair, k) => `<div class="tour" ${k === 0 ? 'style="break-before:avoid"' : ''}>${pair.map((s, j) => screen(s, k * 2 + j + 1)).join('')}</div>`).join('\n')}

  <div class="section">
    <h2 style="margin-top:0">${esc(L.also.title)}</h2>
    <ul>${L.also.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>

    <div class="eyebrow" style="margin-top:8mm">${esc(L.model.eyebrow)}</div>
    <h1 class="h">${esc(L.model.title)}</h1>
    <p class="lead">${esc(L.model.lead)}</p>
    <table><tbody>${L.model.rows.map(([k, v]) => `<tr><td style="width:34%"><b>${esc(k)}</b></td><td>${v.includes('<span') ? v : esc(v)}</td></tr>`).join('')}</tbody></table>
    <div class="cols">
      <div>
        <h2>${esc(L.model.exTitle)}</h2>
        <table><tbody>${L.model.ex.map(([k, v], i) => `<tr${i === L.model.ex.length - 1 ? ' class="total"' : ''}><td>${esc(k)}</td><td class="n">${esc(v)}</td></tr>`).join('')}</tbody></table>
        <p class="note">${esc(L.model.exNote)}</p>
      </div>
      <div><h2>&nbsp;</h2><p>${L.model.honest}</p></div>
    </div>
  </div>

  <div class="section">
    <div class="eyebrow">${esc(L.fin.eyebrow)}</div>
    <h1 class="h">${esc(L.fin.title)}</h1>
    <p class="lead">${esc(L.fin.lead)}</p>
    <figure><div class="fig-title">${esc(L.fin.revTitle)}</div>${bars({ series: series('revenue'), years, cases: L.fin.cases, rtl, font: F, unitLabel: '$M' })}</figure>
    <figure><div class="fig-title">${esc(L.fin.opTitle)}</div>${bars({ series: series('result'), years, cases: L.fin.cases, rtl, font: F, unitLabel: '$M' })}</figure>
    <table><thead><tr>${L.fin.table.map((h, i) => `<th${i ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${['Base', 'Growth', 'Downside'].map(caseRow).join('')}</tbody></table>
  </div>
  <div class="section">
    <h2 style="margin-top:0">${esc(L.fin.assumptionsTitle)}</h2>
    <ul>${L.fin.assumptions.map((x) => `<li>${x}</li>`).join('')}</ul>
    <h2>${esc(L.fin.cashTitle)}</h2>
    <p>${L.fin.cash(b, g, d)}</p>

    <div class="eyebrow" style="margin-top:8mm">${esc(L.risk.eyebrow)}</div>
    <h1 class="h">${esc(L.risk.title)}</h1>
    <p class="lead">${esc(L.risk.lead)}</p>
    <table><thead><tr>${L.risk.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${L.risk.rows.map(([a, s, c]) => `<tr><td style="width:16%"><b>${esc(a)}</b></td><td style="width:44%">${esc(s)}</td><td>${esc(c)}</td></tr>`).join('')}</tbody></table>
  </div>

  <div class="section">
    <div class="eyebrow">${esc(L.ask.eyebrow)}</div>
    <h1 class="h">${esc(L.ask.title)}</h1>
    <table><tbody>${L.ask.terms.map(([k, v]) => `<tr><td style="width:22%"><b>${esc(k)}</b></td><td>${v.includes('<span') ? v : esc(v)}</td></tr>`).join('')}</tbody></table>
    <h2>${esc(L.ask.useTitle)}</h2>
    <table><tbody>${L.ask.use.map(([k, v, note]) => `<tr><td style="width:82%"><b>${esc(k)}</b><div class="note">${note.includes('<span') ? note : esc(note)}</div></td><td class="n">${m(v, 1)}</td></tr>`).join('')}
      <tr class="total"><td>${esc(L.ask.total)}</td><td class="n">${m(useTotal, 1)}</td></tr></tbody></table>
    <h2>${esc(L.ask.milestonesTitle)}</h2>
    <ul>${L.ask.milestones.map((x) => `<li>${x}</li>`).join('')}</ul>
    <p class="note" style="margin-top:6mm">${esc(L.cover.legal)}</p>
  </div>
  </body></html>`;

  if (Math.abs(useTotal - PRIMARY) > 1) throw Error('Use of funds must total the new money');
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
