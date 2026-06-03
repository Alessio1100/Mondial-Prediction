// src/app/api/events/route.js
// SSE endpoint con Edge Runtime: tiene la connessione aperta e notifica
// i client quando qualcuno salva qualcosa su Redis.

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

const REDIS_URL   = 'https://pro-opossum-113172.upstash.io';
const REDIS_TOKEN = 'gQAAAAAAAboUAAIgcDEzOWNhYjNhNDY3MWU0NWMyOGFhMmM0MzMyMjIzNjI0Ng';
const EVENT_KEY   = 'mondiali2026_lastop';

async function getLastTs() {
  try {
    const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(EVENT_KEY)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
      cache: 'no-store',
    });
    const json = await res.json();
    return json.result || '0';
  } catch {
    return '0';
  }
}

export async function GET(request) {
  const encoder = new TextEncoder();
  const url = new URL(request.url);
  let knownTs = url.searchParams.get('ts') || '0';

  const stream = new ReadableStream({
    async start(controller) {
      // Heartbeat iniziale
      controller.enqueue(encoder.encode(': connected\n\n'));

      let ticks = 0;

      while (true) {
        await new Promise(r => setTimeout(r, 800));
        ticks++;

        // Heartbeat ogni ~20s per evitare timeout
        if (ticks % 25 === 0) {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
          } catch {
            break;
          }
        }

        // Controlla se c'è un nuovo timestamp
        try {
          const ts = await getLastTs();
          if (ts !== knownTs) {
            knownTs = ts;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ts })}\n\n`));
          }
        } catch {
          // Ignora errori temporanei Redis
        }

        // Chiudi dopo 4 minuti → il client si riconnetterà automaticamente
        if (ticks >= 300) {
          try { controller.close(); } catch {}
          break;
        }
      }
    },
    cancel() {},
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    },
  });
}
