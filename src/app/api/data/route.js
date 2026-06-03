// src/app/api/data/route.js

const REDIS_URL   = 'https://pro-opossum-113172.upstash.io';
const REDIS_TOKEN = 'gQAAAAAAAboUAAIgcDEzOWNhYjNhNDY3MWU0NWMyOGFhMmM0MzMyMjIzNjI0Ng';
const STATE_KEY   = 'mondiali2026_state';
const EVENT_KEY   = 'mondiali2026_lastop';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    cache: 'no-store',
  });
  const json = await res.json();
  if (!json || json.result === null || json.result === undefined) return null;
  try { return JSON.parse(json.result); } catch { return json.result; }
}

async function redisSet(key, value) {
  const res = await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(JSON.stringify(value)),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
}

async function redisBumpTimestamp() {
  const ts = Date.now().toString();
  await fetch(`${REDIS_URL}/set/${encodeURIComponent(EVENT_KEY)}/${encodeURIComponent(ts)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  return ts;
}

export async function GET() {
  const data = await redisGet(STATE_KEY);
  return Response.json(data || {}, { headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'JSON non valido' }, { status: 400, headers: CORS });
  }

  const { op, payload } = body;
  if (!op || payload === undefined) {
    return Response.json({ error: 'op e payload richiesti' }, { status: 400, headers: CORS });
  }

  let current = await redisGet(STATE_KEY) || {};

  switch (op) {
    case 'specials': {
      const { player, winner, scorer } = payload;
      if (!player) return Response.json({ error: 'player mancante' }, { status: 400, headers: CORS });
      if (!current.specials) current.specials = {};
      current.specials[player] = { winner: winner || '', scorer: scorer || '' };
      break;
    }
    case 'groups':
    case 'predictions': {
      const { player, predictions } = payload;
      if (!player) return Response.json({ error: 'player mancante' }, { status: 400, headers: CORS });
      if (!current.predictions) current.predictions = {};
      current.predictions[player] = predictions;
      break;
    }
    case 'players':
      current.players = payload.players;
      break;
    case 'realStandings':
      current.realStandings = payload.realStandings;
      break;
    case 'realSpecials':
      current.realSpecials = { winner: payload.winner || '', scorer: payload.scorer || '' };
      break;
    case 'full':
      if (!current || Object.keys(current).length === 0) current = payload;
      break;
    default:
      return Response.json({ error: 'op non riconosciuta: ' + op }, { status: 400, headers: CORS });
  }

  await redisSet(STATE_KEY, current);
  const ts = await redisBumpTimestamp();

  return Response.json({ ok: true, op, ts }, { headers: CORS });
}
