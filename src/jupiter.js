/**
 * Jupiter API - Quote fetching across all Solana DEXs
 * 
 * Jupiter aggregates every DEX on Solana, so we use it to find
 * the best price for any token pair without connecting to each DEX individually.
 */

import fetch from 'node-fetch';
import { CONFIG } from './config.js';

const JUP_API = CONFIG.JUPITER_API;

/**
 * Get the best buy/sell route for a token pair
 * @param {string} inputMint - Token to sell
 * @param {string} outputMint - Token to buy
 * @param {number} amount - Amount in lamports (smallest unit)
 * @param {number} slippageBps - Slippage tolerance in basis points
 */
export async function getQuote(inputMint, outputMint, amount, slippageBps = CONFIG.SLIPPAGE_BPS) {
    const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
        onlyDirectRoutes: 'false',
    });

    try {
        const res = await fetch(`${JUP_API}/quote?${params}`);
        if (!res.ok) {
            if (res.status === 404) return null; // No route found
            throw new Error(`Jupiter quote failed: ${res.status}`);
        }
        return await res.json();
    } catch (e) {
        return null;
    }
}

/**
 * Get swap transaction for executing a route
 * @param {object} quote - Quote from getQuote
 * @param {string} wallet - User wallet public key
 */
export async function getSwapTransaction(quote, wallet) {
    try {
        const res = await fetch(`${JUP_API}/swap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quoteResponse: quote,
                userPublicKey: wallet,
                wrapAndUnwrapSol: true,
                dynamicComputeUnitLimit: true,
                prioritizationFeeLamports: {
                    priorityLevelWithMaxLamports: {
                        maxLamports: CONFIG.PRIORITY_FEE,
                        priorityLevel: 'veryHigh'
                    }
                }
            }),
        });
        if (!res.ok) throw new Error(`Jupiter swap failed: ${res.status}`);
        return await res.json();
    } catch (e) {
        return null;
    }
}

/**
 * Get token price in USDC from Jupiter
 * @param {string} mint - Token mint address
 * @returns {number|null} Price in USD
 */
export async function getTokenPrice(mint) {
    // USDC mint on Solana
    const USDC_MINT = CONFIG.DEV_MODE 
        ? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' // devnet USDC
        : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // mainnet USDC
    
    // Try 1 USDC worth for price discovery
    const quote = await getQuote(mint, USDC_MINT, 1000000); // 1 USDC
    if (!quote || !quote.outAmount) return null;
    
    // outAmount for 1 USDC input -> price of 1 token in USDC = 1 / outAmount
    const outAmount = Number(quote.outAmount);
    return 1000000 / outAmount;
}

/**
 * Scan multiple tokens for arbitrage opportunities
 * @returns {Array} List of opportunities sorted by profit
 */
export async function scanOpportunities() {
    const tokens = CONFIG.MONITOR_TOKENS.length > 0 
        ? CONFIG.MONITOR_TOKENS 
        : Object.values(CONFIG.KNOWN_MEMECOINS).slice(0, 5);
    
    const opportunities = [];
    const USDC_MINT = CONFIG.DEV_MODE
        ? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
        : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    
    for (const mint of tokens) {
        // Get best buy route (USDC -> Token)
        const buyQuote = await getQuote(USDC_MINT, mint, CONFIG.MAX_TRADE_USD * 1000000);
        if (!buyQuote) continue;
        
        // Get best sell route (Token -> USDC)  
        const tokenAmount = Number(buyQuote.outAmount);
        const sellQuote = await getQuote(mint, USDC_MINT, Math.floor(tokenAmount));
        if (!sellQuote) continue;
        
        const cost = CONFIG.MAX_TRADE_USD;
        const revenue = Number(sellQuote.outAmount) / 1000000;
        const profit = revenue - cost;
        
        if (profit > CONFIG.MIN_PROFIT_USD) {
            opportunities.push({
                mint,
                buyDex: buyQuote.routePlan?.[0]?.swapInfo?.label || 'Unknown',
                sellDex: sellQuote.routePlan?.[0]?.swapInfo?.label || 'Unknown',
                cost,
                revenue: revenue.toFixed(4),
                profit: profit.toFixed(4),
                profitPercent: ((profit / cost) * 100).toFixed(2),
                buyQuote,
                sellQuote,
                timestamp: Date.now(),
            });
        }
    }
    
    return opportunities.sort((a, b) => b.profit - a.profit);
}
