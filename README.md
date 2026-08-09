# Sol-Arb: Solana Memecoin Arbitrage Bot 🦞

Cross-DEX arbitrage bot for Solana memecoins. Monitors prices across all
Solana DEXs via Jupiter API, detects arbitrage opportunities, and executes
trades atomically.

## ⚠️ Important
**START ON DEVNET.** Use real funds only after testing and understanding
the risks. Arbitrage is competitive — others may front-run your trades.

## Features

- **Multi-DEX scanning** — Jupiter API aggregates Raydium, Orca, Meteora, Phoenix, Lifinity
- **Atomic execution** — Buy + Sell in sequence with pre-flight simulation
- **Configurable thresholds** — Min profit, max trade size, slippage tolerance
- **Web dashboard** — Real-time opportunity viewer at localhost:3000
- **Auto-retry** — Failed trades auto-retry with fee escalation
- **Safety first** — Simulates every trade before sending

## Quick Start

```bash
# Install
npm install

# Monitor mode (devnet, no real funds)
npm start

# Dashboard (web UI)
npm run dashboard
# Open http://localhost:3000

# With trading wallet (USE DEVNET FIRST!)
cp .env.example .env
# Edit .env with your private key
npm start

# Mainnet (REAL FUNDS — BE CAREFUL)
DEV_MODE=false npm start
```

## Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Default | Description |
|---|---|---|
| `PRIVATE_KEY` | (none) | Solana wallet private key (base58) |
| `SOLANA_RPC` | api.mainnet-beta | RPC endpoint |
| `DEV_MODE` | true | Use devnet (false = mainnet) |
| `MIN_PROFIT_USD` | 0.50 | Minimum profit to execute ($) |
| `MAX_TRADE_USD` | 100 | Maximum trade size ($) |
| `SLIPPAGE_BPS` | 100 | Slippage tolerance (1%) |
| `PRIORITY_FEE` | 10000 | Priority fee in microLamports |
| `SCAN_INTERVAL_MS` | 2000 | Time between scans |
| `AUTO_EXECUTE` | (unset) | Auto-execute trades (dangerous!) |
| `MONITOR_TOKENS` | (default set) | Comma-separated mint addresses |

## Architecture

```
src/
├── config.js       # Configuration + known memecoins
├── jupiter.js      # Jupiter API: quotes, prices, swaps
├── executor.js     # Transaction signing + execution
├── index.js        # CLI runner with scanning loop
└── dashboard.js    # Express web dashboard
```

## How It Works

1. **Scan**: Queries Jupiter API for buy/sell quotes on monitored tokens
2. **Detect**: Compares best buy route vs best sell route for each token
3. **Profit Check**: If (sellPrice - buyPrice - fees) > threshold → execute
4. **Execute**: Buys on cheapest DEX, sells on most expensive (sequential)
5. **Safety**: Simulates each trade first. Skips if simulation fails

## Strategy Notes

- Best during **high volatility** (new token launches, news events)
- **Low-latency RPC** is critical. Use Helius, Triton, or QuickNode
- Start with **small trade sizes** and increase gradually
- Track your PnL — not every trade will be profitable after slippage

## Token List

Default monitored memecoins: BONK, WIF, POPCAT, MYRO, SAMO, BOME

Add custom tokens:
```
MONITOR_TOKENS=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263,7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

## License

MIT
