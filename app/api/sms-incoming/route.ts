import { createSign } from "crypto";

export const maxDuration = 30;

const SYSTEM_PROMPT = `Tu es Léo Atlas, le copilote IA de François Fortier — courtier immobilier commercial et directeur de construction au Québec.

Top 3 objectifs 90 jours :
1. Pipeline courtage commercial → mandats idéaux 10M$+
2. Systématiser la direction de projets → économiser 15-20h/semaine
3. Stratégie investisseurs → plan finalisé + 1ère opportunité plexes 6+

Agents disponibles : [BROKER PRO], [CONSTRUCTION OPS], [INVEST ANALYZER], [STRATÈGE 90J], [FAMILY HQ], [BODY & PERFORMANCE], [DOCUMENT MASTER].

Tu réponds par SMS — sois ultra court (max 160 caractères si possible), direct, en français. Pas de validation inutile. Challenge François quand c'est pertinent.`;

async function classifyIntent(message: string, contacts: Record<string, string>): Promise<"proxy_sms" | "document" | "chat"> {
  const contactNames = Object.keys(contacts).join(", ");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      system: `Classifie ce message en UN seul mot parmi : proxy_sms, document, chat.
- proxy_sms : François veut envoyer un SMS à quelqu'un (contacts disponibles: ${contactNames})
- document : François veut récupérer un fichier ou document
- chat : conversation générale, question, conseil
Réponds UNIQUEMENT avec le mot exact : proxy_sms, document, ou chat.`,
      messages: [{ role: "user", content: message }],
    }),
  });
  const data = await res.json();
  const intent = data.content?.[0]?.text?.trim().toLowerCase();
  if (intent === "proxy_sms") return "proxy_sms";
  if (intent === "document") return "document";
  return "chat";
}

function getContacts(): Record<string, string> {
  try {
    return JSON.parse(process.env.LEO_CONTACTS || "{}");
  } catch {
    return {};
  }
}

function findContact(message: string, contacts: Record<string, string>): { name: string; number: string } | null {
  const lower = message.toLowerCase();
  for (const [name, number] of Object.entries(contacts)) {
    if (lower.includes(name.toLowerCase())) {
      return { name, number };
    }
  }
  return null;
}

async function composeProxyMessage(originalRequest: string, recipientName: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 160,
      system: `Tu es Léo Atlas, le copilote de François Fortier. François te demande d'envoyer un message de sa part à ${recipientName}.
Compose un SMS court, naturel et professionnel de la part de François.
Commence directement par le message — pas de "Bonjour je suis Léo".
Signe "— François" à la fin. Max 140 caractères.`,
      messages: [{ role: "user", content: originalRequest }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

async function getGoogleAccessToken(creds: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })).toString("base64url");

  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(creds.private_key, "base64url");
  const jwt = `${header}.${payload}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });

  const data = await res.json();
  return data.access_token || JSON.stringify(data);
}

async function searchGoogleDrive(query: string): Promise<{ name: string; link: string }[]> {
  const credsB64 = process.env.GOOGLE_DRIVE_CREDENTIALS!;
  const creds = JSON.parse(Buffer.from(credsB64, "base64").toString());
  const token = await getGoogleAccessToken(creds);

  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !DOC_KEYWORDS.includes(w));
  const searchTerms = words.slice(0, 3);

  const q = searchTerms.length > 0
    ? searchTerms.map(w => `name contains '${w}'`).join(" and ") + " and trashed=false and mimeType!='application/vnd.google-apps.folder'"
    : `trashed=false and mimeType!='application/vnd.google-apps.folder'`;

  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)&orderBy=modifiedTime+desc&pageSize=5`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  const files = data.files || [];

  for (const file of files) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    }).catch(() => {});
  }

  return files.map((f: { name: string; webViewLink: string }) => ({ name: f.name, link: f.webViewLink }));
}

async function sendSMS(to: string, message: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_PHONE_NUMBER!;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: from, To: to, Body: message }).toString(),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);
    const from = params.get("From") || "";
    const message = params.get("Body") || "";

    if (!message || !from) return new Response("OK", { status: 200 });

    const contacts = getContacts();
    const intent = await classifyIntent(message, contacts);

    // 1. Demande d'envoi SMS à un contact ?
    if (intent === "proxy_sms") {
      const contact = findContact(message, contacts);

      if (!contact) {
        await sendSMS(from, "Contact introuvable. Contacts disponibles : " + Object.keys(contacts).join(", "));
      } else {
        const composed = await composeProxyMessage(message, contact.name);
        if (composed) {
          await sendSMS(contact.number, composed);
          await sendSMS(from, `✓ SMS envoyé à ${contact.name}:\n"${composed}"`);
        } else {
          await sendSMS(from, "Erreur lors de la rédaction du message.");
        }
      }
      return new Response("OK", { status: 200 });
    }

    // 2. Demande de document ?
    if (intent === "document") {
      try {
        const files = await searchGoogleDrive(message);
        if (files.length === 0) {
          await sendSMS(from, "Aucun document trouvé. Précise le nom ou le type de fichier.");
        } else if (files.length === 1) {
          await sendSMS(from, `📄 ${files[0].name}\n${files[0].link}`);
        } else {
          const list = files.slice(0, 3).map((f: { name: string; link: string }, i: number) => `${i + 1}. ${f.name}\n${f.link}`).join("\n\n");
          await sendSMS(from, `📁 ${files.length} docs:\n\n${list}`);
        }
      } catch (err) {
        console.error("Drive error:", err);
        await sendSMS(from, "Erreur Drive. Réessaie dans un instant.");
      }
      return new Response("OK", { status: 200 });
    }

    // 3. Chat Léo Atlas standard
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
    await sendSMS(from, reply);

    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("SMS incoming error:", err);
    return new Response("OK", { status: 200 });
  }
}
