/**
 * Sol-Arb: Solana Memecoin Arbitrage Bot
 * 
 * Monitors memecoin prices across DEXs, detects arbitrage
 * opportunities, and executes atomic cross-DEX trades.
 * 
 * ⚠️ USE ON DEVNET FIRST. Real funds only after testing.
 */

import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  // Network
  RPC_URL: process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
  DEVNET_RPC: 'https://api.devnet.solana.com',
  DEV_MODE: process.env.DEV_MODE !== 'false',

  // Wallet
  PRIVATE_KEY: process.env.PRIVATE_KEY || null,
  
  // Arbitrage
  MIN_PROFIT_USD: parseFloat(process.env.MIN_PROFIT_USD || '0.50'),
  MAX_TRADE_USD: parseFloat(process.env.MAX_TRADE_USD || '100'),
  SLIPPAGE_BPS: parseInt(process.env.SLIPPAGE_BPS || '100'), // 1%
  SCAN_INTERVAL_MS: parseInt(process.env.SCAN_INTERVAL_MS || '2000'),
  
  // Tokens to monitor (add memecoin mints here)
  MONITOR_TOKENS: (process.env.MONITOR_TOKENS || '')
    .split(',')
    .filter(Boolean)
    .map(t => t.trim()),
  
  // Jupiter
  JUPITER_API: 'https://quote-api.jup.ag/v6',
  JUPITER_FEE_BPS: 0, // Jupiter has no protocol fee
  
  // DEXs to arbitrage between
  DEX_LIST: ['Raydium', 'Orca', 'Meteora', 'Phoenix', 'Lifinity'],
  
  // Execution
  MAX_RETRIES: 3,
  PRIORITY_FEE: parseInt(process.env.PRIORITY_FEE || '10000'), // microLamports
  COMPUTE_UNITS: 300000,
};

// Popular memecoins on Solana (mainnet addresses)
export const KNOWN_MEMECOINS = {
  'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'WIF': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  'POPCAT': '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
  'MYRO': 'HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahTTUCZeZg4',
  'SAMO': '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  'BOME': 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',
};
