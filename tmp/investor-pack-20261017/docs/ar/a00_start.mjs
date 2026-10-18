import fs from 'node:fs/promises';
import path from 'node:path';
import { chip, PACK_AR, WORK } from '../lib.mjs';
import { cases, deal, platform } from '../data.mjs';
import { features, statusCounts } from './data_ar.mjs';
import { coverAr, mAr, b } from './lib_ar.mjs';

const B = cases.Base, G = cases.Growth;
async function pages(rel) {
  const { PDFDocument } = await import(path.join(WORK, 'node_modules/pdf-lib/cjs/index.js')).then(m => m.default || m);
  try { const n = (await PDFDocument.load(await fs.readFile(path.join(PACK_AR, rel)))).getPageCount(); return b(n) + (n > 10 ? ' صفحة' : ' صفحات'); } catch { return 'PDF'; }
}
const mb = async rel => { try { return b(((await fs.stat(path.join(PACK_AR, rel))).size / 1e6).toFixed(1) + ' MB'); } catch { return ''; } };
export const css = `.files td:nth-child(2){direction:ltr;text-align:right;font-size:7.6pt;color:#3C4A58;word-break:break-all}`;

export default async () => {
  const rows = [
    ['01 نظرة عامة', 'Tazdan_Investor_Presentation_AR.pdf', 'خمس عشرة شريحة: المشكلة والمنتج والنموذج والأرقام والهيكل والخطة والمقترح', await pages('01_Overview/Tazdan_Investor_Presentation_AR.pdf')],
    ['', 'Tazdan_Investor_Memorandum_AR.pdf', 'القصة كاملة نثرًا: السوق والمنتج ونموذج العمل والوصول إلى السوق والأرقام والصفقة والجاهزية', await pages('01_Overview/Tazdan_Investor_Memorandum_AR.pdf')],
    ['02 الهيكل المؤسسي', 'Tazdan_Corporate_Structure_and_Governance_AR.pdf', 'هيكل المجموعة وأدوار الشركات والاتفاقيات بينها وتدفقات الأموال والمقاصة والحوكمة وجدول الملكية', await pages('02_Corporate_and_Remittances/Tazdan_Corporate_Structure_and_Governance_AR.pdf')],
    ['03 الإيرادات والتسعير', 'Tazdan_Revenue_Models_and_Pricing_AR.pdf', 'مصادر الدخل وجدول الرسوم ومحرك الصرف وهوامشه وتحويل مشروح واقتصاديات الوحدة وتسعير البرمجيات', await pages('03_Revenue_and_Pricing/Tazdan_Revenue_Models_and_Pricing_AR.pdf')],
    ['04 النموذج المالي', 'Tazdan_Integrated_Financial_Model.xlsx', 'نموذج حي لستين شهرًا بثلاث حالات وعشر أوراق، منها حاسبة الرسوم وهوامش الصرف (بالإنجليزية)', 'Excel'],
    ['', 'Tazdan_Financial_Model_Summary_AR.pdf', 'النتائج والنقد ورأس المال والافتراضات وطريقة استخدام الملف', await pages('04_Financial_Model/Tazdan_Financial_Model_Summary_AR.pdf')],
    ['05 دليل النمو', 'Tazdan_Growth_Playbook_AR.pdf', 'ستة عشر أسلوبًا للشوارع والمحلات والهواتف والمناسبات، والضوابط، والميزانية، وخطة أول 90 يومًا', await pages('05_Growth_Playbook/Tazdan_Growth_Playbook_AR.pdf')],
    ['06 عرض المنتج', 'Tazdan_Product_Demo_AR.mp4', `فيديو جولة في المنتج بواجهة عربية: ${b(features.length)} ميزة بشروح على الشاشة، دون صوت`, await mb('06_Product_Demo/Tazdan_Product_Demo_AR.mp4')],
    ['', 'Tazdan_Feature_Coverage_Index_AR.pdf', 'التوقيت والحالة ولقطة لكل ميزة في الفيديو', await pages('06_Product_Demo/Tazdan_Feature_Coverage_Index_AR.pdf')],
    ['07 الإطلاق والفحص', 'Tazdan_Launch_Roadmap_and_Risk_Register_AR.pdf', 'الجاهزية اليوم، وبوابات الإطلاق التسع، وخارطة الطريق بعد التمويل، وسجل المخاطر، وفهرس الفحص النافي للجهالة', await pages('07_Launch_and_Diligence/Tazdan_Launch_Roadmap_and_Risk_Register_AR.pdf')],
    ['08 الأدلة والمصادر', 'Tazdan_Evidence_and_Sources_AR.pdf', 'أرقام المصرف المركزي، والتحقق الهندسي، وقياسات المنصة، وكل مصدر مذكور', await pages('08_Evidence_and_Sources/Tazdan_Evidence_and_Sources_AR.pdf')],
  ];
  return `
${coverAr({ eyebrow: 'ابدأ من هنا', title: 'حزمة المستثمر<br>لتزدان', sub: 'كل ما يحتاجه المستثمر المحتمل لتقييم تزدان: النشاط والأرقام والخطة والمنتج أثناء العمل والأدلة وراء كل ذلك.', docNo: 'المحتويات والدليل' })}

<div class="eyebrow">المحتويات</div>
<h1 class="h">ما في هذه الحزمة</h1>
<table class="files tight">
<tr><th style="width:18%">المجلد</th><th style="width:31%">الملف</th><th>ما هو</th><th class="n" style="width:10%">الحجم</th></tr>
${rows.map(([f, n, d, s]) => `<tr><td>${f ? `<b>${f}</b>` : ''}</td><td>${n}</td><td>${d}</td><td class="n">${s}</td></tr>`).join('')}
</table>
<p class="note">تتوفر نسخة إنجليزية مطابقة من الحزمة. أسماء الملفات بالحروف اللاتينية لتعمل على كل الأجهزة.</p>

<div class="section"></div>
<div class="eyebrow">حقائق رئيسية</div>
<h1 class="h">الحزمة في صفحة واحدة</h1>
<div class="kpis">
<div class="kpi"><div class="v">${mAr(deal.total, 0)}</div><div class="l">الاستثمار المقترح مقابل 40%: ${mAr(deal.primary, 0)} رأس مال جديد و${mAr(deal.secondary, 0)} أسهم من المؤسس</div></div>
<div class="kpi"><div class="v">${mAr(deal.post, 0)}</div><div class="l">القيمة الضمنية للملكية بعد الاستثمار</div></div>
<div class="kpi"><div class="v">${mAr(B.years[4].revenue)}</div><div class="l">إيرادات السنة 5 في الحالة الأساسية (النمو ${mAr(G.years[4].revenue)})</div></div>
<div class="kpi"><div class="v">${b(platform.tests)}</div><div class="l">اختبارًا ناجحًا للخادم؛ ${b(platform.screens)} شاشة جوال؛ لوحة تحكم من ${b(platform.cockpitPages)} صفحة</div></div>
</div>
<h2>كيف تقرأ الحزمة</h2>
<div class="grid3">
<div class="card"><h3>في 15 دقيقة</h3><p>شاهد فيديو العرض، ثم اقرأ العرض التقديمي.</p></div>
<div class="card"><h3>في ساعة</h3><p>أضف مذكرة المستثمر وملخص النموذج المالي.</p></div>
<div class="card"><h3>للفحص النافي للجهالة</h3><p>راجع ملف Excel، ثم مستندات الهيكل والإيرادات والنمو والإطلاق والأدلة.</p></div>
</div>
<h2>تسميات الحالة في كل المستندات</h2>
<table>
<tr><td style="width:24%">${chip('ready', 'مكتمل')}</td><td>يعمل من البداية للنهاية في الكود دون تفعيل خارجي (${b(statusCounts.ready)} من ${b(features.length)} ميزة في الفيديو).</td></tr>
<tr><td>${chip('partner', 'بانتظار شريك')}</td><td>مكتمل، لكنه يحتاج مصرفًا أو ترخيصًا أو شريك صرف قبل أن يستخدمه عملاء حقيقيون (${b(statusCounts.partner)} ميزات).</td></tr>
<tr><td>${chip('off', 'معطّل في الإنتاج')}</td><td>مبني، لكن المنصة ترفضه في الإنتاج حتى تتحقق شروطه (${b(statusCounts.off)} ميزات).</td></tr>
<tr><td>${chip('plan', 'خارج الكود')}</td><td>عمل خارج البرمجيات: التراخيص، وعقود الشركاء، والاختبار المستقل.</td></tr>
</table>
<h2>أين نقف، في فقرة واحدة</h2>
<p>برمجيات تزدان مبنية ومختبرة على قاعدة بيانات حقيقية، ولم تخدم عميلًا حقيقيًا بعد. يموّل الاستثمار الخطوات بين الحالتين: مسار ترخيص أو شريك مرخّص، ومصرف شريك بحسابات محمية، وشركاء صرف، واختبار أمني مستقل، ومطابقة افتتاحية، والفريق الذي يدير ذلك. ولا يُطلق شيء قبل توقيع تسع بوابات إطلاق، والبرمجيات تفرض ذلك.</p>
<h2>تنويه مهم</h2>
<p class="note">هذه الحزمة سرية، أعدّها مؤسس تزدان للمستثمرين المحتملين. وهي ليست عرضًا لبيع أي أوراق مالية ولا دعوة لتقديم عرض لشرائها. التوقعات والأسعار والجداول الزمنية تقديرات تخطيطية مبنية على افتراضات معلنة، وليست وعودًا، وقد تختلف النتائج الفعلية اختلافًا جوهريًا. لا يُقدَّم أي ترخيص أو علاقة مصرفية أو شريك صرف أو عقد عميل أو إيراد على أنه قائم ما لم يُذكر ذلك صراحة. الشروط المقترحة هي العرض الافتتاحي للمؤسس، غير ملزمة، وتخضع للفحص النافي للجهالة والتوثيق ومراجعة المصرف المستقبِل للأطراف المستثمرة وأموالها. يستخدم فيديو المنتج عميلًا وبيانات افتراضية. يُرجى عدم إعادة إرسال هذه الحزمة دون موافقة المؤسس.</p>
`;
};
