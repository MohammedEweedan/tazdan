"use client";

/**
 * Account deletion instructions — the public web page app stores ask for
 * (Google Play "delete account URL"). Bilingual inline so it does not depend
 * on the marketing translation files.
 */
import LegalPage from "@/components/ui/LegalPage";

const sections = [
  {
    title: "Delete your account in the app",
    body: "Open the Tazdan app, go to Profile and tap Delete account. The app shows anything that must be settled first, such as a balance to withdraw or a transfer still in progress. Confirm with the security code we send you. Your account closes immediately and you are signed out on every device.",
  },
  {
    title: "If you cannot use the app",
    body: "Email support@tazdan.com from the address on your account with the subject \"Delete my account\". We will confirm it is you before closing the account, and tell you if anything has to be settled first.",
  },
  {
    title: "What we delete and what we keep",
    body: "When the account closes, your public profile, photo and notification settings are removed and you can no longer sign in. As a regulated payment service we must keep records of your transactions and identity checks for 5 years after the account closes. After that period, your name, contact details, date of birth and identity documents are deleted. Transaction records remain only in anonymous form.",
  },
  {
    title: "حذف حسابك من التطبيق",
    body: "افتح تطبيق Tazdan، ثم الملف الشخصي، واضغط حذف الحساب. يعرض التطبيق ما يجب تسويته أولاً، مثل رصيد يجب سحبه أو تحويل لم يكتمل بعد. أكّد العملية برمز الأمان الذي نرسله إليك. يُغلق حسابك فوراً ويُسجَّل خروجك من جميع الأجهزة.",
  },
  {
    title: "إذا لم تتمكن من استخدام التطبيق",
    body: "راسلنا على support@tazdan.com من البريد المسجّل في حسابك بعنوان \"حذف حسابي\". سنتحقق من هويتك قبل إغلاق الحساب ونبلغك إن كان هناك ما يجب تسويته أولاً.",
  },
  {
    title: "ما الذي نحذفه وما الذي نحتفظ به",
    body: "عند إغلاق الحساب تُزال صفحتك العامة وصورتك وإعدادات الإشعارات ولن تتمكن من تسجيل الدخول. وبصفتنا خدمة دفع خاضعة للتنظيم، يلزمنا الاحتفاظ بسجلات معاملاتك والتحقق من هويتك لمدة 5 سنوات بعد إغلاق الحساب. بعد ذلك تُحذف بياناتك الشخصية ووسائل الاتصال وتاريخ الميلاد ووثائق الهوية، وتبقى سجلات المعاملات بصيغة مجهولة الهوية فقط.",
  },
];

export default function DeleteAccountPage() {
  return (
    <LegalPage
      eyebrow="Account · الحساب"
      title="Delete your Tazdan account"
      updated="October 2026"
      intro="How to close your account and what happens to your data. · كيف تغلق حسابك وماذا يحدث لبياناتك."
      sections={sections}
    />
  );
}
