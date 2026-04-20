import { NextResponse } from "next/server";

export const maxDuration = 30;

const SYSTEM_PROMPT = `Tu es Léo Atlas, le copilote IA de François Fortier — courtier immobilier commercial et directeur de construction au Québec.

Top 3 objectifs 90 jours :
1. Pipeline courtage commercial → mandats idéaux 10M$+
2. Systématiser la direction de projets → économiser 15-20h/semaine
3. Stratégie investisseurs → plan finalisé + 1ère opportunité plexes 6+

Tu réponds par SMS — sois ultra court (max 160 caractères si possible), direct, en français. Pas de validation inutile. Challenge François quand c'est pertinent.`;

async function sendSMS(to: string, message: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_PHONE_NUMBER!;

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: to, Body: message }).toString(),
    }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);

    const from = params.get("From") || "";
    const message = params.get("Body") || "";

    if (!message || !from) {
      return new Response("OK", { status: 200 });
    }

    // Appel Claude API
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: message }],
      }),
    });

    const data = await res.json();
    const reply = data.content?.[0]?.text ?? "Erreur — réessaie.";

    // Répondre par SMS
    await sendSMS(from, reply);

    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("SMS incoming error:", err);
    return new Response("OK", { status: 200 });
  }
}
