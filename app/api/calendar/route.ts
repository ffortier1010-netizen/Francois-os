import { NextResponse } from "next/server";
import { createSign } from "crypto";

export const maxDuration = 30;

// ─── AUTH GOOGLE ──────────────────────────────────────────────────────────────
async function getGoogleToken(): Promise<string> {
  const creds = JSON.parse(Buffer.from(process.env.GOOGLE_DRIVE_CREDENTIALS!, "base64").toString());
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: creds.client_email,
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/drive",
    ].join(" "),
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

const ALL_CALENDARS = [
  { id: "francois.fortier@spacia.ca", label: "Spacia" },
  { id: "f.fortier1010@gmail.com", label: "Personnel" },
  { id: "francois.fortier@remax-quebec.com", label: "RE/MAX" },
];

// ─── LISTER ÉVÉNEMENTS ────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const calendarId = searchParams.get("calendarId"); // si null → tous les calendriers
    const days = parseInt(searchParams.get("days") || "14");

    const token = await getGoogleToken();
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
    });

    const calendarsToFetch = calendarId
      ? [{ id: calendarId, label: calendarId }]
      : ALL_CALENDARS;

    const allEvents = (await Promise.allSettled(
      calendarsToFetch.map(async (cal) => {
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${params}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        return (data.items || []).map((e: {
          id: string;
          summary?: string;
          description?: string;
          location?: string;
          start?: { dateTime?: string; date?: string };
          end?: { dateTime?: string; date?: string };
          status?: string;
        }) => ({
          id: `${cal.id}::${e.id}`,
          titre: e.summary || "(Sans titre)",
          description: e.description || "",
          lieu: e.location || "",
          debut: e.start?.dateTime || e.start?.date || "",
          fin: e.end?.dateTime || e.end?.date || "",
          toutJournee: !e.start?.dateTime,
          statut: e.status,
          calendrier: cal.label,
          calendarId: cal.id,
        }));
      })
    ))
      .filter(r => r.status === "fulfilled")
      .flatMap(r => (r as PromiseFulfilledResult<unknown[]>).value);

    // Trier par date
    allEvents.sort((a: unknown, b: unknown) => {
      const ea = a as { debut: string };
      const eb = b as { debut: string };
      return ea.debut.localeCompare(eb.debut);
    });

    return NextResponse.json({ events: allEvents });
  } catch (err) {
    console.error("Calendar GET error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ─── CRÉER ÉVÉNEMENT ──────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { titre, debut, fin, description, lieu, calendarId = "primary", toutJournee } = body;

    if (!titre || !debut) {
      return NextResponse.json({ error: "Titre et date de début requis" }, { status: 400 });
    }

    const token = await getGoogleToken();

    const event: Record<string, unknown> = {
      summary: titre,
      description: description || "",
      location: lieu || "",
    };

    if (toutJournee) {
      event.start = { date: debut };
      event.end = { date: fin || debut };
    } else {
      event.start = { dateTime: debut, timeZone: "America/Toronto" };
      event.end = { dateTime: fin || new Date(new Date(debut).getTime() + 60 * 60 * 1000).toISOString(), timeZone: "America/Toronto" };
    }

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(event),
      }
    );
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || "Erreur création" }, { status: res.status });
    }

    return NextResponse.json({ success: true, eventId: data.id, lien: data.htmlLink });
  } catch (err) {
    console.error("Calendar POST error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ─── SUPPRIMER ÉVÉNEMENT ──────────────────────────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");
    const calendarId = searchParams.get("calendarId") || "primary";

    if (!eventId) return NextResponse.json({ error: "eventId requis" }, { status: 400 });

    const token = await getGoogleToken();
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Calendar DELETE error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ─── MODIFIER ÉVÉNEMENT ───────────────────────────────────────────────────────
export async function PATCH(req: Request) {
  try {
    const { eventId, calendarId = "primary", updates } = await req.json();
    if (!eventId) return NextResponse.json({ error: "eventId requis" }, { status: 400 });

    const token = await getGoogleToken();
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }
    );
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.error?.message }, { status: res.status });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Calendar PATCH error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
