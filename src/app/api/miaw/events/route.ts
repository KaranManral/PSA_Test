import { MiawApiClient } from "@/app/lib/miawApiService";

// GET /api/miaw/events - Proxies the SSE stream from MIAW to the client
export async function GET() {
  const client = MiawApiClient.getInstance();
  // Returns a Response with 'text/event-stream' headers set inside
  return await client.subscribeEvents();
}
