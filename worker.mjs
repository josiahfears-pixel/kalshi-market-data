// Read-only Kalshi market data as a remote MCP server (Streamable HTTP, stateless JSON responses).
// One tool, kalshi_get, that GETs an allow-listed path from Kalshi's public trade API v2. No API key, no orders:
// it can only read markets, events, series, order books and candlesticks. Deploy: `npx wrangler deploy`.
const KAPI = "https://api.elections.kalshi.com/trade-api/v2";
const ALLOW = [
  /^\/markets(\?[^#]*)?$/,
  /^\/markets\/[A-Z0-9.\-]+(\?[^#]*)?$/,
  /^\/markets\/[A-Z0-9.\-]+\/orderbook(\?[^#]*)?$/,
  /^\/events\/[A-Z0-9.\-]+(\?[^#]*)?$/,
  /^\/series\/[A-Z0-9.\-]+(\?[^#]*)?$/,
  /^\/series\/[A-Z0-9.\-]+\/markets\/[A-Z0-9.\-]+\/candlesticks(\?[^#]*)?$/,
];
const TOOL = {
  name: "kalshi_get",
  description: "Read Kalshi public market data (GET only, no key). path is relative to /trade-api/v2, e.g. /markets?series_ticker=KXBTCD&status=open or /markets/KXBTCD-26OCT2603-T80299.99/orderbook. Returns Kalshi's JSON unchanged.",
  inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  annotations: { readOnlyHint: true, openWorldHint: true },
};
export const allowed = path => typeof path === "string" && path.length < 600 && !path.includes("..") && ALLOW.some(r => r.test(path));
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, mcp-protocol-version, mcp-session-id, authorization", "access-control-allow-methods": "POST, OPTIONS" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors } });
const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const err = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

async function call(msg, fetchImpl) {
  const { id, method, params } = msg || {};
  if (method === "initialize") return ok(id, { protocolVersion: (params && params.protocolVersion) || "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "kalshi-market-data", version: "1.0.0" } });
  if (method === "ping") return ok(id, {});
  if (method === "tools/list") return ok(id, { tools: [TOOL] });
  if (method === "tools/call") {
    if (!params || params.name !== TOOL.name) return err(id, -32602, "unknown tool");
    const path = params.arguments && params.arguments.path;
    if (!allowed(path)) return ok(id, { isError: true, content: [{ type: "text", text: "path not allowed: only public market data reads" }] });
    const t0 = Date.now();
    const r = await fetchImpl(KAPI + path, { headers: { accept: "application/json" } });
    const text = await r.text();
    if (!r.ok) return ok(id, { isError: true, content: [{ type: "text", text: `Kalshi HTTP ${r.status}: ${text.slice(0, 300)}` }] });
    let data; try { data = JSON.parse(text); } catch { return ok(id, { isError: true, content: [{ type: "text", text: "Kalshi returned non-JSON" }] }); }
    const meta = { fetchedAt: new Date().toISOString(), ms: Date.now() - t0, source: KAPI + path };
    return ok(id, { content: [{ type: "text", text }], structuredContent: { ...data, _meta_kalshi: meta } });
  }
  if (id === undefined) return null; // notifications (e.g. notifications/initialized) get no response
  return err(id, -32601, "method not found");
}

export async function handle(request, fetchImpl = fetch) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method === "GET") { // opening the URL in a browser shows a live Kalshi test
    const r = await fetchImpl(KAPI + "/markets?series_ticker=KXBTCD&status=open&limit=3", { headers: { accept: "application/json" } });
    return new Response("kalshi-market-data is running. Kalshi test: HTTP " + r.status + "\n" + (await r.text()).slice(0, 600), { headers: { "content-type": "text/plain", ...cors } });
  }
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  let body; try { body = await request.json(); } catch { return json(err(null, -32700, "parse error"), 400); }
  if (Array.isArray(body)) { const out = (await Promise.all(body.map(m => call(m, fetchImpl)))).filter(Boolean); return out.length ? json(out) : new Response(null, { status: 202, headers: cors }); }
  const out = await call(body, fetchImpl);
  return out ? json(out) : new Response(null, { status: 202, headers: cors });
}
export default { fetch: req => handle(req) };
