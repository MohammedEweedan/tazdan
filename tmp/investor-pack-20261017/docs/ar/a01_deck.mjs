import { chip, groupedBars, lines, legend, C, LOGO_WHITE, LOGO_NAVY } from '../lib.mjs';
import { cases, cbl, deal, platform, fee, cumLoss } from '../data.mjs';
import { css as enCss } from '../d01_deck.mjs';
import { features, statusCounts } from './data_ar.mjs';
import { groupSvgAr } from './a02_corporate.mjs';
import { mmSvgAr } from './a03_revenue.mjs';
import { mAr, nM, usdA, intA, pctA, b, rtlSvg } from './lib_ar.mjs';

const D = cases.Downside, B = cases.Base, G = cases.Growth;
const still = id => 'file://' + features.find(f => f.id === id).still;
const yrs = ['السنة 1', 'السنة 2', 'السنة 3', 'السنة 4', 'السنة 5'];
const caseLeg = legend([['المتحفظة', C.s2], ['الأساسية', C.s1], ['النمو', C.s3]]);
const bars = (series, w = 600, h = 250) => rtlSvg(groupedBars({ categories: yrs, height: h, width: w, unit: 'm', font: 'Cairo', series }));

export const css = enCss + `
.s h1{font-family:Cairo;font-weight:700;font-size:25pt;line-height:1.35;letter-spacing:0}
.s .eb{letter-spacing:0;text-transform:none;font-size:10pt}
.big{font-family:Cairo;font-weight:700;font-size:26pt;line-height:1.2}
.lbl{line-height:1.5}
.tile p{line-height:1.6}
ul.b{padding-left:0;padding-right:5mm}ul.b li{line-height:1.6}
.tl b{font-family:Cairo;font-weight:700}.tl span{letter-spacing:0;text-transform:none;font-size:9pt}.tl p{line-height:1.55}
.s .foot{direction:rtl}`;

let n = 0;
const slide = (eb, title, body, { dark = false } = {}) => { n++; return `<section class="s${dark ? ' dark' : ''}">${eb ? `<div class="eb">${eb}</div>` : ''}${title ? `<h1>${title}</h1>` : ''}<div class="body">${body}</div>
<div class="foot"><span>${b(n)} · سري · للنقاش</span><img src="${dark ? LOGO_WHITE : LOGO_NAVY}"></div></section>`; };

export default () => { n = 0; return [

(() => { n++; return `<section class="s dark" style="padding:18mm 22mm"><div class="ring" style="width:190mm;height:190mm;left:-40mm;top:-20mm"></div><div class="ring" style="width:120mm;height:120mm;left:-5mm;top:15mm"></div>
<img src="${LOGO_WHITE}" style="height:11mm;align-self:flex-start">
<div style="margin-top:auto;max-width:140mm"><div class="eb">العرض التقديمي للمستثمرين · أكتوبر 2026</div>
<h1 style="font-size:40pt;margin-bottom:6mm">التطبيق المالي<br>لليبيا.</h1>
<p style="font-size:13.5pt;max-width:135mm">محافظ ومدفوعات ومراسلة وصرف عملات وادخار وتحويلات دولية ودفعات أعمال في تطبيق واحد بالعربية والإنجليزية، مع ضوابط مصرفية مدمجة.</p>
<p style="font-size:9pt;color:#7F93A8;margin-top:8mm">سري. ليس عرضًا لأوراق مالية. التوقعات تقديرات تخطيطية. التراخيص وشركاء الدفع الحيّون غير قائمين بعد.</p></div>
<div style="position:absolute;left:22mm;top:40mm;height:150.5mm;overflow:hidden;display:flex;gap:7mm;align-items:flex-start"><img src="${still('send')}" style="height:132mm;border-radius:7mm;border:2.4mm solid #05080C;margin-top:22mm"><img src="${still('home')}" style="height:160mm;border-radius:8mm;border:2.6mm solid #05080C"></div></section>`; })(),

slide('المشكلة', 'المال في ليبيا صعب الحفظ والتحريك والتحويل', `<div class="cols4">
<div class="tile"><h3>السيولة شحيحة</h3><p>طوابير الفروع وسقوف السحب تبطئ الحصول على النقد، والمدفوعات بين الناس ما زالت بالأوراق النقدية.</p></div>
<div class="tile"><h3>الأسعار غير واضحة</h3><p>يقارن الناس الأسعار غير الرسمية بالكلام المتناقل، ونادرًا ما يرون التكلفة الكاملة قبل الالتزام.</p></div>
<div class="tile"><h3>الخارج مكلف</h3><p>العائلات التي تدفع للدراسة والعلاج والإعالة في الخارج تواجه قنوات بطيئة ورسومًا غامضة ودون تتبع.</p></div>
<div class="tile"><h3>المصارف ليست رقمية</h3><p>المحلات والمستقلون وأصحاب العمل بلا وسيلة بسيطة للدفع والاستلام وحفظ السجلات.</p></div></div>
<div class="cols3" style="margin-top:9mm">
<div><div class="big">${b((cbl.transfers / 1e9).toFixed(2))} مليار $</div><div class="lbl">حوالات بالنقد الأجنبي عبر المصارف الليبية، يناير–سبتمبر 2026</div></div>
<div><div class="big">${b((cbl.personal / 1e9).toFixed(2))} مليار $</div><div class="lbl">نقد أجنبي للأغراض الشخصية، الفترة نفسها</div></div>
<div><div class="big">${b((cbl.total / 1e9).toFixed(1))} مليار $</div><div class="lbl">إجمالي استخدامات المصارف للنقد الأجنبي، الفترة نفسها</div></div></div>
<p style="font-size:8.5pt;color:#8A97A6;margin-top:6mm">المصدر: مصرف ليبيا المركزي، استخدامات النقد الأجنبي حتى نهاية سبتمبر 2026. للسياق فقط، دون استنتاج حصة سوقية.</p>`),

slide('المنتج', 'تطبيق واحد لكل حياتك المالية', `<div class="ph">
${[['home', 'أرصدة بكل العملات'], ['send', 'الإرسال باسم المستخدم أو الهاتف'], ['chat-payment', 'الدفع داخل المحادثة'], ['remit', 'التحويل إلى الخارج'], ['budgets', 'أهداف الادخار'], ['business', 'دفعات الأعمال']].map(([id, t]) => `<div><img src="${still(id)}">${t}</div>`).join('')}</div>`),

slide('أين نقف', 'مبنية ومختبرة، وجاهزة لشركائها', `<div class="cols3" style="row-gap:8mm">
<div><div class="big">${b(platform.screens)}</div><div class="lbl">شاشة جوال بالعربية والإنجليزية</div></div>
<div><div class="big">${b(platform.cockpitPages)}</div><div class="lbl">صفحة في لوحة التحكم التشغيلية</div></div>
<div><div class="big">${b('400+')}</div><div class="lbl">نقطة API، منها واجهة عامة للأعمال</div></div>
<div><div class="big">${b(platform.tests)}</div><div class="lbl">اختبارًا ناجحًا للخادم على قاعدة بيانات حقيقية</div></div>
<div><div class="big">${b(platform.corridors)}</div><div class="lbl">ممرًا للتحويل مهيّأة (تجريبية)</div></div>
<div><div class="big">${b(platform.engMonthsLow + '–' + platform.engMonthsHigh)}</div><div class="lbl">شهر عمل هندسي لإعادة البناء (تقدير)</div></div></div>
<div class="chips" style="margin-top:9mm;display:flex;gap:4mm;align-items:center;font-size:10.5pt;color:#3C4A58">من ${b(features.length)} ميزة في العرض: ${chip('ready', b(statusCounts.ready) + ' مكتملة')} ${chip('partner', b(statusCounts.partner) + ' بانتظار شريك')} ${chip('off', b(statusCounts.off) + ' معطّلة في الإنتاج')}</div>`),

slide('نموذج العمل', 'الأفراد يجلبون الحجم، والمؤسسات تجلب الربحية', `<div class="cols">
<div><div class="tile" style="margin-bottom:4mm"><h3>الأفراد</h3><p>المدفوعات المجانية بين المستخدمين تنشر الشبكة. والدخل من الصرف والتحويل الدولي: رسم ${b('0.10%')} وهامش صرف حتى ${b('0.35%')}، يظهران قبل التأكيد. ${pctA(fee['All-in consumer charge rate'], 2)} شاملة تحت سقف ${b('0.50%')}.</p></div>
<div class="tile"><h3>المؤسسات</h3><p>المصارف ومزودو الدفع يرخّصون برمجيات العمليات: المطابقة والاستثناءات والخزينة والاعتمادات. تجربة ${b('$25k')} · تنفيذ ${b('$75k')} · ${b('$120k')} سنويًا.</p></div></div>
<div><div style="font-size:10pt;font-weight:700;margin-bottom:1mm">إيرادات الحالة الأساسية حسب المصدر (مليون دولار)</div>${legend([['الأفراد', C.s1], ['الاشتراكات', C.s2], ['التجارب والتنفيذ', C.s3]])}
${bars([{ name: 'الأفراد', color: C.s1, values: B.years.map(y => y.consumer) }, { name: 'الاشتراكات', color: C.s2, values: B.years.map(y => y.sub) }, { name: 'التجارب', color: C.s3, values: B.years.map(y => y.project) }], 560)}</div></div>`),

slide('محرك الصرف', 'كل سعر بالدينار، من محرك واحد منضبط', `<div style="width:250mm;margin:0 0 5mm auto">${mmSvgAr}</div>
<ul class="b" style="columns:2;column-gap:12mm">
<li><b>تسعير ثنائي</b> حول سعر مرجعي حي؛ والفارق يظهر قبل التأكيد.</li>
<li><b>أرضية وسقوف:</b> لا ينزل سعر البيع عن المرجع، ولا يرفعه الطلب أكثر من 300 نقطة.</li>
<li><b>إشارة عادلة:</b> لا يتحرك السعر بأقل من ثلاثة عملاء؛ العمليات المتعاكسة تلغي بعضها، وتأثير كل عميل محدود.</li>
<li><b>الأمان:</b> البيانات المتقادمة توسّع الفارق ثم توقفه؛ مفاتيح إيقاف؛ والإعدادات لا تتغير إلا بطلب معتمد.</li></ul>`),

slide('اقتصاديات الوحدة', 'تحويل واحد بقيمة 6,000 دينار، سطرًا بسطر', `<div class="cols">
<table><tr><th>العميل</th><th class="n">المبلغ</th></tr>
<tr><td>يرسل</td><td class="n">${b('6,000.00')} د.ل</td></tr><tr><td>الرسم (${b('0.10%')})</td><td class="n">${b(fee['Explicit fee in local currency'].toFixed(2))} د.ل</td></tr>
<tr><td>السعر (المرجع ${b('6.0000')})</td><td class="n">${b(fee['Customer local currency per recipient USD'].toFixed(4))}</td></tr>
<tr class="total"><td>يستلم المستفيد</td><td class="n">${usdA(fee['Recipient receives USD'], 2)}</td></tr><tr class="sub"><td>التكلفة الشاملة</td><td class="n">${pctA(fee['All-in consumer charge rate'], 2)}</td></tr></table>
<table><tr><th>الشركة</th><th class="n">دولار</th></tr>
<tr><td>الرسم + هامش الصرف</td><td class="n">${usdA(fee['Gross revenue USD'], 2)}</td></tr><tr><td>حصة الشريك</td><td class="n">${usdA(-fee['Partner share USD'], 2)}</td></tr>
<tr><td>قناة الصرف والخسائر والانزلاق</td><td class="n">${usdA(-(fee['Rail fee USD'] + fee['Expected loss USD'] + fee['FX slippage USD']), 2)}</td></tr>
<tr class="total"><td>المساهمة</td><td class="n">${usdA(fee['Contribution per transfer USD'], 2)}</td></tr></table></div>
<p style="margin-top:4mm">هامش رقيق عن قصد: نشاط الأفراد يبني الحجم والثقة، ويسترد تكلفة اكتساب قدرها ${b('$30')} في نحو ${b(Math.round(fee['CAC payback months']))} شهرًا. وكل ${b('0.10%')} إضافية من الهامش المعتمد تضيف نحو ${mAr(B.years[4].volume * 0.001 * 0.9)} إلى إيرادات السنة الخامسة.</p>`),

slide('الوصول إلى السوق', 'اكسب الشارع، ثم الممر', `<div class="cols4">
<div class="tile"><h3>الشوارع</h3><p>فرق الطوابير أمام المصارف والأسواق، ومكاتب أسعار متنقلة، و20 سفيرًا جامعيًا.</p></div>
<div class="tile"><h3>المحلات</h3><p>300 محل في 90 يومًا، وتحالف محلات الهواتف، ومدخل الرواتب، وأساطيل السائقين.</p></div>
<div class="tile"><h3>الهواتف</h3><p>روابط الاستلام افتراضيًا، وحجز الأسماء، وسباقات الإحالة، وقناة متابعة السعر.</p></div>
<div class="tile"><h3>المناسبات</h3><p>العيدية برابط، وليالي رمضان، وادخار الحج، والأعراس، وكرة القدم.</p></div></div>
<div class="cols4" style="margin-top:8mm">
<div><div class="big">${intA(B.years[0].active)}</div><div class="lbl">عميل نشط بنهاية الشهر 12 (الأساسية)</div></div>
<div><div class="big">${intA(B.years[1].active)}</div><div class="lbl">بنهاية الشهر 24 (الأساسية)</div></div>
<div><div class="big">${b('$30')}</div><div class="lbl">التكلفة المستهدفة لكل عميل</div></div>
<div><div class="big">${b('$18k')}</div><div class="lbl">الميزانية الشهرية، السنة 1</div></div></div>
<p style="font-size:10pt;margin-top:6mm">جريء في الانتشار، صارم في الادعاءات: لا حسابات آلية ولا رسائل مزعجة ولا تقييمات مزيفة؛ كل ادعاء مالي يعتمده إنسان؛ والمكافآت بعد التوثيق وإتمام عملية مسوّاة فقط.</p>`),

slide('التوقعات المالية', 'خمس سنوات، ثلاث حالات', `<div class="cols" style="grid-template-columns:1.2fr 1fr">
<div>${caseLeg}${bars([{ name: 'المتحفظة', color: C.s2, values: D.years.map(y => y.revenue) }, { name: 'الأساسية', color: C.s1, values: B.years.map(y => y.revenue) }, { name: 'النمو', color: C.s3, values: G.years.map(y => y.revenue) }])}</div>
<table><tr><th>السنة 5 (مليون دولار)</th><th class="n">المتحفظة</th><th class="n">الأساسية</th><th class="n">النمو</th></tr>
<tr><td>الإيرادات</td>${[D, B, G].map(c => `<td class="n">${nM(c.years[4].revenue, 1)}</td>`).join('')}</tr>
<tr><td>النتيجة التشغيلية</td>${[D, B, G].map(c => `<td class="n">${Math.abs(c.years[4].op) < 5e3 ? b('≈ 0') : nM(c.years[4].op, 1)}</td>`).join('')}</tr>
<tr><td>العملاء النشطون</td>${[D, B, G].map(c => `<td class="n">${intA(c.years[4].active)}</td>`).join('')}</tr>
<tr><td>معدل الاشتراكات</td>${[D, B, G].map(c => `<td class="n">${nM(c.years[4].arr, 1)}</td>`).join('')}</tr>
<tr><td>حجم التحويلات</td>${[D, B, G].map(c => `<td class="n">${nM(c.years[4].volume, 0)}</td>`).join('')}</tr></table></div>
<p style="font-size:9pt;color:#8A97A6;margin-top:3mm">الإيرادات بملايين الدولارات. تقديرات تخطيطية من النموذج المالي المتكامل؛ لم تُرصد بعد موافقة تسعير أو عقد مزوّد أو سلوك عملاء.</p>`),

slide('رأس المال', 'معظم العشرة ملايين يبقى في الميزانية', `<div class="cols" style="grid-template-columns:1fr 1.2fr">
<div><table><tr><th>استخدام العشرة ملايين (الأساسية)</th><th class="n">مليون $</th></tr>
<tr><td>التمويل المسبق للتسوية (الذروة)</td><td class="n">${nM(B.peakPrefund, 1)}</td></tr>
<tr><td>احتياطي الضمانات</td><td class="n">${b('1.0')}</td></tr>
<tr><td>الخسائر والتأسيس، 5 سنوات</td><td class="n">${nM(-cumLoss('Base'), 1)}</td></tr>
<tr class="total"><td>أدنى نقد حر</td><td class="n">${nM(B.minFree, 1)}</td></tr></table>
<p style="font-size:10.5pt">التمويل المسبق رأس مال عامل في مخزون الصرف وليس إنفاقًا. وتحتاج حالة النمو إلى نحو ${mAr(G.gap, 1)} سيولة إضافية بحلول السنة الخامسة، والأنسب توفيرها بتسهيل تسوية.</p></div>
<div><div style="font-size:10pt;font-weight:700;margin-bottom:1mm">النقد الحر للشركة شهريًا (مليون دولار)</div>${rtlSvg(lines({ xLabels: Array.from({ length: 60 }, (_, i) => `الشهر ${i + 1}`), every: 12, height: 240, width: 620, unit: 'm', font: 'Cairo', series: [{ name: 'المتحفظة', color: C.s2, values: D.monthly.map(m => m.free) }, { name: 'الأساسية', color: C.s1, values: B.monthly.map(m => m.free) }, { name: 'النمو', color: C.s3, values: G.monthly.map(m => m.free) }] }))}</div></div>`),

slide('الهيكل', 'أربع شركات، لكل منها مهمة واحدة', `<div class="cols" style="grid-template-columns:1fr 1.35fr;align-items:center">
<ul class="b"><li><b>التقنية</b> تملك الملكية الفكرية ولا تحتفظ بأموال العملاء أبدًا.</li>
<li><b>ليبيا</b> تخدم العملاء بترخيصها أو بترخيص شريك مرخّص.</li>
<li><b>التحويلات</b> تدفع للمستفيدين في الخارج وكيلةً لجهة رئيسية مرخّصة.</li>
<li>أموال العملاء محمية ولا تموّل التشغيل أبدًا.</li></ul>
<div>${groupSvgAr}</div></div>`),

slide('خارطة الطريق بعد التمويل', 'من الإغلاق إلى ممر حي', `<div class="tl">
<div><span>الأشهر 0–3</span><b>الأساسات</b><p>الشركات والتعيينات الرئيسية ومسار الترخيص والمصرف الشريك واختبار الاختراق وتمرين الاستعادة والمطابقة الافتتاحية.</p></div>
<div><span>الأشهر 3–6</span><b>التجربة</b><p>عملاء مدعوون وحدود منخفضة ومطابقة يومية؛ وتوقيع أول تجربة برمجيات.</p></div>
<div><span>الأشهر 6–12</span><b>الإطلاق في ليبيا</b><p>طرابلس ثم بنغازي ومصراتة؛ الصرف ضمن التسعير المعتمد؛ وأول تنفيذ.</p></div>
<div><span>الأشهر 12–24</span><b>أول ممر</b><p>ممر واحد قابل للتمويل المصرفي عبر جهة رئيسية مرخّصة؛ وتسهيل تسوية.</p></div>
<div class="later"><span>الأشهر 24–36</span><b>التوسع</b><p>ممرات إضافية؛ والبطاقات وسوق P2P حيث تسمح الاقتصاديات والأذونات.</p></div>
<div class="later"><span>السنتان 4–5</span><b>الإقليم</b><p>شمال أفريقيا والشرق الأوسط والخليج. غير مشمول في التوقعات.</p></div></div>
<p style="margin-top:8mm;font-size:10.5pt">لا شيء يُطلق قبل توقيع تسع بوابات: الترخيص، والمزوّدون، والأمن، ومسارات الأموال، والأجهزة، والاستعادة، والعمليات، وحماية أموال العملاء، والخزينة. والبرمجيات تفرض ذلك.</p>`),

slide('المخاطر', 'ما الذي قد يسوء، وكيف نتعامل معه', `<table>
<tr><th style="width:30%">الخطر</th><th>المعالجة</th></tr>
<tr><td>تأخر الترخيص أو رفضه</td><td>الإطلاق تحت شريك مرخّص؛ وإيرادات البرمجيات لا تحتاج ترخيص تزدان</td></tr>
<tr><td>قبول المصارف للنموذج أو للمساهمين</td><td>ملكية شفافة؛ ومراجعة المصرف المستقبِل قبل الإغلاق؛ وعدة مصارف بالتوازي</td></tr>
<tr><td>تدفقات الصرف أحادية الاتجاه والسيولة</td><td>تمويل مسبق ذاتي ثم تسهيل تسوية؛ وإيقاف التسعير عند انخفاض المخزون</td></tr>
<tr><td>سقوف التسعير</td><td>النموذج يفترض أصلًا ${b('0.45%')} شاملة تحت سقف ${b('0.50%')}</td></tr>
<tr><td>الأمن والاحتيال والجرائم المالية</td><td>الدخول بخطوتين، والتحقق الإضافي، ومحرك المخاطر، وفحص العقوبات، ورسم الاحتيال؛ واختبار اختراق خارجي قبل الإطلاق</td></tr>
<tr><td>الاعتماد على شخص واحد</td><td>تعيينات المرحلة الأولى، وتوثيق موسّع، ونقل الملكية الفكرية إلى المجموعة عند الإغلاق</td></tr></table>`),

slide('المقترح', 'استثمار بقيمة 18 مليون دولار مقابل 40%', `<div class="cols4" style="margin-top:2mm">
<div><div class="big">${mAr(deal.primary, 0)}</div><div class="lbl">أسهم جديدة: رأس مال للشركة (${pctA(deal.primaryPct, 1)})</div></div>
<div><div class="big">${mAr(deal.secondary, 0)}</div><div class="lbl">أسهم قائمة من المؤسس (${pctA(deal.secondaryPct, 1)})</div></div>
<div><div class="big">${mAr(deal.post, 0)}</div><div class="lbl">القيمة الضمنية للملكية بعد الاستثمار</div></div>
<div><div class="big">${b('60 / 40')}</div><div class="lbl">المؤسس / المستثمر بعد الإغلاق</div></div></div>
<div class="cols" style="margin-top:9mm"><ul class="b"><li>مجلس من خمسة: اثنان للمؤسس، واثنان للمستثمر، ومستقل يرأس لجنة التدقيق والمخاطر.</li><li>موافقة المستثمر على المسائل المحجوزة: الأسهم الجديدة والبيع والاقتراض والموازنة والأسواق الجديدة.</li><li>الشقّان بالسعر نفسه؛ غير ملزم ويخضع للفحص النافي للجهالة.</li></ul>
<ul class="b"><li><b>التالي:</b> عرض سري على بيانات افتراضية.</li><li>تأهيل المستثمر: الكيان والمالكون المستفيدون ومصدر الأموال ومراجعة المصرف.</li><li>إشارة مكتوبة بالشروط، ثم فحص نافٍ للجهالة مع الاطلاع على الكود بموجب اتفاقية سرية.</li></ul></div>`, { dark: true }),

slide('', 'مبنية. وجاهزة لشركائها.', `<div class="cols" style="margin-top:4mm"><div><p style="font-size:13pt">هذا العرض جزء من حزمة المستثمر لتزدان:</p>
<ul class="b"><li>مذكرة المستثمر</li><li>الهيكل المؤسسي والحوكمة</li><li>نماذج الإيرادات والتسعير</li><li>النموذج المالي المتكامل (Excel) وملخصه</li><li>دليل النمو الميداني</li><li>فيديو عرض المنتج وفهرس الميزات</li><li>خارطة الإطلاق وسجل المخاطر والأدلة والمصادر</li></ul></div>
<div style="align-self:end"><p style="font-size:9pt;color:#7F93A8">سري. أعدّه مؤسس تزدان للمستثمرين المحتملين. ليس عرضًا لبيع أوراق مالية ولا دعوة لشرائها. التوقعات تقديرات تخطيطية وليست وعودًا. التراخيص والشراكات المصرفية وقنوات الدفع الحية غير قائمة بعد.</p></div></div>`, { dark: true }),
].join('\n'); };
