// Arabic edition: chapter names, feature captions and statuses, and the Arabic-UI clips and stills.
// Feature order, ids and status kinds match ../data.mjs so the two editions stay in step.
import path from 'node:path';
import { WORK, ROOT } from '../lib.mjs';
import { features as EN } from '../data.mjs';

const V = p => path.join(ROOT, 'client/public/app', p);
const X = id => path.join(WORK, 'capture-ar', id, 'clip.mp4');
const P = id => path.join(WORK, 'capture-ar', id, 'poster.png');
const S = id => path.join(ROOT, 'client/public/app/screens/ar-dark', id + '.webp');
// Arabic chat clips with the unsubstantiated "تشفير من طرف إلى طرف" badge painted out (sanitize/sanitize.mjs, LOCALE=ar).
const Z = f => path.join(WORK, 'sanitize/ar', f);

export const chapters = ['المال اليومي', 'المدفوعات الاجتماعية', 'الصرف والأسواق', 'التحويلات الدولية', 'الادخار والمجتمع', 'الثقة والأمان', 'الأعمال', 'باللغتين'];

const AR = {
  home: [V('loops/ar-dark/home.mp4'), S('home'), 'الرئيسية والأرصدة', 'كل العملات والأصول في رصيد واحد، مع جهات الاتصال وآخر العمليات في متناول اليد.', 'مكتمل'],
  topup: [V('loops/ar-dark/topup.mp4'), S('topup'), 'شحن الرصيد', 'تحويل مصرفي أو عبر P2P أو نقدًا، ولكل طريقة تعليماتها الواضحة.', 'مكتمل · بانتظار الحسابات المصرفية'],
  send: [V('loops/ar-dark/send.mp4'), S('send'), 'أرسل لأي شخص', 'ادفع باسم المستخدم أو رقم الهاتف أو من جهات الاتصال. فحوص المخاطر والتحقق الإضافي تسبق تحريك الأموال.', 'مكتمل'],
  receive: [X('receive'), P('receive'), 'الاستلام باسم المستخدم أو رمز QR', 'اسم مستخدم ورابط دفع ورمز QR شخصي، يمكن لأي أحد الدفع عبرها.', 'مكتمل'],
  claim: [X('claim'), P('claim'), 'روابط الاستلام', 'أرسل المال لمن لم يسجّل في تزدان بعد؛ ينضم ليستلمه، فتصبح كل دفعة دعوة.', 'مكتمل'],
  history: [X('history'), P('history'), 'السجل والإيصالات', 'كل عملية بمرجعها، مع روابط الاستلام المعلّقة وإيصال لكل دفعة.', 'مكتمل'],
  statements: [X('statements'), P('statements'), 'كشوف الحساب', 'كشوف PDF جاهزة للتدقيق حسب الفترة والعملة، تشمل الأرصدة والرسوم وسجل العمليات كاملًا.', 'مكتمل'],
  messages: [Z('messages.mp4'), S('messages'), 'المراسلة', 'محادثات مع جهات الاتصال، فيلتقي المال والرسائل في مكان واحد.', 'مكتمل'],
  'chat-payment': [Z('chat-payment.mp4'), Z('chat-payment-still.png'), 'الدفع داخل المحادثة', 'أرسل المال داخل المحادثة واحصل على الإيصال في السلسلة نفسها.', 'مكتمل'],
  exchange: [X('exchange'), P('exchange'), 'صرف العملات', 'حوّل بين العملات. السعر يشمل فارق الصرف ويظهر قبل التأكيد.', 'مكتمل · بانتظار إذن الصرف'],
  buy: [V('loops/ar-dark/buy.mp4'), S('buy'), 'شراء الأصول الرقمية', 'عرض السعر والرسوم والتأكيد في مسار واحد، مع فحص الحدود قبل التأكيد.', 'التداول بأموال حقيقية معطّل'],
  asset: [V('loops/ar-dark/asset.mp4'), S('asset'), 'تفاصيل الأصل', 'رسوم بيانية حية والحيازات والأداء لكل أصل.', 'مكتمل · بيانات السوق'],
  portfolio: [X('portfolio'), P('portfolio'), 'المحفظة', 'توزيع الحيازات وأداؤها.', 'مكتمل'],
  recurring: [X('recurring'), P('recurring'), 'الشراء الدوري', 'جدولة الشراء أسبوعيًا أو شهريًا من رصيد تختاره.', 'معطّل مع التداول'],
  remit: [V('loops/ar-dark/remit.mp4'), S('remit'), 'التحويل إلى الخارج', 'عرض سعر الممر والمستفيد والمراجعة والتتبع. اثنا عشر ممرًا مهيّأة، منها المملكة المتحدة ومصر وتركيا والإمارات ومنطقة اليورو وتونس.', 'تجريبي · بانتظار شريك الصرف'],
  withdraw: [X('withdraw'), P('withdraw'), 'السحب', 'اسحب أي رصيد إلى مصرف أو محفظة، مع فحص وتقييم للمخاطر لكل طلب.', 'مكتمل · صرف مصرفي يدوي'],
  linked: [X('linked'), P('linked'), 'الحسابات والبطاقات المرتبطة', 'إدارة وسائل الدفع في مكان واحد.', 'بانتظار شركاء المصارف والبطاقات'],
  cards: [V('loops/ar-dark/cards.mp4'), S('cards'), 'البطاقات', 'التحكم في البطاقات الافتراضية والفعلية ومتابعة حركتها.', 'معطّل حتى توقيع جهة إصدار'],
  budgets: [V('loops/ar-dark/budgets.mp4'), S('budgets'), 'أهداف الادخار', 'أهداف مثل «حج 2027» بمساهمات مجدولة وقفل حتى تاريخ الهدف.', 'مكتمل'],
  p2p: [V('loops/ar-dark/p2p.mp4'), S('p2p'), 'سوق P2P بين الأفراد', 'عروض بين الأفراد مع حساب ضمان ونظام للنزاعات. يظهر البائع باسمه الأول والحرف الأول من عائلته ومنطقة تقريبية فقط.', 'مكتمل · معطّل افتراضيًا في الإنتاج'],
  referral: [X('referral'), P('referral'), 'الإحالات', 'رمز شخصي مع تتبع الدعوات ومكافأة للطرفين.', 'مكتمل'],
  kyc: [X('kyc'), P('kyc'), 'التحقق من الهوية', 'ثلاثة مستويات للتحقق، والحدود تظهر مباشرة وقبل أي تأكيد.', 'مكتمل · مراجعة يدوية'],
  security: [V('loops/ar-dark/settings.mp4'), S('devices'), 'مركز الأمان', 'التحقق بخطوتين، والأجهزة الموثوقة، وإنهاء الجلسات الأخرى عن بُعد.', 'مكتمل'],
  privacy: [V('loops/ar-dark/privacy-hidden.mp4'), S('privacy-hidden'), 'وضع الخصوصية', 'أخفِ الأرصدة بلمسة في الأماكن العامة، وتبقى أسعار السوق ظاهرة.', 'مكتمل'],
  business: [V('loops/ar-dark/business-home.mp4'), S('business-home'), 'حسابات الأعمال', 'ملفات أعمال موثّقة مع الدفع الجماعي، وموافقة ثانية فوق حدود محددة.', 'مكتمل · مستفيدون داخل المنصة'],
  'business-team': [X('business-team'), P('business-team'), 'الفريق والأدوار', 'أدوار المالك والمدير والمحلل والمطوّر، مع نظام الدعوات.', 'مكتمل'],
  'business-payouts': [X('business-payouts'), P('business-payouts'), 'اعتماد الدفعات', 'تنتظر الدفعات الاعتماد فوق حد الرقابة المزدوجة، ثم تظهر حالة كل سطر.', 'مكتمل'],
  'business-keys': [X('business-keys'), P('business-keys'), 'مفاتيح API والإشعارات', 'مفاتيح API محددة الصلاحيات ومؤقتة، وإشعارات موقّعة لتكاملات الأعمال.', 'مكتمل'],
  arabic: [V('loops/en-dark/home.mp4'), path.join(ROOT, 'client/public/app/screens/en-dark/home.webp'), 'وبالإنجليزية أيضًا', 'التطبيق نفسه بالإنجليزية بتخطيط من اليسار إلى اليمين، والتبديل بين اللغتين بلمسة.', 'مكتمل'],
};

export const features = EN.map(f => { const [src, still, title, desc, status] = AR[f.id]; return { ...f, src, still, title, desc, status, max: f.id === 'arabic' ? 8.5 : f.max }; });
export const statusCounts = features.reduce((a, f) => (a[f.kind] = (a[f.kind] || 0) + 1, a), {});
export const kindAr = { ready: 'مكتمل', partner: 'بانتظار شريك', off: 'معطّل في الإنتاج', plan: 'خارج الكود' };
