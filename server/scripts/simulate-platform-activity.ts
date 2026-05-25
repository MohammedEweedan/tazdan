#!/usr/bin/env ts-node
/**
 * Platform Activity Simulator
 * 
 * This script simulates realistic user activity across all platform features:
 * - User registrations and logins
 * - Wallet views and balance checks
 * - Deposits and withdrawals
 * - Trading orders (buy/sell)
 * - P2P transfers
 * - Agent transactions
 * - Admin dashboard activity
 * 
 * Usage: npx ts-node scripts/simulate-platform-activity.ts [options]
 * Options:
 *   --users=N       Number of simulated users (default: 10)
 *   --duration=M    Duration in minutes (default: 5)
 *   --admin         Include admin activity simulation
 *   --verbose       Show detailed logs
 */

/// <reference types="node" />

import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { randomInt, randomUUID } from 'crypto';

declare const process: NodeJS.Process;
declare const console: Console;

const BASE_URL    = process.env.API_URL   || 'http://localhost:5000';
const VERBOSE     = process.argv.includes('--verbose');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL    || 'admin@exchange.ly';
const ADMIN_PASS  = process.env.ADMIN_PASSWORD || 'Admin123!@#';

// Parse arguments
const usersArg = process.argv.find((arg: string) => arg.startsWith('--users='));
const durationArg = process.argv.find((arg: string) => arg.startsWith('--duration='));
const NUM_USERS = usersArg ? parseInt(usersArg.split('=')[1]) : 10;
const DURATION_MINUTES = durationArg ? parseInt(durationArg.split('=')[1]) : 5;
const INCLUDE_ADMIN = process.argv.includes('--admin');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Helper functions
const log = (msg: string, color: keyof typeof colors = 'reset') => {
  console.log(`${colors[color]}${msg}${colors.reset}`);
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const randomSleep = (min: number, max: number) => sleep(randomInt(min, max));
const randomChoice = <T>(arr: T[]): T => arr[randomInt(0, arr.length)];
const randomAmount = (min: number, max: number) => randomInt(min * 100, max * 100) / 100;

// Admin client singleton
let _adminApi: AxiosInstance | null = null;
async function getAdminApi(): Promise<AxiosInstance | null> {
  if (_adminApi) return _adminApi;
  const http = axios.create({ baseURL: `${BASE_URL}/api`, headers: { 'Content-Type': 'application/json' } });
  try {
    const res = await http.post('/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
    const token = res.data?.accessToken;
    if (!token) return null;
    _adminApi = axios.create({
      baseURL: `${BASE_URL}/api`,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    return _adminApi;
  } catch {
    if (VERBOSE) log('  ⚠ Admin login failed — deposits will stay PENDING', 'yellow');
    return null;
  }
}

// Stats tracking
const stats = {
  registrations: 0,
  logins: 0,
  deposits: 0,
  withdrawals: 0,
  orders: { buy: 0, sell: 0 },
  transfers: 0,
  errors: 0,
};

// Registry of successfully registered sim usernames for cross-user transfers
const SIM_USER_REGISTRY: string[] = [];

// Simulated User Class
class SimulatedUser {
  id: string | null = null;
  email: string;
  username: string | null = null;
  password: string = 'TestPass123!';
  token: string | null = null;
  wallets: any[] = [];
  isRegistered: boolean = false;
  api: AxiosInstance;

  constructor(index: number) {
    this.email = `simuser_${Date.now()}_${index}@test.com`;
    this.api = axios.create({
      baseURL: `${BASE_URL}/api`,
      headers: { 'Content-Type': 'application/json' },
    });
    
    // Add auth interceptor
    this.api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  async register(): Promise<boolean> {
    try {
      const firstName = randomChoice(['Ahmed', 'Mohamed', 'Ali', 'Fatima', 'Aisha', 'Omar', 'Hassan', 'Sara']);
      const lastName = randomChoice(['Al-Farsi', 'Benali', 'Khalil', 'Mansour', 'Saleh', 'Hussein']);
      const randomDOB = () => {
      const start = new Date(1985, 0, 1).getTime();
      const end = new Date(2003, 11, 31).getTime();
      const date = new Date(randomInt(start, end));
        return date.toISOString();
      };
        
      const response = await this.api.post('/auth/register', {
        email: this.email,
        password: this.password,
        firstName,
        lastName,

        username: `user_${randomUUID().slice(0, 8)}`,

        country: 'LY',

        phoneCountryCode: '218',
        phone: `9${randomInt(10000000, 99999999)}`,

        dateOfBirth: randomDOB(),
      });
      
      if (VERBOSE) log(`  ✓ Registered: ${this.email}`, 'green');
      this.token = response.data.accessToken;
      this.id = response.data.user.id;
      this.username = response.data.user.username ?? null;
      if (this.username) SIM_USER_REGISTRY.push(this.username);
      this.isRegistered = true;
      stats.registrations++;
      return true;
    } catch (error: any) {
      const errorMsg =
        JSON.stringify(error.response?.data) ||
        error.response?.data?.message ||
        error.message;
      if (VERBOSE) log(`  ✗ Registration failed: ${errorMsg}`, 'red');
      stats.errors++;
      return false;
    }
  }

  async login(): Promise<boolean> {
    try {
      const response = await this.api.post('/auth/login', {
        email: this.email,
        password: this.password,
      });
      
      this.token = response.data.accessToken;
      this.id = response.data.user.id;
      this.isRegistered = true;
      
      if (VERBOSE) log(`  ✓ Logged in: ${this.email}`, 'green');
      stats.logins++;
      return true;
    } catch (error: any) {
      if (VERBOSE) log(`  ✗ Login failed: ${error.response?.data?.message || error.message}`, 'red');
      stats.errors++;
      return false;
    }
  }

  async fetchWallets(): Promise<void> {
    try {
      const response = await this.api.get('/wallets');
      this.wallets = response.data.wallets || [];
      if (VERBOSE) log(`  ✓ Fetched ${this.wallets.length} wallets`, 'cyan');
    } catch (error: any) {
      if (VERBOSE) log(`  ✗ Fetch wallets failed: ${error.response?.data?.message || error.message}`, 'red');
    }
  }

  async fetchPortfolio(): Promise<void> {
    try {
      const response = await this.api.get('/wallets/summary/portfolio');
      if (VERBOSE) log(`  ✓ Portfolio value: $${response.data.totalUsdValue?.toFixed(2) || 0}`, 'cyan');
    } catch (error: any) {
      if (VERBOSE) log(`  ✗ Fetch portfolio failed: ${error.response?.data?.message || error.message}`, 'red');
    }
  }

  async createDeposit(): Promise<boolean> {
    if (!this.id) return false;
    const admin = await getAdminApi();
    if (!admin) return false;
    try {
      const currency = randomChoice(['USDT', 'USD']);
      const amount = randomAmount(100, 1000);
      await admin.post('/admin/seed-balance', { userId: this.id, currency, amount });
      if (VERBOSE) log(`  ✓ Deposit seeded: ${amount} ${currency}`, 'green');
      stats.deposits++;
      return true;
    } catch (error: any) {
      if (VERBOSE) log(`  ✗ Deposit failed: ${error.response?.data?.message || error.message}`, 'red');
      return false;
    }
  }

  async fetchDepositHistory(): Promise<void> {
    try {
      const response = await this.api.get('/deposits?page=1');
      if (VERBOSE) log(`  ✓ Deposit history: ${response.data.deposits?.length || 0} records`, 'cyan');
    } catch (error: any) {
      if (VERBOSE) log(`  ✗ Deposit history failed: ${error.response?.data?.message || error.message}`, 'red');
    }
  }

  async createWithdrawal(): Promise<boolean> {
    try {
      // Check if user has sufficient balance
      await this.fetchWallets();
      const walletWithBalance = this.wallets.find((w: any) => parseFloat(w.balance) > 100);
      
      if (!walletWithBalance) {
        if (VERBOSE) log(`  ⚠ No wallet with sufficient balance for withdrawal`, 'yellow');
        return false;
      }
      
      const maxWithdraw = Math.min(500, Math.floor(parseFloat(walletWithBalance.balance) * 0.5));
      const amount = randomAmount(50, Math.max(51, maxWithdraw));
      const isUSDT = walletWithBalance.currency === 'USDT';
      
      const payload: any = {
        currency: walletWithBalance.currency,
        amount,
      };
      
      if (isUSDT) {
        payload.walletAddress = `T${randomUUID().replace(/-/g, '').slice(0, 33)}`;
        payload.network = 'TRC20';
      } else {
        payload.bankName = randomChoice(['Jumhouria Bank', 'National Commercial Bank', 'Sahara Bank']);
        payload.accountNumber = randomInt(1000000000, 9999999999).toString();
        payload.accountName = 'Test Account';
      }
      
      const response = await this.api.post('/withdrawals', payload);
      
      if (VERBOSE) log(`  ✓ Withdrawal created: ${amount} ${walletWithBalance.currency}`, 'green');
      stats.withdrawals++;
      return true;
    } catch (error: any) {
      if (VERBOSE) log(`  ✗ Withdrawal failed: ${error.response?.data?.message || error.message}`, 'red');
      return false;
    }
  }

  async fetchWithdrawalHistory(): Promise<void> {
    try {
      const response = await this.api.get('/withdrawals?page=1');
      if (VERBOSE) log(`  ✓ Withdrawal history: ${response.data.withdrawals?.length || 0} records`, 'cyan');
    } catch (error: any) {
      if (VERBOSE) log(`  ✗ Withdrawal history failed: ${error.response?.data?.message || error.message}`, 'red');
    }
  }

  async createOrder(): Promise<boolean> {
    try {
      const side = randomChoice(['BUY', 'SELL']) as 'BUY' | 'SELL';
      const quoteCurrency = 'USD'; // server only accepts USD
      const amount = randomAmount(10, 100);

      const response = await this.api.post('/orders', {
        side,
        quoteCurrency,
        amount,
      });
      
      if (VERBOSE) log(`  ✓ Order created: ${side} ${amount} USD`, 'green');
      stats.orders[side.toLowerCase() as 'buy' | 'sell']++;
      return true;
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || JSON.stringify(error.response?.data) || error.message;
      if (VERBOSE) log(`  ✗ Order failed: ${errorMsg}`, 'red');
      return false;
    }
  }

  async fetchOrderHistory(): Promise<void> {
    try {
      const response = await this.api.get('/orders?page=1');
      if (VERBOSE) log(`  ✓ Order history: ${response.data.orders?.length || 0} records`, 'cyan');
    } catch (error: any) {
      if (VERBOSE) log(`  ✗ Order history failed: ${error.response?.data?.message || error.message}`, 'red');
    }
  }

  async createTransfer(): Promise<boolean> {
    try {
      const wallets = await this.api.get('/wallets');
      const usdtWallet = wallets.data.wallets?.find((w: any) => w.currency === 'USDT');

      if (!usdtWallet || parseFloat(usdtWallet.balance) < 50) {
        if (VERBOSE) log(`  ⚠ No USDT wallet with sufficient balance for transfer`, 'yellow');
        return false;
      }

      const maxTransfer = Math.floor(Math.min(100, parseFloat(usdtWallet.balance) * 0.3));
      const amount = randomAmount(10, Math.max(11, maxTransfer));

      // Pick a known sim user (other than self) or fall back to the seeded demo user
      const others = SIM_USER_REGISTRY.filter((u) => u !== this.username);
      const recipientUsername = others.length > 0
        ? randomChoice(others)
        : 'rayofsunshine'; // seeded demo user

      const response = await this.api.post('/transfers/send', {
        recipientUsername,
        currency: 'USDT',
        amount,
        note: randomChoice(['Thanks!', 'Paying back', 'Lunch split', 'Your share', 'Invoice payment']),
      });
      
      if (VERBOSE) log(`  ✓ Transfer sent: ${amount} USDT`, 'green');
      stats.transfers++;
      return true;
    } catch (error: any) {
      if (VERBOSE) log(`  ✗ Transfer failed: ${error.response?.data?.message || error.message}`, 'red');
      return false;
    }
  }

  async fetchTransferHistory(): Promise<void> {
    try {
      const response = await this.api.get('/transfers/history?page=1');
      if (VERBOSE) log(`  ✓ Transfer history: ${response.data.transfers?.length || 0} records`, 'cyan');
    } catch (error: any) {
      if (VERBOSE) log(`  ✗ Transfer history failed: ${error.response?.data?.message || error.message}`, 'red');
    }
  }

  // Activate account + approve KYC so transfers/cards/P2P work.
  async activate(): Promise<void> {
    if (!this.id) return;
    const admin = await getAdminApi();
    if (!admin) return;
    await admin.put(`/admin/users/${this.id}/status`, { status: 'ACTIVE' }).catch(() => {});
    await admin.put(`/admin/kyc/${this.id}/approve`).catch(() => {});
  }

  // Directly seed wallet balances via the admin seed-balance endpoint.
  async injectFakeBalance(): Promise<boolean> {
    if (!this.id) return false;
    const admin = await getAdminApi();
    if (!admin) {
      if (VERBOSE) log(`  ⚠ No admin client — balance injection skipped`, 'yellow');
      return false;
    }
    try {
      await admin.post('/admin/seed-balance', { userId: this.id, currency: 'USDT', amount: 5000 });
      await admin.post('/admin/seed-balance', { userId: this.id, currency: 'USD',  amount: 3000 });
      if (VERBOSE) log(`  💰 Seeded USDT 5000 + USD 3000`, 'cyan');
      return true;
    } catch (error: any) {
      if (VERBOSE) log(`  ⚠ Balance seed failed: ${error.response?.data?.message || error.message}`, 'yellow');
      return false;
    }
  }

  async simulateSession(): Promise<void> {
    log(`\n👤 User: ${this.email}`, 'bright');
    
    // Register and login
    const registered = await this.register();
    if (!registered) return;

    await randomSleep(200, 500);

    // Activate account + approve KYC (enables transfers, cards, P2P)
    await this.activate();

    await randomSleep(200, 500);

    // Seed wallet balances
    await this.injectFakeBalance();
    await randomSleep(500, 1000);
    
    // First-time user flow: Check wallets and portfolio
    await this.fetchWallets();
    await randomSleep(300, 700);
    await this.fetchPortfolio();
    await randomSleep(300, 700);
    
    // Realistic session based on "persona"
    const persona = randomChoice(['trader', 'holder', 'sender', 'depositor']);
    
    if (persona === 'trader') {
      // Trader persona: Views rates, places orders, checks history
      if (VERBOSE) log(`  📊 Trader persona`, 'blue');
      await this.fetchOrderHistory();
      await randomSleep(500, 1000);
      
      // Place 1-3 orders
      const orderCount = randomInt(1, 4);
      for (let i = 0; i < orderCount; i++) {
        await this.createOrder();
        await randomSleep(800, 1500);
      }
      
      await this.fetchOrderHistory();
      await this.fetchPortfolio();
      
    } else if (persona === 'sender') {
      // Sender persona: P2P transfers, agent deposits
      if (VERBOSE) log(`  💸 Sender persona`, 'blue');
      await randomSleep(500, 1000);
      
      // Try transfers
      const transferCount = randomInt(1, 3);
      for (let i = 0; i < transferCount; i++) {
        await this.createTransfer();
        await randomSleep(600, 1200);
      }
      
      await this.fetchTransferHistory();
      
    } else if (persona === 'depositor') {
      // Depositor persona: Creates deposits, checks history
      if (VERBOSE) log(`  💵 Depositor persona`, 'blue');
      await this.fetchDepositHistory();
      await randomSleep(400, 800);
      
      // Create more deposits
      const depositCount = randomInt(1, 3);
      for (let i = 0; i < depositCount; i++) {
        await this.createDeposit();
        await randomSleep(700, 1300);
      }
      
      await this.fetchDepositHistory();
      
      // Maybe withdraw
      if (randomInt(0, 10) > 6) {
        await this.createWithdrawal();
      }
      
    } else {
      // Holder persona: Passive, just checks balances
      if (VERBOSE) log(`  🏦 Holder persona`, 'blue');
      await this.fetchWallets();
      await randomSleep(500, 1000);
      await this.fetchPortfolio();
      await randomSleep(300, 700);
      await this.fetchDepositHistory();
      await this.fetchOrderHistory();
    }
    
    log(`  ✓ Session completed`, 'green');
  }

  async simulateRandomActivities(): Promise<void> {
    // Random activities for returning users
    const activities = [
      { fn: () => this.fetchWallets(), weight: 10 },
      { fn: () => this.fetchPortfolio(), weight: 8 },
      { fn: () => this.fetchDepositHistory(), weight: 7 },
      { fn: () => this.fetchWithdrawalHistory(), weight: 6 },
      { fn: () => this.fetchOrderHistory(), weight: 6 },
      { fn: () => this.createDeposit(), weight: 4 },
      { fn: () => this.createWithdrawal(), weight: 3 },
      { fn: () => this.createOrder(), weight: 4 },
      { fn: () => this.createTransfer(), weight: 3 },
    ];
    
    const numActivities = randomInt(2, 6);
    for (let i = 0; i < numActivities; i++) {
      const totalWeight = activities.reduce((sum, a) => sum + a.weight, 0);
      let random = randomInt(0, totalWeight);
      
      for (const activity of activities) {
        random -= activity.weight;
        if (random <= 0) {
          await activity.fn();
          await randomSleep(500, 1500);
          break;
        }
      }
    }
    
    log(`  ✓ Activities completed`, 'green');
  }
}

// Admin Simulator Class
class AdminSimulator {
  token: string | null = null;
  api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${BASE_URL}/api`,
      headers: { 'Content-Type': 'application/json' },
    });
    
    this.api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  async login(): Promise<boolean> {
    try {
      // Try default admin credentials or create if needed
      const response = await this.api.post('/auth/login', {
        email: 'moeawidan99@gmail.com',
        password: '11223344',
      });
      
      this.token = response.data.accessToken;
      log(`  ✓ Admin logged in`, 'green');
      return true;
    } catch (error: any) {
      log(`  ✗ Admin login failed: ${error.response?.data?.message || error.message}`, 'red');
      return false;
    }
  }

  async fetchDashboard(): Promise<void> {
    try {
      const response = await this.api.get('/admin/dashboard');
      const data = response.data;
      if (VERBOSE) {
        log(`  ✓ Dashboard: ${data.totalUsers} users, ${data.pendingDeposits} pending deposits`, 'cyan');
        log(`    Volume: ${data.todayOrderVolume || 0} today, ${data.monthOrderVolume || 0} this month`, 'cyan');
      }
    } catch (error: any) {
      if (VERBOSE) log(`  ✗ Dashboard fetch failed: ${error.response?.data?.message || error.message}`, 'red');
    }
  }

  async fetchPendingDeposits(): Promise<void> {
    try {
      const response = await this.api.get('/admin/deposits?status=PENDING');
      if (VERBOSE) log(`  ✓ Pending deposits: ${response.data.deposits?.length || 0}`, 'cyan');
    } catch (error: any) {
      if (VERBOSE) log(`  ✗ Fetch deposits failed: ${error.response?.data?.message || error.message}`, 'red');
    }
  }

  async fetchPendingWithdrawals(): Promise<void> {
    try {
      const response = await this.api.get('/admin/withdrawals?status=PENDING');
      if (VERBOSE) log(`  ✓ Pending withdrawals: ${response.data.withdrawals?.length || 0}`, 'cyan');
    } catch (error: any) {
      if (VERBOSE) log(`  ✗ Fetch withdrawals failed: ${error.response?.data?.message || error.message}`, 'red');
    }
  }

  async fetchPendingKYC(): Promise<void> {
    try {
      const response = await this.api.get('/admin/kyc?status=PENDING');
      if (VERBOSE) log(`  ✓ Pending KYC: ${response.data.users?.length || 0}`, 'cyan');
    } catch (error: any) {
      if (VERBOSE) log(`  ✗ Fetch KYC failed: ${error.response?.data?.message || error.message}`, 'red');
    }
  }

  async fetchUsers(): Promise<void> {
    try {
      const response = await this.api.get('/admin/users?page=1');
      if (VERBOSE) log(`  ✓ Users: ${response.data.users?.length || 0} on page 1`, 'cyan');
    } catch (error: any) {
      if (VERBOSE) log(`  ✗ Fetch users failed: ${error.response?.data?.message || error.message}`, 'red');
    }
  }

  async fetchOrders(): Promise<void> {
    try {
      const response = await this.api.get('/admin/orders?page=1');
      if (VERBOSE) log(`  ✓ Orders: ${response.data.orders?.length || 0} on page 1`, 'cyan');
    } catch (error: any) {
      if (VERBOSE) log(`  ✗ Fetch orders failed: ${error.response?.data?.message || error.message}`, 'red');
    }
  }

  async updateRates(): Promise<boolean> {
    try {
      const pairs = [
        { base: 'USDT', quote: 'LYD', buy: 5.15 + Math.random() * 0.1, sell: 5.05 + Math.random() * 0.1 },
        { base: 'USDT', quote: 'USD', buy: 1.005, sell: 0.995 },
      ];
      
      for (const pair of pairs) {
        await this.api.put(`/admin/rates/${pair.base}/${pair.quote}`, {
          buyPrice: pair.buy,
          sellPrice: pair.sell,
        });
      }
      
      if (VERBOSE) log(`  ✓ Exchange rates updated`, 'green');
      return true;
    } catch (error: any) {
      if (VERBOSE) log(`  ✗ Update rates failed: ${error.response?.data?.message || error.message}`, 'red');
      return false;
    }
  }

  async simulate(): Promise<void> {
    log(`\n🔐 Admin Session`, 'bright');
    
    const loggedIn = await this.login();
    if (!loggedIn) return;
    
    await randomSleep(500, 1000);
    
    await this.fetchDashboard();
    await randomSleep(300, 800);
    
    await this.fetchPendingDeposits();
    await randomSleep(300, 800);
    
    await this.fetchPendingWithdrawals();
    await randomSleep(300, 800);
    
    await this.fetchPendingKYC();
    await randomSleep(300, 800);
    
    await this.fetchUsers();
    await randomSleep(300, 800);
    
    await this.fetchOrders();
    await randomSleep(300, 800);
    
    await this.updateRates();
    
    log(`  ✓ Admin session completed`, 'green');
  }
}

// Main simulation function
async function runSimulation() {
  const startTime = Date.now();
  const endTime = startTime + DURATION_MINUTES * 60 * 1000;
  
  log(`\n${'='.repeat(60)}`, 'bright');
  log('  PLATFORM ACTIVITY SIMULATOR', 'bright');
  log(`${'='.repeat(60)}`, 'bright');
  log(`  API URL: ${BASE_URL}`, 'dim');
  log(`  Users: ${NUM_USERS}`, 'dim');
  log(`  Duration: ${DURATION_MINUTES} minutes`, 'dim');
  log(`  Admin simulation: ${INCLUDE_ADMIN ? 'Yes' : 'No'}`, 'dim');
  log(`${'='.repeat(60)}\n`, 'bright');
  
 
  const users: SimulatedUser[] = [];
  
  // Create users
  for (let i = 0; i < NUM_USERS; i++) {
    users.push(new SimulatedUser(i));
  }
  
  // Run simulations
  let iteration = 0;
  while (Date.now() < endTime) {
    iteration++;
    log(`\n--- Iteration ${iteration} ---`, 'magenta');
    
    // Simulate random subset of users
    const activeUsers = users.slice(0, randomInt(1, Math.min(users.length, 5)));
    
    for (const user of activeUsers) {
      if (user.isRegistered) {
        // Already registered - just login and continue session
        log(`\n👤 User: ${user.email} (returning)`, 'bright');
        const loggedIn = await user.login();
        if (loggedIn) {
          await user.simulateRandomActivities();
        }
      } else {
        // New user - full registration flow
        await user.simulateSession();
      }
      await randomSleep(1000, 3000);
    }
    
    // Admin simulation every few iterations
    if (INCLUDE_ADMIN && iteration % 3 === 0) {
      const admin = new AdminSimulator();
      await admin.simulate();
    }
    
    // Progress update
    const remaining = Math.ceil((endTime - Date.now()) / 1000 / 60);
    log(`\n⏱️  ${remaining} minutes remaining`, 'blue');
    
    // Random delay between iterations
    await randomSleep(5000, 15000);
  }
  
  // Print final stats
  log(`\n${'='.repeat(60)}`, 'bright');
  log('  SIMULATION COMPLETE', 'bright');
  log(`${'='.repeat(60)}`, 'bright');
  log(`  Registrations: ${stats.registrations}`, 'green');
  log(`  Logins: ${stats.logins}`, 'green');
  log(`  Deposits: ${stats.deposits}`, 'green');
  log(`  Withdrawals: ${stats.withdrawals}`, 'green');
  log(`  Buy Orders: ${stats.orders.buy}`, 'green');
  log(`  Sell Orders: ${stats.orders.sell}`, 'green');
  log(`  Transfers: ${stats.transfers}`, 'green');
  log(`  Errors: ${stats.errors}`, stats.errors > 0 ? 'red' : 'green');
  log(`${'='.repeat(60)}\n`, 'bright');
}

// Run the simulation
runSimulation().catch((error: any) => {
  log(`\nFatal error: ${error.message}`, 'red');
  process.exit(1);
});
