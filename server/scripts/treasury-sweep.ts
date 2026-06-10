/**
 * Treasury cold-storage sweep — OPERATOR CLI, deliberately not an HTTP
 * endpoint. Moving custody funds to cold storage is a two-human ceremony,
 * not an API call an attacker with an admin token could reach.
 *
 * Sweeps on-chain funds from a user's custody address (derived from the
 * master seed by walletIndex) to the configured cold-storage address.
 * The INTERNAL ledger is untouched: user balances are liabilities; this
 * only moves the on-chain backing from hot (server-derivable keys) to
 * cold (hardware wallet).
 *
 * Usage (run on the server host, requires the production env):
 *   npx ts-node --transpile-only scripts/treasury-sweep.ts \
 *     --asset ETH --index 12 --amount 1.5 [--dry-run]
 *
 * The destination is intentionally NOT a CLI flag: it comes from
 * COLD_STORAGE_ADDRESS_<CHAIN> in the environment, so a tampered shell
 * one-liner can't redirect a sweep. Set those to your hardware-wallet
 * addresses and verify them out-of-band before first use.
 *
 *   COLD_STORAGE_ADDRESS_ETH=0x…   (also used for USDT-ERC20 sweeps)
 *   COLD_STORAGE_ADDRESS_BTC=bc1…
 *   COLD_STORAGE_ADDRESS_SOL=…
 */
import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/utils/prisma';

interface Args {
  asset: 'ETH' | 'BTC' | 'SOL' | 'USDT';
  network: string;
  index: number;
  amount: string;
  dryRun: boolean;
}

function parseArgs(): Args {
  const get = (flag: string): string | undefined => {
    const i = process.argv.indexOf(`--${flag}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const asset = (get('asset') ?? '').toUpperCase() as Args['asset'];
  if (!['ETH', 'BTC', 'SOL', 'USDT'].includes(asset)) {
    console.error('Usage: --asset ETH|BTC|SOL|USDT --index <walletIndex> --amount <n> [--network ERC20] [--dry-run]');
    process.exit(1);
  }
  const index = Number.parseInt(get('index') ?? '', 10);
  const amount = get('amount') ?? '';
  if (!Number.isInteger(index) || index < 0 || !amount || Number(amount) <= 0) {
    console.error('Provide --index (walletIndex ≥ 0) and --amount (> 0).');
    process.exit(1);
  }
  return {
    asset,
    network: (get('network') ?? (asset === 'USDT' ? 'ERC20' : asset)).toUpperCase(),
    index,
    amount,
    dryRun: process.argv.includes('--dry-run'),
  };
}

async function main() {
  const args = parseArgs();
  const chain = args.asset === 'USDT' ? 'ETH' : args.asset;
  const coldAddress = process.env[`COLD_STORAGE_ADDRESS_${chain}`];
  if (!coldAddress) {
    console.error(`COLD_STORAGE_ADDRESS_${chain} is not set. Refusing to sweep without a pinned cold destination.`);
    process.exit(1);
  }

  const wallet = await prisma.userWallet.findUnique({ where: { walletIndex: args.index } });
  if (!wallet) {
    console.error(`No UserWallet with walletIndex=${args.index}`);
    process.exit(1);
  }
  const fromAddress =
    chain === 'ETH' ? wallet.ethAddress : chain === 'BTC' ? wallet.btcAddress : wallet.solAddress;

  console.log('── Treasury sweep ───────────────────────────────');
  console.log(`  asset      ${args.asset}${args.asset === 'USDT' ? `/${args.network}` : ''}`);
  console.log(`  from       ${fromAddress}  (walletIndex ${args.index})`);
  console.log(`  to (COLD)  ${coldAddress}`);
  console.log(`  amount     ${args.amount}`);
  if (args.dryRun) {
    console.log('  DRY RUN — no key derivation, no broadcast.');
    return;
  }

  // Type a confirmation phrase — sweeps must never be muscle-memory.
  const expected = `SWEEP ${args.asset} ${args.amount}`;
  process.stdout.write(`\nType "${expected}" to continue: `);
  const line: string = await new Promise((resolve) => {
    process.stdin.once('data', (d) => resolve(String(d).trim()));
  });
  if (line !== expected) {
    console.error('Confirmation mismatch — aborted.');
    process.exit(1);
  }

  const { deriveKeyForChain } = await import('../src/services/wallet/walletDerivation.service');
  const settlement = await import('../src/services/wallet/onchainSettlement.service');
  const key = await deriveKeyForChain(chain as any, args.index);

  let txHash: string;
  if (args.asset === 'ETH') {
    txHash = await sweepViaEthers(key.privateKey, coldAddress, args.amount);
  } else if (args.asset === 'USDT') {
    txHash = await sweepUsdtErc20(key.privateKey, coldAddress, args.amount);
  } else if (args.asset === 'BTC') {
    txHash = await settlement.sweepBtc(key.privateKey, fromAddress, coldAddress, args.amount);
  } else {
    txHash = await settlement.sweepSol(key.privateKey, coldAddress, args.amount);
  }
  (key as any).privateKey = '';

  await prisma.onChainTransaction.create({
    data: {
      userId: wallet.userId,
      type: 'WITHDRAWAL',
      asset: args.asset,
      network: args.network,
      amount: args.amount,
      fromAddress,
      toAddress: coldAddress,
      txHash,
      status: 'PENDING',
    },
  }).catch((e) => console.warn('Sweep broadcast OK but audit row failed:', e?.message));

  console.log(`\n✅ Sweep broadcast: ${txHash}`);
  console.log('Recorded as an OnChainTransaction (type WITHDRAWAL → cold storage) for the audit trail.');
}

async function sweepViaEthers(privateKey: string, to: string, amountEth: string): Promise<string> {
  const { ethers } = await import('ethers');
  const rpc = process.env.ALCHEMY_RPC_URL
    || (process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : null);
  if (!rpc) throw new Error('No EVM RPC configured');
  const wallet = new ethers.Wallet(privateKey, new ethers.JsonRpcProvider(rpc));
  const tx = await wallet.sendTransaction({ to, value: ethers.parseEther(amountEth) });
  return tx.hash;
}

async function sweepUsdtErc20(privateKey: string, to: string, amount: string): Promise<string> {
  const { ethers } = await import('ethers');
  const rpc = process.env.ALCHEMY_RPC_URL
    || (process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : null);
  if (!rpc) throw new Error('No EVM RPC configured');
  const signer = new ethers.Wallet(privateKey, new ethers.JsonRpcProvider(rpc));
  const usdt = new ethers.Contract(
    process.env.USDT_ERC20_ADDRESS || '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    ['function transfer(address to, uint256 value) returns (bool)'],
    signer,
  );
  const tx = await usdt.transfer(to, ethers.parseUnits(amount, 6));
  return tx.hash;
}

main()
  .catch((e) => { console.error('Sweep failed:', e?.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
