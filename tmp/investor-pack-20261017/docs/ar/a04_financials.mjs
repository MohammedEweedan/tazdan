import { groupedBars, lines, legend, C } from '../lib.mjs';
import { cases, param, cumLoss, sum } from '../data.mjs';
import { coverAr, mAr, nM, usdA, intA, b, zA, rtlSvg } from './lib_ar.mjs';

const D = cases.Downside, B = cases.Base, G = cases.Growth;
const yrs = ['السنة 1', 'السنة 2', 'السنة 3', 'السنة 4', 'السنة 5'];
const ser = f => [{ name: 'المتحفظة', color: C.s2, values: D.years.map(f) }, { name: 'الأساسية', color: C.s1, values: B.years.map(f) }, { name: 'النمو', color: C.s3, values: G.years.map(f) }];
const revChart = rtlSvg(groupedBars({ categories: yrs, series: ser(y => y.revenue), height: 200, unit: 'm', font: 'Cairo' }));
const opChart = rtlSvg(groupedBars({ categories: yrs, series: ser(y => y.op), height: 190, unit: 'm', font: 'Cairo' }));
const cashChart = rtlSvg(lines({ xLabels: Array.from({ length: 60 }, (_, i) => `الشهر ${i + 1}`), every: 12, height: 200, unit: 'm', font: 'Cairo', series: [
  { name: 'المتحفظة', color: C.s2, values: D.monthly.map(m => m.free) }, { name: 'الأساسية', color: C.s1, values: B.monthly.map(m => m.free) }, { name: 'النمو', color: C.s3, values: G.monthly.map(m => m.free) }] }));
const caseLegend = legend([['المتحفظة', C.s2], ['الأساسية', C.s1], ['النمو', C.s3]]);
const row = (label, f, fmt = v => usdA(v), cls = '') => `<tr${cls ? ` class="${cls}"` : ''}><td>${label}</td>${B.years.map(y => `<td class="n">${fmt(f(y))}</td>`).join('')}</tr>`;
const p = k => param[k];
const labelAr = { launch: 'شهر الإطلاق المفترض', cac: 'تكلفة اكتساب عميل أتمّ عملية', churn: 'التسرّب الشهري للعملاء النشطين', frequency: 'عدد التحويلات لكل عميل نشط شهريًا', ticket: 'متوسط قيمة التحويل', fee: 'نسبة الرسم الصريح', spread: 'هامش الصرف فوق السعر المرجعي', provider: 'تكلفة قناة الصرف على المبلغ المحوَّل', share: 'حصة الشريك من الإيراد', mkt1: 'ميزانية الاكتساب الشهرية، السنة 1', staff1: 'عدد الموظفين، السنة 1', staff5: 'عدد الموظفين، السنة 5', salary: 'التكلفة الشهرية الكاملة لكل موظف', annual: 'سعر الاشتراك السنوي للبرمجيات', b2bNew: 'عمليات تنفيذ جديدة لكل ربع سنة', setup: 'نفقات التأسيس لمرة واحدة' };
const fP = v => b((v * 100).toFixed(2).replace(/\.?0+$/, '') + '%'), fU = v => usdA(v), fN = v => b(String(v));
const a = (k, fmt) => `<tr><td>${labelAr[k]}</td><td class="n">${fmt(p(k).downside)}</td><td class="n">${fmt(p(k).base)}</td><td class="n">${fmt(p(k).growth)}</td></tr>`;

export default () => `
${coverAr({ eyebrow: '04 · النموذج المالي', title: 'ملخص<br>النموذج المالي', sub: 'توقعات لخمس سنوات بثلاث حالات، مبنية من العملاء والتحويلات والأسعار والتكاليف. توضح ما تفعله العشرة ملايين دولار من رأس المال الجديد، وأين يذهب النقد، وما الذي يجب أن يتحقق.', docNo: 'المستند 04' })}

<div class="eyebrow">نظرة عامة</div>
<h1 class="h">ثلاث حالات، ومجموعة معادلات واحدة</h1>
<p class="lead">يقود ملف Excel توقعات لستين شهرًا من خلال مُحدِّد حالة واحد. تُبنى الإيرادات من العملاء النشطين، وعدد التحويلات لكل عميل، ومتوسط قيمتها، والسعر، إضافة إلى المؤسسات المشتركة في البرمجيات. كل تكلفة تظهر منفصلة، ولا تُحتسب أموال العملاء أبدًا إيرادًا أو نقدًا للشركة. الملف نفسه باللغة الإنجليزية.</p>
<div class="kpis">
<div class="kpi"><div class="v">${mAr(B.years[4].revenue)}</div><div class="l">إيرادات السنة 5، الحالة الأساسية (حالة النمو ${mAr(G.years[4].revenue)})</div></div>
<div class="kpi"><div class="v">نقطة التعادل</div><div class="l">النتيجة التشغيلية في السنة 5، الحالة الأساسية (النمو ${mAr(G.years[4].op)})</div></div>
<div class="kpi"><div class="v">${intA(B.years[4].active)}</div><div class="l">عميل نشط بنهاية السنة 5، الحالة الأساسية</div></div>
<div class="kpi"><div class="v">${mAr(-cumLoss('Base'))}</div><div class="l">الخسائر المتراكمة خلال خمس سنوات، شاملة التأسيس</div></div>
</div>
<figure><div class="fig-title">إجمالي إيرادات الشركة حسب الحالة (مليون دولار)</div>${caseLegend}${revChart}</figure>
<table>
<tr><th>الحالة</th><th class="n">إيرادات س1</th><th class="n">إيرادات س3</th><th class="n">إيرادات س5</th><th class="n">النتيجة التشغيلية س5</th><th class="n">العملاء س5</th><th class="n">ذروة التمويل المسبق</th><th class="n">فجوة التمويل</th></tr>
${[['المتحفظة', D], ['الأساسية', B], ['النمو', G]].map(([n, c]) => `<tr><td><b>${n}</b></td><td class="n">${nM(c.years[0].revenue)}</td><td class="n">${nM(c.years[2].revenue)}</td><td class="n">${nM(c.years[4].revenue)}</td><td class="n">${Math.abs(c.years[4].op) < 5e3 ? 'التعادل' : nM(c.years[4].op)}</td><td class="n">${intA(c.years[4].active)}</td><td class="n">${nM(c.peakPrefund)}</td><td class="n">${c.gap ? nM(c.gap) : 'لا توجد'}</td></tr>`).join('')}
</table>
<p class="note">المبالغ بملايين الدولارات. النتيجة التشغيلية قبل التأسيس والضرائب والتمويل. فجوة التمويل هي أكبر نقد إضافي تحتاجه الشركة في أي شهر فوق العشرة ملايين المقترحة. الحالات اختبارات حساسية وليست احتمالات.</p>

<div class="section"></div>
<div class="eyebrow">الحالة الأساسية</div>
<h1 class="h">توقعات السنوات الخمس، الحالة الأساسية</h1>
<table>
<tr><th>دولار أمريكي</th>${yrs.map(y => `<th class="n">${y}</th>`).join('')}</tr>
${row('حجم تحويلات العملاء (أصل المبالغ)', y => y.volume)}
<tr class="sub"><td colspan="6">الإيرادات</td></tr>
${row('إيرادات الأفراد بعد حصة الشريك', y => y.consumer)}
${row('اشتراكات البرمجيات', y => y.sub)}
${row('التجارب والتنفيذ', y => y.project)}
${row('إجمالي إيرادات الشركة', y => y.revenue, undefined, 'total')}
${row('مجمل الربح', y => y.gp)}
${row('النتيجة التشغيلية قبل التأسيس والضرائب', y => y.op)}
${row('نفقات التأسيس لمرة واحدة', y => -y.setup)}
${row('النتيجة قبل الضرائب', y => y.result, undefined, 'total')}
<tr class="sub"><td colspan="6">مؤشرات التشغيل، نهاية السنة</td></tr>
${row('العملاء الأفراد النشطون', y => y.active, intA)}
${row('المؤسسات المشتركة', y => y.b2b, v => b(v.toFixed(1)))}
${row('معدل الاشتراكات السنوي', y => y.arr)}
${row('النقد الحر للشركة بعد الاحتياطيات', y => y.free)}
</table>
<figure><div class="fig-title">النتيجة التشغيلية حسب الحالة (مليون دولار)</div>${caseLegend}${opChart}<figcaption>تبلغ الحالة الأساسية نقطة التعادل في السنة الخامسة. وتصبح حالة النمو رابحة في السنة الثانية وتحقق ${mAr(G.years[4].op)} في السنة الخامسة.</figcaption></figure>

<div class="section"></div>
<div class="eyebrow">النقد ورأس المال</div>
<h1 class="h">معظم العشرة ملايين يبقى في الميزانية</h1>
<p class="lead">في الحالة الأساسية يُنفق نحو ${mAr(-cumLoss('Base'), 1)} فقط من رأس المال الجديد على الخسائر خلال خمس سنوات. الاستخدام الأكبر هو التمويل المسبق للتسوية: أموال الشركة نفسها في مخزون الصرف ليتسلّم المستفيدون في موعدهم. ويُسترد هذا المال إذا انخفض الحجم أو حلّ محله تسهيل مصرفي.</p>
<div class="grid2">
<table>
<tr><th>استخدام العشرة ملايين (الأساسية)</th><th class="n">مليون دولار</th></tr>
<tr><td>التمويل المسبق للتسوية في ذروته (السنة 5)</td><td class="n">${nM(B.peakPrefund)}</td></tr>
<tr><td>احتياطي ضمانات مقيّد</td><td class="n">${nM(p('restricted').base)}</td></tr>
<tr><td>الخسائر المتراكمة شاملة ${mAr(p('setup').base)} للتأسيس</td><td class="n">${nM(-cumLoss('Base'))}</td></tr>
<tr class="total"><td>أدنى نقد حر في أي شهر</td><td class="n">${nM(B.minFree)}</td></tr>
</table>
<div>
<h3>قراءة خط النقد</h3>
<ul>
<li><b>التمويل المسبق</b> يعادل ${b(p('prefund').base)} أيام من الحجم المحوَّل مضروبة في ${b(p('stress').base)} للضغط. يكبر مع الحجم، وهو رأس مال عامل لا إنفاق.</li>
<li><b>الضمانات</b> احتياطي تخطيطي لما قد يطلبه الشركاء؛ والرقم الفعلي يحدده الترخيص والمصرف.</li>
<li><b>لا دخل من أموال العملاء</b> مفترض، ولا يُستخدم أي دين.</li>
</ul>
</div>
</div>
<figure><div class="fig-title">النقد الحر للشركة بعد التمويل المسبق والاحتياطيات، شهريًا (مليون دولار)</div>${cashChart}
<figcaption>ينفد النقد الحر في حالة النمو خلال السنة الثالثة لأن التمويل المسبق يكبر مع الحجم، وتحتاج إلى نحو ${mAr(G.gap, 1)} إضافية بحلول السنة الخامسة، يُفضَّل أن تأتي من خط ائتمان للتسوية أو من تمويل مسبق لدى الشريك لا من أسهم جديدة. ومع ذلك تحقق حالة النمو ${mAr(sum('Growth', 'op', 5) - sum('Growth', 'op', 1), 1)} ربحًا تشغيليًا في السنوات من الثانية إلى الخامسة.</figcaption></figure>

<div class="section"></div>
<div class="eyebrow">الافتراضات</div>
<h1 class="h">المحرّكات وراء كل حالة</h1>
<table>
<tr><th>المحرّك</th><th class="n">المتحفظة</th><th class="n">الأساسية</th><th class="n">النمو</th></tr>
${a('launch', v => 'الشهر ' + b(v))}
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
<p class="note">كل المدخلات تقديرات تخطيطية: لم تُوقَّع أسعار مع أي مزوّد، ولا توجد موافقة موثقة على التسعير، ولم يُرصد سلوك أي عميل بعد. القائمة الكاملة للمحرّكات وأساس كل منها في ورقة Assumptions في الملف.</p>
<h2>ما الذي يجب أن يتحقق</h2>
<div class="grid2">
<ul>
<li><b>مسار قانوني لتحصيل الدينار وصرفه وتحويله،</b> بترخيص تزدان أو عبر شريك مرخّص.</li>
<li><b>موافقة على تسعير قرابة ${b('0.45%')} شاملة.</b> كل ${b('0.10%')} إضافية من الهامش المعتمد تضيف نحو ${mAr(B.years[4].volume * 0.001 * 0.9)} إلى إيرادات السنة الخامسة.</li>
<li><b>اكتساب العملاء بنحو ${b('$30')} للعميل</b>، مع تسرّب شهري لا يتجاوز ${b('3.5%')}.</li>
</ul>
<ul>
<li><b>تنفيذ مؤسسي جديد كل ربع سنة</b> بدءًا من السنة الأولى، باشتراك ${b('$120,000')} سنويًا.</li>
<li><b>سيولة الصرف:</b> تمويل مسبق ذاتي في الحالة الأساسية، ثم تسهيل تسوية مع نمو الحجم.</li>
<li><b>ضبط التكاليف وفق الخطة:</b> 10 موظفين في السنة الأولى، يرتفعون إلى 22 في السنة الخامسة.</li>
</ul>
</div>

<div class="section"></div>
<div class="eyebrow">ملف النموذج</div>
<h1 class="h">كيف تستخدم النموذج</h1>
<p>الملف: <b>Tazdan_Integrated_Financial_Model.xlsx</b> في هذا المجلد (باللغة الإنجليزية). الخلايا الزرقاء مدخلات، والسوداء معادلات، والخضراء روابط إلى أوراق أخرى. غيّر الحالة في ورقة Assumptions (1 المتحفظة، 2 الأساسية، 3 النمو) فتتحدّث كل الأوراق.</p>
<table>
<tr><th style="width:24%">الورقة</th><th>ما تعرضه</th></tr>
<tr><td>Summary</td><td>نتائج السنوات الخمس واحتياجات رأس المال ورسم شهري للإيرادات والنتيجة التشغيلية</td></tr>
<tr><td>Assumptions</td><td>كل المحرّكات للحالات الثلاث مع أساسها، ومُحدِّد الحالة، ومؤشرات الأدلة</td></tr>
<tr><td>Forecast</td><td>محرّك الستين شهرًا: العملاء والتحويلات والإيرادات والتكاليف والنقد والتمويل المسبق والاحتياطيات</td></tr>
<tr><td>Fee calculator</td><td>تسعير تحويل واحد سطرًا بسطر، واقتصاديات الوحدة، وفحص سقف التسعير</td></tr>
<tr><td>Rate margins</td><td>تسعير صانع السوق للدينار، والهامش حسب إعداد الفارق والحجم، وفحص تسعير الممرات</td></tr>
<tr><td>Acquisition</td><td>ميزانيات القنوات والمسار حتى العميل الذي أتمّ عملية، والتكلفة المركّبة</td></tr>
<tr><td>Deal structure</td><td>الاستثمار المقترح: الشقّان الأولي والثانوي والملكية والقيم الضمنية</td></tr>
<tr><td>CBL actuals</td><td>أرقام مصرف ليبيا المركزي المنشورة عن استخدامات النقد الأجنبي من يناير إلى سبتمبر 2026</td></tr>
<tr><td>Review</td><td>فحوص المطابقة التي يجب أن تساوي صفرًا، والأدلة المعلّقة</td></tr>
<tr><td>Model guide</td><td>التعريفات والمعالجة المحاسبية والقيود</td></tr>
</table>
<h2>الفحوص</h2>
<ul>
<li>أُعيد حساب كل حالة بشكل مستقل برمجيًا وطابقت الملف بفارق أقل من ${b('$0.001')} في كل بند ملخص.</li>
<li>مطابقات النقد والذمم المدينة والمساهمة في ورقة Review تساوي صفرًا.</li>
<li>تغيير مُدخَل في سنة لاحقة ينعكس على التوقعات، ولا يحتوي الملف أي أخطاء في المعادلات.</li>
</ul>
<p class="note">النموذج أداة تخطيط، وليس محاسبة مدققة أو نظامية أو ضريبية. التسوية في الإنتاج تتم بمبالغ دقيقة لكل عملة، لا بحسابات جدول البيانات.</p>
`;
