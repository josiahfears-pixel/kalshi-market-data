import test from "node:test"; import assert from "node:assert"; import { handle, allowed } from "../worker.mjs";
const post = b => new Request("https://x/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const fakeKalshi = (status, body, seen = []) => async (url) => { seen.push(url); return new Response(JSON.stringify(body), { status }); };
test("initialize and tools/list", async () => {
  const i = await (await handle(post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }))).json();
  assert.equal(i.result.serverInfo.name, "kalshi-market-data"); assert.ok(i.result.capabilities.tools);
  const l = await (await handle(post({ jsonrpc: "2.0", id: 2, method: "tools/list" }))).json();
  assert.deepEqual(l.result.tools.map(t => t.name), ["kalshi_get"]);
  assert.equal((await handle(post({ jsonrpc: "2.0", method: "notifications/initialized" }))).status, 202);
});
test("only public read paths are allowed", () => {
  for (const p of ["/markets?series_ticker=KXBTCD&status=open&limit=1000", "/markets/KXBTCD-26OCT2603-T80299.99", "/markets/KXBTCD-26OCT2603-T80299.99/orderbook", "/series/KXBTCD/markets/KXBTCD-26OCT2603-T80299.99/candlesticks?start_ts=1&end_ts=2&period_interval=1"]) assert.ok(allowed(p), p);
  for (const p of ["/portfolio/orders", "/portfolio/balance", "/markets/../portfolio", "https://evil", "", null]) assert.ok(!allowed(p), String(p));
});
test("tools/call passes Kalshi's JSON through and only calls Kalshi's API host", async () => {
  const seen = [], r = await (await handle(post({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "kalshi_get", arguments: { path: "/markets/T1" } } }), fakeKalshi(200, { market: { ticker: "T1" } }, seen))).json();
  assert.equal(r.result.structuredContent.market.ticker, "T1"); assert.equal(seen[0], "https://api.elections.kalshi.com/trade-api/v2/markets/T1");
  assert.equal(JSON.parse(r.result.content[0].text).market.ticker, "T1");
});
test("errors are reported, never replaced with data", async () => {
  const r = await (await handle(post({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "kalshi_get", arguments: { path: "/markets/T1" } } }), fakeKalshi(503, { error: "down" }))).json();
  assert.equal(r.result.isError, true); assert.match(r.result.content[0].text, /503/); assert.equal(r.result.structuredContent, undefined);
  const b = await (await handle(post({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "kalshi_get", arguments: { path: "/portfolio/orders" } } }), () => { throw new Error("must not fetch"); })).json();
  assert.equal(b.result.isError, true);
});
