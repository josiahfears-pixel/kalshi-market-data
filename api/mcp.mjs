// Vercel entry point: the same read-only handler as the Cloudflare worker.
import { handle } from "../worker.mjs";
export const GET = req => handle(req);
export const POST = req => handle(req);
export const OPTIONS = req => handle(req);
