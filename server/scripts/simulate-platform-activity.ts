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

const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const VERBOSE = process.argv.includes('--verbose');

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

// Stats tracking
const stats = {
  registrations: 0,
  logins: 0,
  deposits: 0,
  withdrawals: 0,
  orders: { buy: 0, sell: 0 },
  transfers: 0,
  agentRequests: 0,
  agentsCreated: 0,
  errors: 0,
};

// Fake data generators
const agentNames = ['Ahmed Cash Point', 'Mohamed Exchange', 'Libya Gold Shop', 'Tripoli Transfer', 'Benghazi Payments', 'Cash Plus Libya', 'Swift Exchange', 'Al-Farsi Money', 'Desert Pay Center', 'Mediterranean Cash'];
const agentCities = ['Tripoli', 'Benghazi', 'Misrata', 'Sabha', 'Zawiya', 'Sirte', 'Bayda', 'Zliten', 'Ajdabiya', 'Tobruk'];
const agentRegions = ['Al-Sha\'ab', 'Al-Mahari', 'Al-Fuwayhat', 'Al-Kuwayfia', 'Al-Majouri', 'Al-Sabri', 'Sidi Khalifa', 'Al-Andalus', 'Ghot Al-Shaal'];

// Global agent list for transfers
let globalAgents: any[] = [];

// Simulated User Class
class SimulatedUser {
  id: string | null = null;
  email: string;
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
      
      const response = await this.api.post('/auth/register', {
        email: this.email,
        password: this.password,
        firstName,
        lastName,
        phone: `+218${randomInt(900000000, 999999999)}`,
      });
      
      if (VERBOSE) log(`  ✓ Registered: ${this.email}`, 'green');
      this.token = response.data.accessToken;
      this.id = response.data.user.id;
      this.isRegistered = true;
      stats.registrations++;
      return true;
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
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
    try {
      const currencies = ['LYD', 'USD', 'USDT'];
      const methods = ['SADAD', 'MASREFY', 'BANK_TRANSFER', 'CASH_DEPOSIT'];
      const currency = randomChoice(currencies);
      const amount = randomAmount(100, 5000);
      
      // Create FormData for deposit with proof
      const formData = new FormData();
      formData.append('currency', currency);
      formData.append('amount', amount.toString());
      formData.append('paymentMethod', randomChoice(methods));
      formData.append('senderName', 'Test Sender');
      
      const response = await this.api.post('/deposits', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      if (VERBOSE) log(`  ✓ Deposit created: ${amount} ${currency}`, 'green');
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
      // Only BUY for now - users need to acquire USDT before they can sell
      const side = 'BUY';
      const baseCurrency = 'USDT';
      const quoteCurrency = randomChoice(['LYD', 'USD']);
      // Small amounts to ensure sufficient balance
      const amount = randomAmount(10, 50);
      
      // Fetch current rates
      const ratesResponse = await this.api.get('/exchange/rates');
      const rate = ratesResponse.data.rates?.find(
        (r: any) => r.baseCurrency === baseCurrency && r.quoteCurrency === quoteCurrency
      );
      
      if (!rate) {
        if (VERBOSE) log(`  ⚠ No rate found for ${baseCurrency}/${quoteCurrency}`, 'yellow');
        return false;
      }
      
      const price = side === 'BUY' ? rate.sellPrice : rate.buyPrice;
      const total = amount * price;
      
      const response = await this.api.post('/orders', {
        side,
        quoteCurrency,
        amount,
      });
      
      if (VERBOSE) log(`  ✓ Order created: ${side} ${amount} ${baseCurrency} @ ${price}`, 'green');
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
      
      const response = await this.api.post('/transfers/send', {
        recipientEmail: `simuser_${randomInt(1, 1000)}@test.com`,
        amount,
        note: 'Test transfer from simulator',
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

  async findAgents(): Promise<void> {
    try {
      const cities = ['Tripoli', 'Benghazi', 'Misrata', 'Sabha', 'Zawiya'];
      const response = await this.api.get('/agents/nearby', {
        params: { city: randomChoice(cities) },
      });
      if (VERBOSE) log(`  ✓ Found ${response.data.agents?.length || 0} agents`, 'cyan');
    } catch (error: any) {
      if (VERBOSE) log(`  ✗ Find agents failed: ${error.response?.data?.message || error.message}`, 'red');
    }
  }

  async requestAgentDeposit(): Promise<boolean> {
    try {
      const response = await this.api.get('/agents/nearby');
      const agents = response.data.agents || [];
      
      if (agents.length === 0) {
        if (VERBOSE) log(`  ⚠ No agents available for deposit request`, 'yellow');
        return false;
      }
      
      const agent: any = randomChoice(agents);
      const amount = randomAmount(100, 1000);
      
      await this.api.post('/agents/deposit', {
        agentId: agent.id,
        amount,
        currency: 'USDT',
        note: 'Test agent deposit',
      });
      
      if (VERBOSE) log(`  ✓ Agent deposit requested: ${amount} USDT via ${agent.name}`, 'green');
      stats.agentRequests++;
      return true;
    } catch (error: any) {
      if (VERBOSE) log(`  ✗ Agent deposit failed: ${error.response?.data?.message || error.message}`, 'red');
      return false;
    }
  }

  // Inject fake balance directly via backend API (simulates confirmed deposits)
  async injectFakeBalance(): Promise<boolean> {
    try {
      // Create deposits via API (only LYD/USD supported, USDT must come from trading)
      const currencies = ['LYD', 'USD'];
      const amounts = [10000, 5000]; // Generous starting balances for trading
      
      for (let i = 0; i < currencies.length; i++) {
        const currency = currencies[i];
        const amount = amounts[i] + randomAmount(0, amounts[i] * 0.5); // Add variance
        
        try {
          // Create deposit request - use SADAD for LYD to auto-confirm
          const formData = new FormData();
          formData.append('currency', currency);
          formData.append('amount', amount.toString());
          formData.append('paymentMethod', currency === 'LYD' ? 'SADAD' : 'BANK_TRANSFER');
          formData.append('senderName', 'Simulator');
          
          await this.api.post('/deposits', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          
          if (VERBOSE) log(`  💰 Injected ${amount.toFixed(2)} ${currency}`, 'cyan');
        } catch (e: any) {
          // Ignore deposit errors, just log
          if (VERBOSE) log(`  ⚠ Balance injection skipped for ${currency}: ${e.message}`, 'yellow');
        }
      }
      
      return true;
    } catch (error: any) {
      if (VERBOSE) log(`  ✗ Balance injection failed: ${error.message}`, 'red');
      return false;
    }
  }

  async simulateSession(): Promise<void> {
    log(`\n👤 User: ${this.email}`, 'bright');
    
    // Register and login
    const registered = await this.register();
    if (!registered) return;
    
    await randomSleep(300, 800);
    
    // Inject fake balance for realistic activity
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
      await this.findAgents();
      await randomSleep(500, 1000);
      
      // Try transfers
      const transferCount = randomInt(1, 3);
      for (let i = 0; i < transferCount; i++) {
        await this.createTransfer();
        await randomSleep(600, 1200);
      }
      
      await this.fetchTransferHistory();
      await this.requestAgentDeposit();
      
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
      { fn: () => this.findAgents(), weight: 4 },
      { fn: () => this.requestAgentDeposit(), weight: 2 },
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
        email: 'admin@promrkts.com',
        password: 'admin123',
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

  async seedAgents(count: number = 10): Promise<void> {
    log(`\n🤖 Seeding ${count} fake agents...`, 'bright');
    
    const loggedIn = await this.login();
    if (!loggedIn) {
      log(`  ✗ Cannot seed agents without admin login`, 'red');
      return;
    }
    
    let created = 0;
    for (let i = 0; i < count; i++) {
      try {
        const agentName = agentNames[i % agentNames.length] + ` #${i + 1}`;
        const city = randomChoice(agentCities);
        const region = randomChoice(agentRegions);
        const phone = `+218${randomInt(900000000, 999999999)}`;
        const email = `agent${i}_${Date.now()}@promrkts.com`;
        
        // Step 1: Create agent as a regular user first
        const userResponse = await this.api.post('/auth/register', {
          email,
          password: 'AgentPass123!',
          firstName: agentName.split(' ')[0],
          lastName: agentName.split(' ')[1] || 'Agent',
          phone,
        });
        
        const userId = userResponse.data.user.id;
        
        // Step 2: Create agent profile for this user
        const response = await this.api.post('/agents', {
          userId,
          name: agentName,
          phone,
          city,
          region,
          address: `${region}, ${city}, Libya`,
          googleMapsLink: `https://maps.google.com/?q=${city},Libya`,
          commissionRate: 0.01,
          maxDailyLimit: 10000,
        });
        
        if (response.data.agent) {
          globalAgents.push(response.data.agent);
          created++;
          if (VERBOSE) log(`  ✓ Created agent: ${agentName} in ${city}`, 'green');
        }
      } catch (error: any) {
        // Agent might already exist or endpoint might not exist
        if (VERBOSE) log(`  ⚠ Agent creation skipped: ${error.response?.data?.message || error.message}`, 'yellow');
      }
    }
    
    stats.agentsCreated = created;
    log(`  ✓ Seeded ${created} agents`, 'green');
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
  
  // Seed agents first if admin simulation is enabled
  if (INCLUDE_ADMIN) {
    const admin = new AdminSimulator();
    await admin.seedAgents(8);
    await randomSleep(1000, 2000);
  }
  
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
  log(`  Agents Created: ${stats.agentsCreated}`, 'green');
  log(`  Agent Requests: ${stats.agentRequests}`, 'green');
  log(`  Errors: ${stats.errors}`, stats.errors > 0 ? 'red' : 'green');
  log(`${'='.repeat(60)}\n`, 'bright');
}

// Run the simulation
runSimulation().catch((error: any) => {
  log(`\nFatal error: ${error.message}`, 'red');
  process.exit(1);
});
