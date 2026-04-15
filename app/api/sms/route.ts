import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { message, secret } = await req.json();

    // Vérification du secret
    if (secret !== process.env.SMS_SECRET) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    if (!message) {
      return NextResponse.json({ error: "Message manquant" }, { status: 400 });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const from = process.env.TWILIO_PHONE_NUMBER!;
    const to = process.env.TWILIO_TO_NUMBER!;

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const res = await fetch(
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

    const data = await res.json();

    if (!res.ok) {
      console.error("Twilio error:", data);
      return NextResponse.json({ error: "Erreur Twilio" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sid: data.sid });

  } catch (err) {
    console.error("SMS error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
