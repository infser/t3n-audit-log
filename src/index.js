#!/usr/bin/env node
/**
 * Sol-Arb: Solana Memecoin Arbitrage Bot
 * 
 * Monitors memecoin prices across all Solana DEXs and executes
 * arbitrage trades when profit exceeds threshold.
 * 
 * Usage:
 *   npm start                    # Monitor mode (devnet)
 *   DEV_MODE=false npm start     # Mainnet (WITH REAL FUNDS!)
 *   PRIVATE_KEY=xxx npm start    # With trading wallet
 */

import chalk from 'chalk';
import { CONFIG, KNOWN_MEMECOINS } from './config.js';
import { scanOpportunities, getTokenPrice } from './jupiter.js';
import { initExecutor, executeArbitrage, getBalance } from './executor.js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

// ─── Banner ──────────────────────────────────────────────────────────
console.log(chalk.cyan(`
╔══════════════════════════════════════════════╗
║        🦞 SOL-ARB Arbitrage Bot             ║
║    Cross-DEX Memecoin Arbitrage on Solana    ║
╚══════════════════════════════════════════════╝
`));

// ─── Status ──────────────────────────────────────────────────────────
const mode = CONFIG.DEV_MODE ? chalk.yellow('DEVNET') : chalk.red('⚠️ MAINNET');
const useWallet = CONFIG.PRIVATE_KEY ? chalk.green('Configured') : chalk.gray('Monitor only');
console.log(`  Network:  ${mode}`);
console.log(`  RPC:      ${CONFIG.RPC_URL}`);
console.log(`  Wallet:   ${useWallet}`);
console.log(`  Min prof: $${CONFIG.MIN_PROFIT_USD}`);
console.log(`  Max trade: $${CONFIG.MAX_TRADE_USD}`);
console.log(`  Tokens:   ${Object.keys(KNOWN_MEMECOINS).join(', ')}`);
console.log();

// ─── Init ────────────────────────────────────────────────────────────
if (CONFIG.PRIVATE_KEY) {
    initExecutor(CONFIG.RPC_URL, CONFIG.PRIVATE_KEY);
}

// ─── Stats ───────────────────────────────────────────────────────────
const stats = {
    scans: 0,
    opportunities: 0,
    trades: 0,
    totalProfits: 0,
    running: true,
    startTime: Date.now(),
};

// ─── Main Loop ───────────────────────────────────────────────────────
async function scan() {
    stats.scans++;
    
    try {
        const opportunities = await scanOpportunities();
        
        if (opportunities.length > 0) {
            stats.opportunities++;
            console.log(chalk.green(`\n🎯 [${new Date().toLocaleTimeString()}] ${opportunities.length} opportunities found!`));
            
            for (const opp of opportunities) {
                const tokenName = Object.entries(KNOWN_MEMECOINS)
                    .find(([, mint]) => mint === opp.mint)?.[0] || opp.mint.slice(0, 8);
                
                console.log(chalk.yellow(`\n   ${tokenName}`));
                console.log(`   Buy on:  ${opp.buyDex}  →  Sell on: ${opp.sellDex}`);
                console.log(`   Cost:    $${opp.cost}`);
                console.log(`   Revenue: $${opp.revenue}`);
                console.log(`   Profit:  ${chalk.green('$' + opp.profit)} (${opp.profitPercent}%)`);
                
                // Auto-execute if wallet is configured
                if (CONFIG.PRIVATE_KEY && CONFIG.AUTO_EXECUTE) {
                    console.log(chalk.cyan('\n   🚀 Auto-executing...'));
                    const result = await executeArbitrage(opp);
                    if (result.success) {
                        stats.trades++;
                        stats.totalProfits += parseFloat(opp.profit);
                    }
                }
            }
        } else {
            process.stdout.write(chalk.gray(`\r   Scanning... ${stats.scans} checks | ${stats.opportunities} opps | ${stats.trades} trades`));
        }
    } catch (e) {
        console.error(chalk.red(`\n   ❌ Scan error: ${e.message}`));
    }
}

// ─── Start ───────────────────────────────────────────────────────────
async function main() {
    console.log(chalk.cyan('🔍 Starting scan loop...\n'));
    
    // Initial price check
    console.log('📊 Token prices:');
    for (const [name, mint] of Object.entries(KNOWN_MEMECOINS).slice(0, 6)) {
        const price = await getTokenPrice(mint);
        const priceStr = price ? `$${price.toFixed(6)}` : 'N/A';
        console.log(`   ${name.padEnd(8)} ${priceStr}`);
    }
    console.log();
    
    if (CONFIG.PRIVATE_KEY) {
        const bal = await getBalance();
        console.log(`💰 Wallet balance: ${(bal / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);
    }
    
    // Main loop
    const runScan = () => {
        if (!stats.running) return;
        scan().finally(() => setTimeout(runScan, CONFIG.SCAN_INTERVAL_MS));
    };
    runScan();
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log(chalk.cyan('\n\n📊 Session Stats:'));
        console.log(`   Scans: ${stats.scans}`);
        console.log(`   Opportunities: ${stats.opportunities}`);
        console.log(`   Trades: ${stats.trades}`);
        console.log(`   Est. Profit: $${stats.totalProfits.toFixed(2)}`);
        console.log(`   Runtime: ${Math.floor((Date.now() - stats.startTime) / 60000)}m`);
        stats.running = false;
        process.exit(0);
    });
}

main().catch(e => {
    console.error(chalk.red(`Fatal: ${e.message}`));
    process.exit(1);
});
