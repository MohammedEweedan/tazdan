'use client';

/**
 * Cockpit UI strings in English and Arabic. Data values (names, references,
 * amounts) are shown as stored; only interface text is translated. The
 * cockpit root sets dir="rtl" for Arabic.
 */
import { create } from 'zustand';

export type CockpitLang = 'en' | 'ar';

const AR: Record<string, string> = {
  'Control Cockpit': 'غرفة التحكم',
  Overview: 'نظرة عامة',
  Customers: 'العملاء',
  Transactions: 'المعاملات',
  Remittance: 'الحوالات',
  Treasury: 'الخزينة',
  FX: 'الصرف',
  Providers: 'المزوّدون',
  Reconciliation: 'المطابقة',
  Compliance: 'الامتثال',
  Fraud: 'الاحتيال',
  Support: 'الدعم',
  Finance: 'المالية',
  Forecasts: 'التوقعات',
  Businesses: 'الشركات',
  Ledger: 'دفتر الأستاذ',
  Approvals: 'الموافقات',
  Controls: 'ضوابط الطوارئ',
  Queues: 'قوائم الانتظار',
  Deposits: 'الإيداعات',
  Withdrawals: 'السحوبات',
  KYC: 'التحقق من الهوية (KYC)',
  'System health': 'صحة النظام',
  Security: 'الأمن',
  Audit: 'سجل التدقيق',
  'Staff & roles': 'الموظفون والصلاحيات',
  Assistant: 'المساعد',
  'Sign out': 'تسجيل الخروج',
  'Search customers, transactions, references, addresses…': 'ابحث عن عميل، معاملة، مرجع، عنوان…',
  Today: 'اليوم',
  '7 days': '٧ أيام',
  '30 days': '٣٠ يومًا',
  Quarter: 'ربع سنة',
  Year: 'سنة',
  'Total customers': 'إجمالي العملاء',
  'Active customers': 'العملاء النشطون',
  Verified: 'موثّقون',
  Business: 'الأعمال',
  Volume: 'الحجم',
  Revenue: 'الإيرادات',
  'Customer balances': 'أرصدة العملاء',
  'Customer funds': 'أموال العملاء',
  'Settlement & treasury funds': 'أموال التسوية والخزينة',
  'Corporate funds': 'أموال الشركة',
  'Work queues': 'قوائم العمل',
  'vs previous period': 'مقارنة بالفترة السابقة',
  Reason: 'السبب',
  Cancel: 'إلغاء',
  Confirm: 'تأكيد',
  Approve: 'موافقة',
  Reject: 'رفض',
  Freeze: 'تجميد',
  Unfreeze: 'إلغاء التجميد',
  Loading: 'جارٍ التحميل',
  'No records': 'لا توجد سجلات',
  Status: 'الحالة',
  Amount: 'المبلغ',
  Currency: 'العملة',
  Created: 'تاريخ الإنشاء',
  Actions: 'إجراءات',
};

interface LangState { lang: CockpitLang; setLang: (l: CockpitLang) => void }

export const useCockpitLang = create<LangState>((set) => ({
  lang: 'en',
  setLang: (lang) => {
    try { localStorage.setItem('tz_cockpit_lang', lang); } catch { /* ignore */ }
    set({ lang });
  },
}));

export function initCockpitLang() {
  try {
    const saved = localStorage.getItem('tz_cockpit_lang');
    if (saved === 'ar' || saved === 'en') useCockpitLang.setState({ lang: saved });
  } catch { /* ignore */ }
}

export function useT() {
  const lang = useCockpitLang((s) => s.lang);
  return (s: string) => (lang === 'ar' ? AR[s] ?? s : s);
}
