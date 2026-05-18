import React, { forwardRef } from 'react';
import { Text as RNText, TextInput as RNTextInput, TextProps, TextInputProps, StyleSheet } from 'react-native';

function resolveFontFamily(style: any): any {
  const flattened = StyleSheet.flatten(style) || {};
  let fontFamily = flattened.fontFamily || 'Outfit_400Regular';
  let hasSpecificFontFamily = !!flattened.fontFamily;
  
  // If it's explicitly IBM Plex, preserve it but handle weights if needed
  if (fontFamily.startsWith('IBMPlexSansArabic')) {
    // Basic weight mapping for Arabic if needed
    if (flattened.fontWeight) {
      if (flattened.fontWeight === '700' || flattened.fontWeight === 'bold') fontFamily = 'IBMPlexSansArabic_700Bold';
      else if (flattened.fontWeight === '600') fontFamily = 'IBMPlexSansArabic_600SemiBold';
      else if (flattened.fontWeight === '500') fontFamily = 'IBMPlexSansArabic_500Medium';
      else if (flattened.fontWeight === '300') fontFamily = 'IBMPlexSansArabic_300Light';
    }
    return { ...flattened, fontFamily, fontWeight: undefined };
  }

  // Handle Outfit
  // If fontWeight is explicitly set, we map it to the correct Outfit family.
  if (flattened.fontWeight) {
    switch (String(flattened.fontWeight)) {
      case 'normal':
      case '400':
        fontFamily = 'Outfit_400Regular';
        break;
      case '500':
        fontFamily = 'Outfit_500Medium';
        break;
      case '600':
        fontFamily = 'Outfit_600SemiBold';
        break;
      case 'bold':
      case '700':
        fontFamily = 'Outfit_700Bold';
        break;
      case '800':
        fontFamily = 'Outfit_800ExtraBold';
        break;
      case '900':
        fontFamily = 'Outfit_900Black';
        break;
      case '300':
        fontFamily = 'Outfit_300Light';
        break;
      default:
        // if no specific font family was requested, default to Outfit_400Regular
        if (!hasSpecificFontFamily) {
           fontFamily = 'Outfit_400Regular';
        }
    }
  } else if (!hasSpecificFontFamily) {
    // default to Outfit_400Regular if no font weight and no font family
    fontFamily = 'Outfit_400Regular';
  }

  // Ensure fontWeight is removed because iOS/Android will attempt to double-bold or drop the font completely
  return { ...flattened, fontFamily, fontWeight: undefined };
}

export const Text = forwardRef<RNText, TextProps>((props, ref) => {
  const resolvedStyle = resolveFontFamily(props.style);
  return <RNText {...props} ref={ref} style={resolvedStyle} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>((props, ref) => {
  const resolvedStyle = resolveFontFamily(props.style);
  return <RNTextInput {...props} ref={ref} style={resolvedStyle} />;
});
