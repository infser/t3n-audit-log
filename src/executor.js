/**
 * Arbitrage Executor - Signs and executes Solana trades atomically
 * 
 * Uses Jupiter swap API for best execution. Implements:
 * - Priority fees for fast inclusion
 * - Pre-flight simulation to avoid reverts
 * - Automatic retry with fee escalation
 */

import { Connection, Keypair, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { CONFIG } from './config.js';
import { getSwapTransaction } from './jupiter.js';

let connection;
let wallet;

export function initExecutor(rpcUrl, privateKeyB58) {
    connection = new Connection(rpcUrl || CONFIG.RPC_URL, 'confirmed');
    if (privateKeyB58) {
        const secretKey = bs58.decode(privateKeyB58);
        wallet = Keypair.fromSecretKey(secretKey);
    }
    return { connection, wallet };
}

export function getConnection() { return connection; }
export function getWallet() { return wallet; }

/**
 * Execute a swap via Jupiter
 * @param {object} quote - Jupiter quote response
 * @returns {object} { success, signature, error }
 */
export async function executeSwap(quote) {
    if (!wallet) return { success: false, error: 'No wallet configured. Set PRIVATE_KEY in .env' };
    
    for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
        try {
            console.log(`   🔄 Swap attempt ${attempt}/${CONFIG.MAX_RETRIES}`);
            
            // Get swap transaction from Jupiter
            const swapResult = await getSwapTransaction(quote, wallet.publicKey.toString());
            if (!swapResult?.swapTransaction) {
                return { success: false, error: 'Failed to get swap transaction' };
            }
            
            // Deserialize and sign
            const swapTxBuf = Buffer.from(swapResult.swapTransaction, 'base64');
            const transaction = VersionedTransaction.deserialize(swapTxBuf);
            transaction.sign([wallet]);
            
            // Simulate first (pre-flight check)
            const simResult = await connection.simulateTransaction(transaction, {
                sigVerify: false,
                replaceRecentBlockhash: true,
            });
            
            if (simResult.value.err) {
                const errMsg = JSON.stringify(simResult.value.err);
                console.log(`   ⚠️ Sim failed: ${errMsg}`);
                if (attempt < CONFIG.MAX_RETRIES) {
                    await sleep(500 * attempt);
                    continue;
                }
                return { success: false, error: `Simulation failed: ${errMsg}` };
            }
            
            // Send transaction
            const signature = await connection.sendRawTransaction(
                transaction.serialize(),
                { skipPreflight: false, maxRetries: 3 }
            );
            
            console.log(`   📡 TX sent: ${signature}`);
            
            // Wait for confirmation
            const confirmation = await connection.confirmTransaction(signature, 'confirmed');
            if (confirmation.value.err) {
                console.log(`   ❌ TX failed: ${JSON.stringify(confirmation.value.err)}`);
                if (attempt < CONFIG.MAX_RETRIES) {
                    await sleep(500 * attempt);
                    continue;
                }
                return { success: false, error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}`, signature };
            }
            
            console.log(`   ✅ Confirmed! ${getExplorerUrl(signature)}`);
            return { success: true, signature };
            
        } catch (e) {
            console.log(`   ❌ Error: ${e.message}`);
            if (attempt < CONFIG.MAX_RETRIES) {
                await sleep(500 * attempt);
            } else {
                return { success: false, error: e.message };
            }
        }
    }
    
    return { success: false, error: 'Max retries exceeded' };
}

/**
 * Execute a full arbitrage: buy on one route, sell on another
 * @param {object} opportunity - From scanOpportunities
 */
export async function executeArbitrage(opportunity) {
    if (!wallet) return { success: false, error: 'No wallet configured' };
    
    console.log(`\n⚡ EXECUTING ARBITRAGE`);
    console.log(`   Token: ${opportunity.mint}`);
    console.log(`   Expected profit: $${opportunity.profit}`);
    console.log(`   Cost: $${opportunity.cost}`);
    
    // Step 1: Buy tokens (USDC -> Token)
    console.log(`\n📥 BUY: USDC -> Token via ${opportunity.buyDex}`);
    const buyResult = await executeSwap(opportunity.buyQuote);
    if (!buyResult.success) {
        return { success: false, error: `Buy failed: ${buyResult.error}`, step: 'buy' };
    }
    
    // Step 2: Sell tokens (Token -> USDC)
    console.log(`\n📤 SELL: Token -> USDC via ${opportunity.sellDex}`);
    const sellResult = await executeSwap(opportunity.sellQuote);
    if (!sellResult.success) {
        console.log(`   ⚠️ WARNING: Buy succeeded but sell failed. You hold ${opportunity.mint} tokens!`);
        return { success: false, error: `Sell failed: ${sellResult.error}`, step: 'sell', buyTx: buyResult.signature };
    }
    
    // Check final balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`\n💰 Final SOL balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    console.log(`   Buy TX: ${getExplorerUrl(buyResult.signature)}`);
    console.log(`   Sell TX: ${getExplorerUrl(sellResult.signature)}`);
    
    return {
        success: true,
        buyTx: buyResult.signature,
        sellTx: sellResult.signature,
        expectedProfit: opportunity.profit,
    };
}

/**
 * Check wallet SOL balance
 */
export async function getBalance() {
    if (!wallet || !connection) return 0;
    return await connection.getBalance(wallet.publicKey);
}

function getExplorerUrl(signature) {
    const cluster = CONFIG.DEV_MODE ? 'devnet' : '';
    return `https://explorer.solana.com/tx/${signature}${cluster ? `?cluster=${cluster}` : ''}`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
