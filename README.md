# kalshi-market-data: a tiny read-only Kalshi backend for the BTC picker page

A published claude.ai page can only reach outside services through connectors. This Cloudflare Worker is a remote MCP
server with one tool, `kalshi_get`, that reads Kalshi's **public** market data (markets, events, series, order books,
candlesticks) from `https://api.elections.kalshi.com/trade-api/v2`. It needs no Kalshi account or key, it holds no
secrets, and it cannot place orders: any path outside the read-only allow list is refused.

## Set up (about 5 minutes, free)
1. Make a free Cloudflare account, install Node 18+, then in this folder run `npx wrangler login` and `npx wrangler deploy`.
   Wrangler prints a URL like `https://kalshi-market-data.<you>.workers.dev`.
2. In claude.ai go to Settings > Connectors > Add custom connector. Name it exactly **Kalshi Market Data** and paste that URL.
3. Open the BTC Hourly Locks page and allow the Kalshi Market Data connector when asked. The Data connections panel shows
   which Kalshi route is working.

Tests: `node --test test/worker.test.mjs` (fake Kalshi responses; they check the protocol, the allow list and error handling).
