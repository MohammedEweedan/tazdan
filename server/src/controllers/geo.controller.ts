/**
 * Public geo controller — country list, bank list per country, and the
 * derived list of accepted payment methods per country. Powers the
 * mobile signup / deposit / withdraw flows where the user picks where
 * they live and which bank they're sending from.
 */
import { Response, NextFunction, Request } from 'express';
import { listCountries, getCountry } from '../services/geo/countryProvider.service';
import { getBankFetchService } from '../services/banking';

// Method catalogue mirrors the mobile constant — kept here so the
// server is the source of truth and the mobile no longer carries a
// hardcoded country→methods map.
type MethodId = 'CARD' | 'APPLE_PAY' | 'BANK_TRANSFER' | 'LYD_AGENT' | 'MOONPAY' | 'P2P';

interface MethodDef {
  id: MethodId;
  currencies: string[];
  enabled: boolean;
}

const METHODS: Record<MethodId, MethodDef> = {
  CARD:          { id: 'CARD',          currencies: ['USD','EUR','GBP','AED'],                             enabled: true },
  APPLE_PAY:     { id: 'APPLE_PAY',     currencies: ['USD','EUR','GBP','AED'],                             enabled: true },
  BANK_TRANSFER: { id: 'BANK_TRANSFER', currencies: ['USD','EUR','GBP','AED','SAR','EGP','LYD'],          enabled: true },
  LYD_AGENT:    { id: 'LYD_AGENT',     currencies: ['LYD'],                                                enabled: true },
  MOONPAY:      { id: 'MOONPAY',       currencies: ['USD','EUR','GBP','AED','SAR','EGP'],                  enabled: false },
  P2P:          { id: 'P2P',           currencies: ['USD','AED','SAR','EGP','LYD'],                       enabled: true },
};

// A small override set so country-specific rails (LYD_AGENT) get priority
// regardless of currency intersection.
const OVERRIDES: Record<string, MethodId[]> = {
  LY: ['LYD_AGENT', 'P2P', 'BANK_TRANSFER'],
};

function methodsForCountry(cca2: string, countryCurrencies: string[]): MethodId[] {
  const override = OVERRIDES[cca2];
  if (override) return override;
  const accepted: MethodId[] = [];
  // Always offer CARD + APPLE_PAY + BANK_TRANSFER + P2P when the
  // country's currency intersects the method's accepted list.
  for (const m of Object.values(METHODS)) {
    if (!m.enabled) continue;
    const intersects = m.currencies.some((c) => countryCurrencies.includes(c));
    // BANK_TRANSFER falls back to USD/EUR international rails if the
    // local currency isn't accepted directly.
    if (intersects || m.id === 'BANK_TRANSFER' || m.id === 'CARD' || m.id === 'P2P') accepted.push(m.id);
  }
  // De-dup preserving order.
  return Array.from(new Set(accepted));
}

export class GeoController {
  static async listCountries(_req: Request, res: Response, next: NextFunction) {
    try {
      const countries = await listCountries();
      res.json({ countries });
    } catch (e) { next(e); }
  }

  static async getCountry(req: Request, res: Response, next: NextFunction) {
    try {
      const c = await getCountry(req.params.cca2);
      if (!c) return res.status(404).json({ error: 'Country not found' });
      res.json({ country: c });
    } catch (e) { next(e); }
  }

  static async getBanks(req: Request, res: Response, next: NextFunction) {
    try {
      const cca2 = req.params.cca2.toUpperCase();
      const svc = getBankFetchService({
        ibanComApiKey:     process.env.IBAN_COM_API_KEY,
        useIbanCom:        process.env.USE_IBAN_COM !== 'false',
        useOpenIban:       process.env.USE_OPENIBAN  !== 'false',
        useLocalFallback:  process.env.ENABLE_LOCAL_BANK_CACHE !== 'false',
      });
      const banks = await svc.getBanks(cca2);
      res.json({ countryCode: cca2, banks });
    } catch (e) { next(e); }
  }

  static async getPaymentMethods(req: Request, res: Response, next: NextFunction) {
    try {
      const cca2 = req.params.cca2.toUpperCase();
      const c = await getCountry(cca2);
      if (!c) return res.status(404).json({ error: 'Country not found' });
      const ids = methodsForCountry(cca2, c.currencies);
      res.json({ countryCode: cca2, methods: ids });
    } catch (e) { next(e); }
  }
}
