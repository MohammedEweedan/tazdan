/**
 * Strict crypto address validation. Rejects typos that would otherwise
 * send funds into the void. Each chain uses its native checksum.
 */
import { ethers } from 'ethers';
import { address as bitcoinAddress, networks as bitcoinNetworks } from 'bitcoinjs-lib';
import { PublicKey } from '@solana/web3.js';
import { TronWeb } from 'tronweb';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_RE = new RegExp(`^[${BASE58_ALPHABET}]+$`);

export type Chain = 'ETH' | 'BTC' | 'SOL' | 'TRON';

export function detectChain(asset: string, network: string): Chain {
  const a = asset.toUpperCase();
  const n = network.toUpperCase();
  if (a === 'ETH') return 'ETH';
  if (a === 'BTC') return 'BTC';
  if (a === 'SOL') return 'SOL';
  if (a === 'USDT') return n === 'TRC20' ? 'TRON' : 'ETH';
  throw new Error(`Unsupported asset/network: ${asset}/${network}`);
}

function isValidEthAddress(addr: string): boolean {
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return false;
  // If the caller supplied a checksummed address, enforce it. All-lower
  // or all-upper bypass checksum validation per EIP-55.
  const hasUpper = /[A-F]/.test(addr.slice(2));
  const hasLower = /[a-f]/.test(addr.slice(2));
  if (hasUpper && hasLower) {
    try {
      return ethers.getAddress(addr) === addr;
    } catch {
      return false;
    }
  }
  return true;
}

function isValidTronAddress(addr: string): boolean {
  return addr.startsWith('T') && addr.length === 34 && TronWeb.isAddress(addr);
}

function isValidBtcAddress(addr: string): boolean {
  try { bitcoinAddress.toOutputScript(addr, bitcoinNetworks.bitcoin); return true; }
  catch { return false; }
}

function isValidSolAddress(addr: string): boolean {
  // Solana addresses: 32 bytes Base58, length 32–44 chars.
  if (addr.length < 32 || addr.length > 44) return false;
  if (!BASE58_RE.test(addr)) return false;
  try { return new PublicKey(addr).toBytes().length === 32; } catch { return false; }
}

export function validateAddress(chain: Chain, address: string): void {
  let ok = false;
  switch (chain) {
    case 'ETH':  ok = isValidEthAddress(address);  break;
    case 'TRON': ok = isValidTronAddress(address); break;
    case 'BTC':  ok = isValidBtcAddress(address);  break;
    case 'SOL':  ok = isValidSolAddress(address);  break;
  }
  if (!ok) {
    const e: any = new Error(`Invalid ${chain} address`);
    e.statusCode = 400;
    throw e;
  }
}
