import React from 'react';
import { CoinIcon } from './CoinIcon';

interface Props {
  sym: string;
  color?: string;
  size?: number;
}

/** CoinAvatar — thin wrapper around CoinIcon with the sym/color/size API. */
export function CoinAvatar({ sym, color, size = 44 }: Props) {
  return <CoinIcon symbol={sym} size={size} color={color} />;
}
