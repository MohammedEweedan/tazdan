import { chip } from '../lib.mjs';
import { cbl, platform } from '../data.mjs';
import { css as enCss } from '../d08_evidence.mjs';
import { coverAr, usdA, b } from './lib_ar.mjs';

const bn = v => b((v / 1e9).toFixed(2)) + ' مليار دولار';
export const css = enCss + `.src td:first-child{width:38%}.src a{direction:ltr;unicode-bidi:isolate}`;

export default () => `
${coverAr({ eyebrow: '08 · الأدلة والمصادر', title: 'الأدلة<br>والمصادر', sub: 'الحقائق وراء الحزمة: بيانات السوق المنشورة، والتحقق الهندسي، وقياسات المنصة، وكل مصدر خارجي مذكور مع روابطه.', docNo: 'المستند 08' })}

<div class="eyebrow">أدلة السوق</div>
<h1 class="h">استخدامات النقد الأجنبي لدى مصرف ليبيا المركزي، يناير–سبتمبر 2026</h1>
<p class="lead">ينشر مصرف ليبيا المركزي استخدامات المصارف للنقد الأجنبي، ويغطي أحدث تقرير متاح الأشهر التسعة الأولى من 2026. هذه أرقام فعلية رسمية بما يعادلها بالدولار الأمريكي، من الصفحة 2 المطبوعة في التقرير.</p>
<table>
<tr><th>البند</th><th class="n">يناير–سبتمبر 2026</th><th class="n">المتوسط الشهري</th></tr>
<tr><td>إجمالي استخدامات المصارف للنقد الأجنبي</td><td class="n">${usdA(cbl.total)}</td><td class="n">${bn(cbl.total / 9)}</td></tr>
<tr><td>الاعتمادات المستندية</td><td class="n">${usdA(cbl.lcs)}</td><td class="n">${bn(cbl.lcs / 9)}</td></tr>
<tr><td>الأغراض الشخصية</td><td class="n">${usdA(cbl.personal)}</td><td class="n">${bn(cbl.personal / 9)}</td></tr>
<tr><td>الحوالات</td><td class="n">${usdA(cbl.transfers)}</td><td class="n">${bn(cbl.transfers / 9)}</td></tr>
</table>
<p>تبلغ الحوالات في المتوسط نحو <b>${usdA(cbl.transfers / 9)}</b> شهريًا، أي معدل سنوي يقارب <b>${bn(cbl.transfers / 9 * 12)}</b> (حساب بسيط، لا توقع من المصرف المركزي). البنود لا تجمع إلى الإجمالي لأن البطاقات التجارية مدرجة منفصلة.</p>
<div class="callout"><p><b>كيف تستخدم الحزمة هذه الأرقام:</b> سياقًا لحجم تدفقات النقد الأجنبي الرسمية فقط. بند «الحوالات» أوسع بكثير من حوالات الأفراد، ولا يُستنتج منه عدد عملاء ولا توزيع ممرات ولا حصة سوقية. التوقعات مبنية من الأسفل إلى الأعلى من العملاء والتحويلات، ويعرض النموذج حجم الحالة الأساسية كنسبة من الحوالات الشهرية كفحص منطقي.</p></div>
<p class="note">المصدر: مصرف ليبيا المركزي، استخدامات النقد الأجنبي (صفحة الفهرس بالعربية)، التقرير حتى نهاية سبتمبر 2026، الصفحة 2. ${b(cbl.url)}</p>

<h2>التحقق الهندسي، 17 أكتوبر 2026</h2>
<table>
<tr><th>الفحص</th><th>النتيجة</th></tr>
<tr><td>اختبار الانحدار الكامل للخادم مع اختبارات قاعدة البيانات</td><td>${chip('ready', 'ناجح')} ${b(platform.suites)} مجموعة، ${b(platform.tests)} اختبارًا، دون أي تخطٍّ</td></tr>
<tr><td>تمرين ترحيل على قاعدة بيانات نظيفة</td><td>${chip('ready', 'ناجح')} طُبّقت الترحيلات الـ ${b(platform.migrations)} كلها</td></tr>
<tr><td>بناء الخادم للإنتاج والتحقق من المخطط</td><td>${chip('ready', 'ناجح')}</td></tr>
<tr><td>فحوص الأنواع للموقع والجوال</td><td>${chip('ready', 'ناجح')}</td></tr>
<tr><td>تدقيق ثغرات الحزم البرمجية</td><td>${chip('off', 'لم يكتمل')} تعذّر الوصول إلى سجل التنبيهات؛ لا تُدّعى نتيجة نظيفة</td></tr>
<tr><td>بيانات الإنتاج والمزوّدون الحيّون والأجهزة والحِمل</td><td>${chip('off', 'لم تُختبر')} خارج نطاق التحقق المحلي</td></tr>
</table>
<p class="note">نتائج محلية على قاعدة اختبار معزولة، دون الوصول إلى الإنتاج. تغطي الاختبارات الجديدة الحفظ الدقيق للأموال، والحدود المتزامنة، وعدم تكرار مراجع الخزينة، وإلغاء الجلسات، والحماية من إعادة الاستخدام.</p>

<div class="section"></div>
<div class="eyebrow">قياسات المنصة</div>
<h1 class="h">ما الذي بُني</h1>
<div class="grid2">
<table>
<tr><th>المقياس</th><th class="n">القيمة</th></tr>
<tr><td>نماذج قاعدة البيانات</td><td class="n">${b(platform.models)}</td></tr>
<tr><td>نقاط API</td><td class="n">${b(platform.endpoints)}</td></tr>
<tr><td>شاشات الجوال</td><td class="n">${b(platform.screens)}</td></tr>
<tr><td>صفحات لوحة التحكم</td><td class="n">${b(platform.cockpitPages)}</td></tr>
<tr><td>أسطر الكود: الخادم / الجوال / الويب</td><td class="n">${b(platform.serverLines + ' / ' + platform.mobileLines + ' / ' + platform.webLines)}</td></tr>
<tr><td>قواعد المخاطر / أدوار الموظفين / الصلاحيات</td><td class="n">${b(platform.riskRules + ' / ' + platform.staffRoles + ' / ' + platform.permissions)}</td></tr>
<tr><td>ممرات التحويل (تجريبية)</td><td class="n">${b(platform.corridors)}</td></tr>
<tr><td>محوّلات الصرف (8 تجريبية وواحد داخلي)</td><td class="n">${b(platform.adapters)}</td></tr>
</table>
<div>
<h3>تكلفة الإحلال (تقدير)</h3>
<p>تُقدَّر إعادة بناء المنصة بـ <b>${b(platform.engMonthsLow + '–' + platform.engMonthsHigh)} شهر عمل هندسي</b>، أي نحو <b>${b('0.9–2.4')} مليون دولار</b> بتكلفة كاملة ${b('$12,000–20,000')} لكل شهر عمل. ويحتاج فريق من ستة إلى ثمانية مهندسين 12 إلى 18 شهرًا.</p>
<p class="note">تقدير جهد قائم على التقدير، لا تقييم. لا يشمل التراخيص وعقود الشركاء وموظفي الامتثال والتقييمات الأمنية وتكلفة الوقت حتى السوق.</p>
<h3>تسميات الحالة في هذه الحزمة</h3>
<p>${chip('ready', 'مكتمل')} يعمل من البداية للنهاية في الكود دون تفعيل خارجي.<br>${chip('partner', 'بانتظار شريك')} مكتمل، لكنه يحتاج مصرفًا أو ترخيصًا أو شريك صرف.<br>${chip('off', 'معطّل في الإنتاج')} مبني، وترفضه المنصة في الإنتاج حتى تتحقق شروطه.</p>
</div>
</div>
<p class="note">قيست من المستودع في 7 أكتوبر 2026، مع تحديث أعداد الترحيلات والاختبارات والنماذج في 17 أكتوبر 2026.</p>

<div class="section"></div>
<div class="eyebrow">المصادر</div>
<h1 class="h">المصادر الخارجية المذكورة</h1>
<table class="src">
<tr><th>المصدر</th><th>الرابط</th></tr>
<tr><td>مصرف ليبيا المركزي، استخدامات النقد الأجنبي (فهرس التقارير)</td><td><a href="https://cbl.gov.ly/uses-of-foreign-exch/">cbl.gov.ly/uses-of-foreign-exch/</a></td></tr>
<tr><td>مصرف ليبيا المركزي، فهرس المنشورات (منها المنشورات 6/2026 و8/2026 و14/2026)</td><td><a href="https://cbl.gov.ly/publications/">cbl.gov.ly/publications/</a></td></tr>
<tr><td>مصرف ليبيا المركزي، دليل الدفع الإلكتروني</td><td><a href="https://cbl.gov.ly/en/electronic-payment/">cbl.gov.ly/en/electronic-payment/</a></td></tr>
<tr><td>مجموعة العمل المالي (FATF)، إرشادات الأشخاص المعرّضين سياسيًا</td><td><a href="https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Peps-r12-r22.html">fatf-gafi.org · PEPs R12/R22</a></td></tr>
<tr><td>مجموعة العمل المالي، الملكية المستفيدة للأشخاص الاعتباريين</td><td><a href="https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Guidance-Beneficial-Ownership-Legal-Persons.html">fatf-gafi.org · beneficial ownership</a></td></tr>
<tr><td>مجلس الأمن الدولي، لجنة العقوبات الخاصة بليبيا (1970)</td><td><a href="https://main.un.org/securitycouncil/en/sanctions/1970">un.org · sanctions 1970</a></td></tr>
<tr><td>مكتب مراقبة الأصول الأجنبية الأمريكي (OFAC)، برنامج ليبيا وإرشادات الملكية</td><td><a href="https://ofac.treasury.gov/sanctions-programs-and-country-information/libya-sanctions">ofac.treasury.gov · Libya</a> · <a href="https://ofac.treasury.gov/faqs/401">FAQ 401</a></td></tr>
<tr><td>مصرف الإمارات المركزي، نظام أعمال الصرافة</td><td><a href="https://rulebook.centralbank.ae/en/rulebook/exchange-business-regulation">rulebook.centralbank.ae</a></td></tr>
<tr><td>هيئة السلوك المالي البريطانية (FCA)، طلبات مؤسسات الدفع</td><td><a href="https://www.fca.org.uk/firms/apply-emoney-payment-institution/pi">fca.org.uk</a></td></tr>
<tr><td>ادعاءات تغطية شبكات الصرف (Nium وThunes)</td><td><a href="https://docs.nium.com/docs/payouts">docs.nium.com</a> · <a href="https://www.thunes.com/direct-global-network/">thunes.com</a></td></tr>
</table>
<p class="note">صفحات تغطية المزوّدين ادعاءاتهم الخاصة، ولا يؤكد أيٌّ منها قبول تزدان أو الأموال الصادرة من ليبيا أو أي ممر بعينه. والمصادر التنظيمية مذكورة للبنية لا كاستنتاجات قانونية، وانطباق كل قاعدة يحتاج مراجعة المستشار القانوني.</p>
`;
