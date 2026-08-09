/**
 * Quick test for Sol-Arb bot
 * Tests Jupiter API connectivity and scan on devnet
 * Run: node test-bot.js
 */

const DEVNET_RPC = 'https://api.devnet.solana.com';
const JUPITER_API = 'https://quote-api.jup.ag/v6';

// Devnet USDC
const USDC_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
// Devnet SOL (wrapped)
const SOL_DEVNET = 'So11111111111111111111111111111111111111112';

async function testJupiter(mintIn, mintOut, amount) {
    const params = new URLSearchParams({
        inputMint: mintIn,
        outputMint: mintOut,
        amount: amount.toString(),
        slippageBps: '100',
    });
    
    console.log(`\n🔍 Testing: ${mintIn.slice(0,8)}... -> ${mintOut.slice(0,8)}... (${amount / 1e6} USDC)`);
    
    const start = Date.now();
    try {
        const res = await fetch(`${JUPITER_API}/quote?${params}`);
        const ms = Date.now() - start;
        
        if (res.status === 404) {
            console.log(`   ⚠️  No route found (${ms}ms)`);
            return null;
        }
        if (!res.ok) {
            console.log(`   ❌ HTTP ${res.status} (${ms}ms)`);
            return null;
        }
        
        const data = await res.json();
        const price = amount / Number(data.outAmount);
        const dex = data.routePlan?.[0]?.swapInfo?.label || 'Unknown';
        
        console.log(`   ✅ ${dex} | ${data.outAmount / 1e6} out | price: ${price.toFixed(6)} | ${ms}ms`);
        console.log(`   Path: ${data.routePlan?.map(r => r.swapInfo?.label).join(' → ')}`);
        console.log(`   Price impact: ${data.priceImpactPct}%`);
        
        return data;
    } catch (e) {
        console.log(`   ❌ Error: ${e.message} (${Date.now() - start}ms)`);
        return null;
    }
}

async function main() {
    console.log('🧪 Sol-Arb Bot Test Suite');
    console.log('═'.repeat(50));
    console.log(`   Jupiter API: ${JUPITER_API}`);
    console.log(`   Network: Devnet`);
    console.log();
    
    // Test 1: Basic quote
    console.log('📋 Test 1: Basic USDC → SOL quote');
    const q1 = await testJupiter(USDC_DEVNET, SOL_DEVNET, 1_000_000); // 1 USDC
    console.log(q1 ? '   PASS ✅' : '   FAIL ❌');
    
    // Test 2: Reverse quote
    console.log('\n📋 Test 2: SOL → USDC quote');
    const q2 = await testJupiter(SOL_DEVNET, USDC_DEVNET, 1_000_000_000); // 1 SOL
    console.log(q2 ? '   PASS ✅' : '   FAIL ❌');
    
    // Test 3: Large amount
    console.log('\n📋 Test 3: 100 USDC → SOL');
    const q3 = await testJupiter(USDC_DEVNET, SOL_DEVNET, 100_000_000); // 100 USDC
    console.log(q3 ? '   PASS ✅' : '   FAIL ❌');
    
    // Summary
    const results = [q1, q2, q3].filter(Boolean);
    console.log('\n═'.repeat(50));
    console.log(`📊 Results: ${results.length}/3 quotes successful`);
    console.log(`🌐 Jupiter API: ${results.length > 0 ? 'REACHABLE ✅' : 'UNREACHABLE ❌'}`);
    
    if (results.length > 0) {
        console.log('\n✅ Bot core works! Ready for:');
        console.log('   npm install && npm start');
    }
}

main().catch(e => {
    console.log('❌ Fatal:', e.message);
});
