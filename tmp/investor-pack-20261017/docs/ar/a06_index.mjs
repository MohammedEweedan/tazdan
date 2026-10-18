import fs from 'node:fs';
import path from 'node:path';
import { chip, esc, WORK } from '../lib.mjs';
import { css as enCss } from '../d06_index.mjs';
import { features, chapters, statusCounts } from './data_ar.mjs';
import { coverAr, b } from './lib_ar.mjs';

const seg = JSON.parse(fs.readFileSync(path.join(WORK, 'video-ar/segments.json'), 'utf8'));
const at = Object.fromEntries(seg.index.map(s => [s.id, s]));
const mmss = t => b(`${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`);
export const css = enCss + `.ix td{font-size:7.9pt;line-height:1.5}.st b{font-size:7.6pt}`;

export default () => `
${coverAr({ eyebrow: '06 · عرض المنتج', title: 'فهرس<br>الميزات', sub: `كل ميزة في فيديو العرض (${mmss(seg.total)}): متى تظهر، وماذا يعرض المقطع، وحالتها اليوم. مع لقطة لكل شاشة وما لا يغطيه الفيديو.`, docNo: 'المستند 06' })}

<div class="eyebrow">الفيديو ميزةً ميزة</div>
<h1 class="h">${b(features.length)} ميزة في ${b(chapters.length)} فصول</h1>
<p>الملف: <b>Tazdan_Product_Demo_AR.mp4</b> (${b('1920×1080')}، ${mmss(seg.total)}، بلا صوت مع شروح على الشاشة، وبواجهة التطبيق العربية). الحالة اليوم: ${chip('ready', b(statusCounts.ready) + ' مكتملة')} ${chip('partner', b(statusCounts.partner) + ' بانتظار شريك')} ${chip('off', b(statusCounts.off) + ' معطّلة في الإنتاج')}</p>
<table class="ix">
<tr><th style="width:7%">الوقت</th><th style="width:15%">الفصل</th><th style="width:19%">الميزة</th><th>ما يعرضه المقطع</th><th style="width:22%">الحالة</th></tr>
<tr><td>${mmss(0)}</td><td colspan="4">بطاقة العنوان وتنويه التسجيل</td></tr>
${features.map(f => `<tr><td>${mmss(at[f.id].start)}</td><td>${esc(chapters[f.ch])}</td><td><b>${esc(f.title)}</b></td><td>${esc(f.desc)}</td><td>${chip(f.kind, esc(f.status))}</td></tr>`).join('')}
<tr><td>${mmss(at.outro.start)}</td><td colspan="4">بطاقة الملخص</td></tr>
</table>

<div class="section"></div>
<div class="eyebrow">طريقة التسجيل</div>
<h1 class="h">تطبيق حقيقي، وعميل افتراضي</h1>
<div class="grid2">
<div>
<p>سُجّل كل مقطع من تطبيق تزدان نفسه (الكود ذاته الذي يُنشر على الهواتف، مشغّلًا كنسخة ويب بمقاس آيفون ودقة مضاعفة). يظهر فيه عميل افتراضي موثّق بالكامل هو «أميرة» (@amira)، بجهات اتصال وأرصدة وأسعار وسجل مختلَقة.</p>
<p>كل ردود الخادم معدّة مسبقًا، فلا قاعدة بيانات ولا قناة دفع ولا مال حقيقي، ولا تظهر أي بيانات لعملاء حقيقيين.</p>
<p><b>تنبيه:</b> بعض شاشات الأعمال (الفريق، والدفعات، ومفاتيح API، والإحالات، والسحب) ما زالت تعرض عبارات إنجليزية داخل الواجهة العربية؛ وهذه فجوة ترجمة في التطبيق نفسه.</p>
</div>
<div>
<p><b>التعديلات:</b> تُعرض المسارات الطويلة بسرعة تصل إلى 1.4 ضعف، وتثبت الشاشات القصيرة على آخر إطار ليُقرأ الشرح. وأُزيلت عبارة واحدة من الشاشة: شارة «تشفير من طرف إلى طرف» في شاشة المحادثة، لأن هذا الادعاء لم يُتحقق منه بشكل مستقل.</p>
<p><b>تسميات الحالة</b> تتبع مصفوفة ميزات المنصة: ${chip('ready', 'مكتمل')} يعمل من البداية للنهاية دون تفعيل خارجي؛ ${chip('partner', 'بانتظار شريك')} يحتاج مصرفًا أو ترخيصًا أو شريك صرف؛ ${chip('off', 'معطّل')} ترفضه المنصة في الإنتاج حتى تتحقق شروطه.</p>
</div>
</div>
<h2>ما لا يعرضه الفيديو</h2>
<table>
<tr><th style="width:24%">المجال</th><th>ما هو موجود</th><th style="width:16%">الحالة</th></tr>
<tr><td><b>لوحة التحكم التشغيلية (ويب)</b></td><td>32 صفحة للموظفين: البحث الشامل وملف العميل الكامل، والتحقق من الهوية، وطوابير الإيداع والسحب، والاعتماد المزدوج، ومفاتيح الإيقاف، ومركز التحويلات، وتعديلات أسعار الصرف، ومخزون الخزينة، والمزوّدون، والمطابقة، وحالات الامتثال وقوائم الرقابة، ورسم الاحتيال، وتصعيدات الدعم، والمالية، وصحة النظام، وسجل التدقيق</td><td>${chip('ready', 'مكتمل')}</td></tr>
<tr><td><b>شاشات الموظفين في التطبيق</b></td><td>25 شاشة إدارية في تطبيق الجوال للطوابير والأسعار والرسوم والمستخدمين والتشخيص</td><td>${chip('ready', 'مكتمل')}</td></tr>
<tr><td><b>التعريف بالتطبيق</b></td><td>مقدمة متحركة من ستة مشاهد، والتسجيل، وتأكيد البريد، وإعداد التحقق بخطوتين</td><td>${chip('ready', 'مكتمل')}</td></tr>
<tr><td><b>واجهة API العامة للأعمال</b></td><td>الأرصدة والأسعار والدفعات والإشعارات الموقّعة، مع مفاتيح منع التكرار</td><td>${chip('ready', 'مكتمل')}</td></tr>
</table>
<p class="note">يتوفر عند الطلب عرض حي للتطبيق ولوحة التحكم على البيانات الافتراضية نفسها.</p>

<div class="section"></div>
<div class="eyebrow">الشاشات</div>
<h1 class="h">لقطة لكل ميزة</h1>
<div class="stills">
${features.map(f => `<div class="st"><img src="file://${f.still}"><b>${esc(f.title)}</b>${chip(f.kind, esc(f.status))}</div>`).join('')}
</div>
`;
