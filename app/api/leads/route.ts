import { NextResponse } from "next/server";

async function redisCommand(command: unknown[]) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const res = await fetch(`${url}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  return data.result;
}

async function sendSMSNotification(lead: Record<string, string>) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_PHONE_NUMBER!;
  const to = "+15146215162"; // Numéro de François

  const message = `🔥 NOUVEAU LEAD — ${lead.prenom} ${lead.nom}
Type : ${lead.type}
${lead.propriete ? `Bien : ${lead.propriete}` : ""}
📞 ${lead.telephone}
📧 ${lead.email}
Source : ${lead.source}`;

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: from, To: to, Body: message }).toString(),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prenom, nom, email, telephone, type, propriete, valeur, message, source } = body;

    if (!nom || !telephone) {
      return NextResponse.json({ error: "Nom et téléphone requis" }, { status: 400 });
    }

    const lead = {
      id: Date.now().toString(),
      prenom: prenom || "",
      nom,
      email: email || "",
      telephone,
      type: type || "autre",
      propriete: propriete || "",
      valeur: valeur || "",
      message: message || "",
      source: source || "formulaire",
      statut: "nouveau",
      notes: "",
      createdAt: new Date().toISOString(),
      lastContact: "",
      prochainSuivi: "",
    };

    // Charger leads existants
    const raw = await redisCommand(["GET", "fortier_leads"]);
    const leads = raw ? JSON.parse(raw) : [];
    leads.unshift(lead);
    await redisCommand(["SET", "fortier_leads", JSON.stringify(leads)]);

    // Notification SMS à François
    await sendSMSNotification(lead);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Lead error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const raw = await redisCommand(["GET", "fortier_leads"]);
    const leads = raw ? JSON.parse(raw) : [];
    return NextResponse.json({ leads });
  } catch {
    return NextResponse.json({ leads: [] });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, updates } = await req.json();
    const raw = await redisCommand(["GET", "fortier_leads"]);
    const leads = raw ? JSON.parse(raw) : [];
    const idx = leads.findIndex((l: { id: string }) => l.id === id);
    if (idx >= 0) {
      leads[idx] = { ...leads[idx], ...updates };
      await redisCommand(["SET", "fortier_leads", JSON.stringify(leads)]);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
