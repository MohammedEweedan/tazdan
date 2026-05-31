import React, { forwardRef } from 'react';
import { Text as RNText, TextInput as RNTextInput, TextProps, TextInputProps, StyleSheet } from 'react-native';
import { translateLiteral, useI18n, type Locale } from '@/store/i18nStore';

const CAIRO_WEIGHT_MAP: Record<string, string> = {
  '300': 'Cairo_300Light',
  '400': 'Cairo_400Regular',
  'normal': 'Cairo_400Regular',
  '500': 'Cairo_500Medium',
  '600': 'Cairo_600SemiBold',
  '700': 'Cairo_700Bold',
  'bold': 'Cairo_700Bold',
  '800': 'Cairo_800ExtraBold',
  '900': 'Cairo_800ExtraBold',
};

const OUTFIT_WEIGHT_MAP: Record<string, string> = {
  '300': 'Outfit_300Light',
  '400': 'Outfit_400Regular',
  'normal': 'Outfit_400Regular',
  '500': 'Outfit_500Medium',
  '600': 'Outfit_600SemiBold',
  '700': 'Outfit_700Bold',
  'bold': 'Outfit_700Bold',
  '800': 'Outfit_800ExtraBold',
  '900': 'Outfit_900Black',
};

// Numbers, currency symbols, prices, and tickers should stay in the Latin
// (Outfit) family even when the UI locale is Arabic — Cairo's tabular figures
// differ in width/style and a balance like "$1,234.56" looks inconsistent
// rendered in Cairo. We detect content that carries no Arabic letters and
// is dominated by digits/symbols, and keep it in Outfit.
const ARABIC_LETTER = /[؀-ۿݐ-ݿࢠ-ࣿ]/;
const HAS_DIGIT = /[0-9٠-٩]/;
const NON_NUMERIC_LATIN_WORD = /[A-Za-z]{3,}/; // 3+ Latin letters → treat as a word, allow font swap intent

function flattenChildrenToString(children: React.ReactNode): string {
  if (children == null || children === false || children === true) return '';
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(flattenChildrenToString).join('');
  return ''; // nested elements — can't cheaply inspect; treat as non-numeric
}

/**
 * Returns true when the text is "numeric-ish": contains at least one digit,
 * no Arabic letters, and no long Latin words (so "BTC", "$", "1,234.56",
 * "+2.4%" qualify but "Balance" does not). Such content stays in Outfit.
 */
function isNumericContent(children: React.ReactNode): boolean {
  const s = flattenChildrenToString(children).trim();
  if (!s) return false;
  if (ARABIC_LETTER.test(s)) return false;
  if (!HAS_DIGIT.test(s)) return false;
  if (NON_NUMERIC_LATIN_WORD.test(s)) return false;
  return true;
}

function localizeChildren(children: React.ReactNode, locale: Locale): React.ReactNode {
  if (typeof children === 'string') return translateLiteral(children, locale);
  if (Array.isArray(children)) {
    return children.map((child, index) => (
      typeof child === 'string'
        ? <React.Fragment key={index}>{translateLiteral(child, locale)}</React.Fragment>
        : child
    ));
  }
  return children;
}

function resolveFontFamily(style: any, useCairo: boolean): any {
  const flattened = StyleSheet.flatten(style) || {};
  const weight = String(flattened.fontWeight || '400');
  const explicitFamily = String(flattened.fontFamily || '');

  if (useCairo && !explicitFamily.startsWith('Outfit')) {
    const mapped = CAIRO_WEIGHT_MAP[weight] ?? 'Cairo_400Regular';
    return { ...flattened, fontFamily: mapped, fontWeight: undefined };
  }

  const mapped = OUTFIT_WEIGHT_MAP[weight] ?? (explicitFamily || 'Outfit_400Regular');
  return { ...flattened, fontFamily: mapped, fontWeight: undefined };
}

export const Text = forwardRef<RNText, TextProps>((props, ref) => {
  const locale = useI18n((s) => s.locale);
  // Arabic uses Cairo — except for numeric/currency content, which stays Outfit.
  const useCairo = locale === 'ar' && !isNumericContent(props.children);
  const resolvedStyle = resolveFontFamily(props.style, useCairo);
  const localizedChildren = localizeChildren(props.children, locale);
  return <RNText {...props} ref={ref} style={resolvedStyle}>{localizedChildren}</RNText>;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>((props, ref) => {
  const locale = useI18n((s) => s.locale);
  // For inputs we can't know the typed value's script ahead of time; keep the
  // locale-driven family (Cairo in Arabic) so placeholders/labels read right.
  const resolvedStyle = resolveFontFamily(props.style, locale === 'ar');
  const placeholder = translateLiteral(props.placeholder, locale);
  return <RNTextInput {...props} ref={ref} placeholder={placeholder ?? undefined} style={resolvedStyle} />;
});
