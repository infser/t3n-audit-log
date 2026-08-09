/**
 * Sol-Arb Dashboard - Web interface for monitoring arbitrage opportunities
 * 
 * Start with: node src/dashboard.js
 * Then open: http://localhost:3000
 */

import express from 'express';
import { CONFIG, KNOWN_MEMECOINS } from './config.js';
import { scanOpportunities, getTokenPrice } from './jupiter.js';
import { initExecutor, getBalance } from './executor.js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Store latest scan results
let latestScan = { opportunities: [], timestamp: null, prices: {} };

// Init if wallet configured
if (CONFIG.PRIVATE_KEY) {
    initExecutor(CONFIG.RPC_URL, CONFIG.PRIVATE_KEY);
}

// API endpoints
app.get('/api/scan', async (req, res) => {
    try {
        const opportunities = await scanOpportunities();
        const prices = {};
        for (const [name, mint] of Object.entries(KNOWN_MEMECOINS)) {
            prices[name] = await getTokenPrice(mint);
        }
        latestScan = { opportunities, timestamp: Date.now(), prices };
        res.json(latestScan);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/config', (req, res) => {
    res.json({
        network: CONFIG.DEV_MODE ? 'devnet' : 'mainnet',
        minProfit: CONFIG.MIN_PROFIT_USD,
        maxTrade: CONFIG.MAX_TRADE_USD,
        tokens: Object.keys(KNOWN_MEMECOINS),
        walletConfigured: !!CONFIG.PRIVATE_KEY,
    });
});

app.get('/api/balance', async (req, res) => {
    try {
        const balance = await getBalance();
        res.json({ balance: balance / LAMPORTS_PER_SOL });
    } catch (e) {
        res.json({ balance: 0, error: 'No wallet configured' });
    }
});

// Serve dashboard
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sol-Arb Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; background: #0a0a0a; color: #00ff88; padding: 20px; }
        .header { border-bottom: 1px solid #00ff8833; padding-bottom: 20px; margin-bottom: 20px; }
        h1 { font-size: 24px; }
        .status { display: flex; gap: 20px; margin: 15px 0; }
        .status-card { background: #111; border: 1px solid #00ff8833; padding: 12px 20px; border-radius: 8px; }
        .status-card .label { color: #666; font-size: 11px; text-transform: uppercase; }
        .status-card .value { font-size: 20px; margin-top: 4px; }
        .opp { background: #111; border: 1px solid #00ff8833; padding: 15px; margin: 10px 0; border-radius: 8px; }
        .opp .token { font-size: 18px; color: #ffcc00; }
        .opp .route { color: #888; margin: 5px 0; }
        .opp .profit { font-size: 22px; color: #00ff88; margin-top: 8px; }
        .opp .detail { color: #666; font-size: 12px; margin-top: 4px; }
        .no-opp { color: #666; text-align: center; padding: 40px; }
        .auto-refresh { color: #666; font-size: 11px; margin-top: 5px; }
        .devnet-badge { background: #ff6600; color: #000; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🦞 Sol-Arb Dashboard</h1>
        <div class="status">
            <div class="status-card">
                <div class="label">Network</div>
                <div class="value" id="network">-</div>
            </div>
            <div class="status-card">
                <div class="label">Wallet</div>
                <div class="value" id="balance">-</div>
            </div>
            <div class="status-card">
                <div class="label">Min Profit</div>
                <div class="value" id="minProfit">-</div>
            </div>
            <div class="status-card">
                <div class="label">Max Trade</div>
                <div class="value" id="maxTrade">-</div>
            </div>
        </div>
        <div class="auto-refresh" id="refresh">Auto-refresh: 5s | Last scan: -</div>
    </div>
    <div id="opps"><div class="no-opp">Scanning...</div></div>
    <script>
        async function refresh() {
            try {
                const [scanRes, configRes, balRes] = await Promise.all([
                    fetch('/api/scan'), fetch('/api/config'), fetch('/api/balance')
                ]);
                const scan = await scanRes.json();
                const config = await configRes.json();
                const bal = await balRes.json();
                
                document.getElementById('network').innerHTML = config.network.toUpperCase();
                document.getElementById('balance').textContent = bal.balance.toFixed(2) + ' SOL';
                document.getElementById('minProfit').textContent = '$' + config.minProfit;
                document.getElementById('maxTrade').textContent = '$' + config.maxTrade;
                document.getElementById('refresh').textContent = 'Auto-refresh: 5s | Last: ' + new Date(scan.timestamp).toLocaleTimeString();
                
                const oppsDiv = document.getElementById('opps');
                if (!scan.opportunities?.length) {
                    oppsDiv.innerHTML = '<div class="no-opp">No arbitrage opportunities found</div>';
                } else {
                    oppsDiv.innerHTML = scan.opportunities.map(o => 
                        '<div class="opp">' +
                        '<div class="token">' + o.mint.slice(0,8) + '...</div>' +
                        '<div class="route">Buy: ' + o.buyDex + ' → Sell: ' + o.sellDex + '</div>' +
                        '<div class="profit">$' + o.profit + ' (' + o.profitPercent + '%)</div>' +
                        '<div class="detail">Cost: $' + o.cost + ' | Rev: $' + o.revenue + '</div>' +
                        '</div>'
                    ).join('');
                }
            } catch(e) { console.error(e); }
        }
        refresh();
        setInterval(refresh, 5000);
    </script>
</body>
</html>`);
});

app.listen(PORT, () => {
    console.log(`\n🦞 Sol-Arb Dashboard running at http://localhost:${PORT}\n`);
});
