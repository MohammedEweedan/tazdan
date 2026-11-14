/** The API receives addresses and transaction references, never signing keys.
 * A deployed gateway must independently enforce withdrawal policy and persist
 * idempotency before broadcast. See docs/runbooks/isolated-custody.md. */
import axios from 'axios';
import { z } from 'zod';
import { AppError } from '../../middleware/errorHandler';
import { validateAddress } from '../../utils/addressValidation';
import { assertLaunchMovement } from '../ops/launchReadiness.service';

export function custodyMode(): 'disabled' | 'local' | 'remote' {
  const mode = process.env.CUSTODY_MODE ?? (process.env.NODE_ENV === 'production' ? 'disabled' : 'local');
  if (mode !== 'disabled' && mode !== 'local' && mode !== 'remote') throw new AppError('Invalid custody configuration', 503);
  if (process.env.NODE_ENV === 'production' && mode === 'local') throw new AppError('Local signing is disabled in production', 503);
  return mode;
}

function gateway() {
  const raw = process.env.CUSTODY_PROVIDER_URL;
  const token = process.env.CUSTODY_PROVIDER_TOKEN;
  if (!raw || !token || token.length < 32) throw new AppError('Custody provider is not activated', 503, 'PROVIDER_NOT_ACTIVATED');
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && process.env.NODE_ENV === 'production')) {
    throw new AppError('Invalid custody provider configuration', 503);
  }
  return axios.create({ baseURL: raw.replace(/\/$/, ''), timeout: 15_000, maxRedirects: 0, maxContentLength: 64 * 1024, headers: { Authorization: `Bearer ${token}` } });
}

const addressesSchema = z.object({ ethAddress: z.string(), btcAddress: z.string(), solAddress: z.string(), tronAddress: z.string() }).strict();

export async function provisionRemoteWallet(userId: string, walletIndex: number) {
  assertLaunchMovement('blockchain', undefined, undefined, process.env.CUSTODY_PROVIDER_CODE);
  const response = await gateway().post('/v1/wallets', { userId, walletIndex }, { headers: { 'Idempotency-Key': `wallet_${walletIndex}` } });
  const addresses = addressesSchema.parse(response.data);
  validateAddress('ETH', addresses.ethAddress); validateAddress('BTC', addresses.btcAddress);
  validateAddress('SOL', addresses.solAddress); validateAddress('TRON', addresses.tronAddress);
  return addresses;
}

export interface CustodyWithdrawal { operationId: string; userId: string; walletIndex: number; asset: string; network: string; amount: string; toAddress: string }
const resultSchema = z.object({ operationId: z.string(), status: z.enum(['PENDING', 'CONFIRMED', 'REJECTED', 'UNKNOWN']), txHash: z.string().min(10).max(200).nullable(), definitiveNoBroadcast: z.boolean().default(false) }).strict();

export async function submitRemoteWithdrawal(operation: CustodyWithdrawal): Promise<string> {
  const response = await gateway().post('/v1/withdrawals', operation, { headers: { 'Idempotency-Key': operation.operationId } });
  const result = resultSchema.parse(response.data);
  if (result.operationId !== operation.operationId || !result.txHash || !['PENDING', 'CONFIRMED'].includes(result.status)) {
    // Only a separate status reconciliation may authorize release of funds.
    throw new AppError('Custody outcome requires reconciliation', 503, 'SETTLEMENT_PENDING');
  }
  return result.txHash;
}

export async function remoteWithdrawalStatus(operationId: string) {
  const response = await gateway().get(`/v1/withdrawals/${encodeURIComponent(operationId)}`);
  const result = resultSchema.parse(response.data);
  if (result.operationId !== operationId) throw new AppError('Custody operation reference differs', 503);
  return result;
}
