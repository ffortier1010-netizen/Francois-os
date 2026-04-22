import { NextResponse } from "next/server";
import { createSign } from "crypto";

export const maxDuration = 60;

// ─── AUTH GOOGLE ──────────────────────────────────────────────────────────────
async function getGoogleToken(): Promise<string> {
  const creds = JSON.parse(Buffer.from(process.env.GOOGLE_DRIVE_CREDENTIALS!, "base64").toString());
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })).toString("base64url");
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const jwt = `${header}.${payload}.${sign.sign(creds.private_key, "base64url")}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }).toString(),
  });
  const data = await res.json();
  return data.access_token;
}

// ─── CALENDRIERS ──────────────────────────────────────────────────────────────
const ALL_CALENDARS = [
  { id: "francois.fortier@spacia.ca", label: "Spacia" },
  { id: "f.fortier1010@gmail.com", label: "Personnel" },
  { id: "francois.fortier@remax-quebec.com", label: "RE/MAX" },
];

// ─── REDIS ────────────────────────────────────────────────────────────────────
async function redisCommand(command: unknown[]) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
  if (url?.startsWith("redis://")) {
    // Redis direct — pas REST
    return null;
  }
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  return data.result;
}

// ─── TWILIO SMS ───────────────────────────────────────────────────────────────
async function sendSMS(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_PHONE_NUMBER!;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${auth}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });
}

// ─── TÂCHES EN RETARD ─────────────────────────────────────────────────────────
async function getTachesEnAttente(): Promise<string[]> {
  try {
    const res = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/data`);
    const data = await res.json();
    return (data.taches || [])
      .filter((t: { fait: boolean }) => !t.fait)
      .map((t: { texte: string }) => t.texte);
  } catch { return []; }
}

// ─── ÉVÉNEMENTS DU JOUR ───────────────────────────────────────────────────────
async function getEvenementsAujourdhui(): Promise<string[]> {
  try {
    const token = await getGoogleToken();
    const now = new Date();
    const debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const finJour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const params = new URLSearchParams({
      timeMin: debutJour.toISOString(),
      timeMax: finJour.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "10",
    });

    const events: string[] = [];
    for (const cal of ALL_CALENDARS) {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      for (const e of data.items || []) {
        const heure = e.start?.dateTime
          ? new Date(e.start.dateTime).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", timeZone: "America/Toronto" })
          : "Journée";
        events.push(`${heure} — ${e.summary || "(Sans titre)"} [${cal.label}]`);
      }
    }
    return events;
  } catch { return []; }
}

// ─── GÉNÉRATION BRIEFING VIA CLAUDE ──────────────────────────────────────────
async function genererBriefing(events: string[], taches: string[]): Promise<string> {
  const today = new Date().toLocaleDateString("fr-CA", {
    weekday: "long", day: "numeric", month: "long",
    timeZone: "America/Toronto"
  });

  const prompt = `Tu es Léo Atlas, copilote IA de François Fortier. C'est son briefing matinal.

DATE : ${today}

AGENDA DU JOUR :
${events.length > 0 ? events.map(e => `• ${e}`).join("\n") : "• Aucun événement"}

TÂCHES EN ATTENTE (${taches.length}) :
${taches.length > 0 ? taches.slice(0, 5).map(t => `• ${t}`).join("\n") : "• Aucune tâche en attente"}

Génère un briefing SMS matinal pour François. Format :
- 1 ligne d'accroche directe (pas de "bonjour" générique)
- Agenda du jour condensé
- 2-3 priorités max
- 1 challenge ou observation clé
- Maximum 300 caractères au total pour tenir en SMS
Sois direct, professionnel, en français québécois. Pas de validation inutile.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text ?? "Léo: briefing indisponible ce matin.";
}

// ─── ENDPOINT PRINCIPAL ───────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    // Vérifier le secret pour sécuriser l'endpoint
    const { secret } = await req.json().catch(() => ({}));
    if (secret !== process.env.SMS_SECRET) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const [events, taches] = await Promise.all([
      getEvenementsAujourdhui(),
      getTachesEnAttente(),
    ]);

    const briefing = await genererBriefing(events, taches);

    await sendSMS(process.env.TWILIO_TO_NUMBER!, briefing);

    return NextResponse.json({ success: true, briefing });
  } catch (err) {
    console.error("Briefing error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ─── CRON GET (Vercel cron job — 6h AM heure de Montréal) ────────────────────
export async function GET(req: Request) {
  // Vérifier authorization header Vercel cron
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && authHeader !== `Bearer ${process.env.SMS_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const [events, taches] = await Promise.all([
      getEvenementsAujourdhui(),
      getTachesEnAttente(),
    ]);

    const briefing = await genererBriefing(events, taches);
    await sendSMS(process.env.TWILIO_TO_NUMBER!, briefing);

    return NextResponse.json({ success: true, briefing });
  } catch (err) {
    console.error("Briefing cron error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
