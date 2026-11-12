/**
 * A business pay QR in the business's brand: modules in the brand colour
 * (navy when the colour is too light to scan) and the business logo in the
 * middle, or the tazdan mark when there is no logo. Error correction is H so
 * the logo never costs a scan.
 */
import QRCode from 'react-native-qrcode-svg';
import { qrInk } from '@/lib/plaque';

const TAZDAN_MARK = require('../../../assets/icon-asterisk-black.png');

export function BrandedQr({ value, size, brand, logo, quietZone, getRef }: {
  value: string; size: number; brand?: string | null;
  /** Logo URL or data URI. */
  logo?: string | null;
  quietZone?: number;
  getRef?: (c: unknown) => void;
}) {
  return (
    <QRCode
      value={value} size={size} ecl="H" color={qrInk(brand)} backgroundColor="#FFFFFF" quietZone={quietZone}
      logo={logo ? { uri: logo } : TAZDAN_MARK}
      logoSize={Math.round(size * (logo ? 0.24 : 0.19))} logoBackgroundColor="#FFFFFF"
      logoMargin={Math.max(2, Math.round(size * 0.018))} logoBorderRadius={Math.round(size * 0.05)}
      getRef={getRef as never}
    />
  );
}
