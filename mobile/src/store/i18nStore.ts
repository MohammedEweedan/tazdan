/**
 * Lightweight i18n. No external lib needed for the foundation —
 *  - one Zustand store with the active locale
 *  - a flat dictionary keyed by message id
 *  - `t(key)` returns the active locale's string (falls back to English)
 *
 * Persists choice via AsyncStorage. Uses RTL flip for Arabic so the
 * onboarding/login layouts mirror correctly.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import { useEffect } from 'react';
import { create } from 'zustand';

export type Locale = 'en' | 'ar' | 'fr' | 'es';

const KEY = 'promrkts.locale';

export const LOCALE_META: Record<Locale, { label: string; flag: string; rtl: boolean }> = {
  en: { label: 'English',  flag: '🇬🇧', rtl: false },
  ar: { label: 'العربية',  flag: '🇸🇦', rtl: true  },
  fr: { label: 'Français', flag: '🇫🇷', rtl: false },
  es: { label: 'Español',  flag: '🇪🇸', rtl: false },
};

type Strings = Record<string, string>;

const dict: Record<Locale, Strings> = {
  en: {
    'onboard.title.1':       'One wallet for the world.',
    'onboard.body.1':        'BTC, ETH, USDT and 7 fiat currencies — held side-by-side, swap in seconds.',
    'onboard.title.2':       'Send to anyone, anywhere.',
    'onboard.body.2':        'Pay friends with @handles. Trade fiat over P2P with verified traders in 120+ countries.',
    'onboard.skip':          'Skip',
    'onboard.continue':      'Continue',
    'onboard.create':        'Create account',
    'onboard.haveAccount':   'I already have an account',
    'login.title':           'Welcome back',
    'login.subtitle':        'Log in to access your wallets, transfer funds, and trade across 120+ markets.',
    'login.email':           'Email',
    'login.password':        'Password',
    'login.forgot':          'Forgot password?',
    'login.cta':             'Log in',
    'login.loading':         'Logging in…',
    'login.apple':           'Continue with Apple',
    'login.or':              'or',
    'login.newTo':           'New to Promrkts? ',
    'login.create':          'Create account',
    'login.failed':          'Sign-in failed',
    'wallet.title':          'Wallets',
    'wallet.cards':          'Your Cards',
    'wallet.netWorth':       'Net worth',
    'wallet.acrossAssets':   'Across assets',
  },
  ar: {
    'onboard.title.1':       'محفظة واحدة للعالم.',
    'onboard.body.1':        'البيتكوين والإيثيريوم والـUSDT و٧ عملات نقدية — جنبًا إلى جنب، تحويل في ثوانٍ.',
    'onboard.title.2':       'أرسل إلى أي شخص، في أي مكان.',
    'onboard.body.2':        'ادفع لأصدقائك عبر @handles. تداول مع تجار موثوقين في أكثر من ١٢٠ دولة.',
    'onboard.skip':          'تخطي',
    'onboard.continue':      'متابعة',
    'onboard.create':        'إنشاء حساب',
    'onboard.haveAccount':   'لدي حساب بالفعل',
    'login.title':           'مرحبًا بعودتك',
    'login.subtitle':        'سجّل الدخول للوصول إلى محافظك وتحويل الأموال والتداول في أكثر من ١٢٠ سوقًا.',
    'login.email':           'البريد الإلكتروني',
    'login.password':        'كلمة المرور',
    'login.forgot':          'نسيت كلمة المرور؟',
    'login.cta':             'تسجيل الدخول',
    'login.loading':         'جارٍ تسجيل الدخول…',
    'login.apple':           'متابعة باستخدام Apple',
    'login.or':              'أو',
    'login.newTo':           'جديد على Promrkts؟ ',
    'login.create':          'إنشاء حساب',
    'login.failed':          'فشل تسجيل الدخول',
    'wallet.title':          'المحافظ',
    'wallet.cards':          'بطاقاتك',
    'wallet.netWorth':       'القيمة الصافية',
    'wallet.acrossAssets':   'عبر الأصول',
  },
  fr: {
    'onboard.title.1':       'Un portefeuille pour le monde.',
    'onboard.body.1':        'BTC, ETH, USDT et 7 devises — côte à côte, échange en quelques secondes.',
    'onboard.title.2':       'Envoyez à tout le monde, partout.',
    'onboard.body.2':        'Payez vos amis avec des @handles. Échangez en P2P avec des traders vérifiés dans 120+ pays.',
    'onboard.skip':          'Passer',
    'onboard.continue':      'Continuer',
    'onboard.create':        'Créer un compte',
    'onboard.haveAccount':   "J'ai déjà un compte",
    'login.title':           'Bon retour',
    'login.subtitle':        'Connectez-vous pour accéder à vos portefeuilles, transférer des fonds et trader.',
    'login.email':           'E-mail',
    'login.password':        'Mot de passe',
    'login.forgot':          'Mot de passe oublié ?',
    'login.cta':             'Se connecter',
    'login.loading':         'Connexion…',
    'login.apple':           'Continuer avec Apple',
    'login.or':              'ou',
    'login.newTo':           'Nouveau sur Promrkts ? ',
    'login.create':          'Créer un compte',
    'login.failed':          'Échec de la connexion',
    'wallet.title':          'Portefeuilles',
    'wallet.cards':          'Vos cartes',
    'wallet.netWorth':       'Valeur nette',
    'wallet.acrossAssets':   'À travers les actifs',
  },
  es: {
    'onboard.title.1':       'Una cartera para el mundo.',
    'onboard.body.1':        'BTC, ETH, USDT y 7 monedas — juntas, cambia en segundos.',
    'onboard.title.2':       'Envía a cualquier persona, en cualquier lugar.',
    'onboard.body.2':        'Paga a amigos con @handles. Intercambia P2P con traders verificados en más de 120 países.',
    'onboard.skip':          'Omitir',
    'onboard.continue':      'Continuar',
    'onboard.create':        'Crear cuenta',
    'onboard.haveAccount':   'Ya tengo una cuenta',
    'login.title':           'Bienvenido de nuevo',
    'login.subtitle':        'Inicia sesión para acceder a tus carteras y operar en más de 120 mercados.',
    'login.email':           'Correo',
    'login.password':        'Contraseña',
    'login.forgot':          '¿Olvidaste la contraseña?',
    'login.cta':             'Iniciar sesión',
    'login.loading':         'Iniciando sesión…',
    'login.apple':           'Continuar con Apple',
    'login.or':              'o',
    'login.newTo':           '¿Nuevo en Promrkts? ',
    'login.create':          'Crear cuenta',
    'login.failed':          'Inicio de sesión fallido',
    'wallet.title':          'Billeteras',
    'wallet.cards':          'Tus tarjetas',
    'wallet.netWorth':       'Valor neto',
    'wallet.acrossAssets':   'A través de activos',
  },
};

interface I18nState {
  locale: Locale;
  isHydrated: boolean;
  setLocale: (l: Locale) => void;
  cycle: () => void;
  hydrate: () => Promise<void>;
}

export const useI18n = create<I18nState>((set, get) => ({
  locale: 'en',
  isHydrated: false,
  setLocale: (l) => {
    set({ locale: l });
    const wantRtl = LOCALE_META[l].rtl;
    if (I18nManager.isRTL !== wantRtl) {
      try { I18nManager.allowRTL(wantRtl); I18nManager.forceRTL(wantRtl); } catch { /* noop */ }
    }
    AsyncStorage.setItem(KEY, l).catch(() => {});
  },
  cycle: () => {
    const order: Locale[] = ['en', 'ar', 'fr', 'es'];
    const i = order.indexOf(get().locale);
    get().setLocale(order[(i + 1) % order.length]);
  },
  hydrate: async () => {
    try {
      const stored = (await AsyncStorage.getItem(KEY)) as Locale | null;
      if (stored && LOCALE_META[stored]) get().setLocale(stored);
    } catch { /* noop */ }
    set({ isHydrated: true });
  },
}));

/** Translation function — bound to the active locale store. */
export function useT() {
  const { locale, hydrate, isHydrated } = useI18n();
  useEffect(() => { if (!isHydrated) hydrate(); }, [isHydrated, hydrate]);
  return (key: string): string => dict[locale][key] ?? dict.en[key] ?? key;
}
