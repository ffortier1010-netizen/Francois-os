import { createSign } from "crypto";

export const maxDuration = 30;

const SYSTEM_PROMPT = `Tu es Léo Atlas, le copilote IA de François Fortier — courtier immobilier commercial et directeur de construction au Québec.

Top 3 objectifs 90 jours :
1. Pipeline courtage commercial → mandats idéaux 10M$+
2. Systématiser la direction de projets → économiser 15-20h/semaine
3. Stratégie investisseurs → plan finalisé + 1ère opportunité plexes 6+

Agents disponibles : [BROKER PRO], [CONSTRUCTION OPS], [INVEST ANALYZER], [STRATÈGE 90J], [FAMILY HQ], [BODY & PERFORMANCE], [DOCUMENT MASTER].

Tu te souviens des échanges précédents dans cette conversation.
Tu réponds par SMS — sois ultra court (max 160 caractères si possible), direct, en français. Pas de validation inutile. Challenge François quand c'est pertinent.

CRM : Si François mentionne un prospect, un client, une propriété ou une rencontre, détecte-le et inclus à la fin de ta réponse une ligne CRM_UPDATE: {action, contact, note} en JSON compact.`;

// ─── REDIS ────────────────────────────────────────────────────────────────────
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

async function getConversationHistory(phone: string): Promise<{ role: string; content: string }[]> {
  try {
    const key = `sms_history:${phone}`;
    const raw = await redisCommand(["GET", key]);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveConversationHistory(phone: string, history: { role: string; content: string }[]) {
  try {
    const key = `sms_history:${phone}`;
    const trimmed = history.slice(-20); // garder les 20 derniers messages
    await redisCommand(["SET", key, JSON.stringify(trimmed), "EX", 86400]); // expire après 24h
  } catch { /* silently fail */ }
}

async function updateCRM(crmData: { action: string; contact: string; note: string }) {
  try {
    const existing = await redisCommand(["GET", "fortier_data"]);
    if (!existing) return;
    const data = JSON.parse(existing);

    // Chercher si le contact existe déjà dans le pipeline
    const deals = data.deals || [];
    const matchIndex = deals.findIndex((d: { name: string }) =>
      d.name?.toLowerCase().includes(crmData.contact?.toLowerCase())
    );

    if (matchIndex >= 0) {
      deals[matchIndex].lastAction = crmData.action;
      deals[matchIndex].notes = (deals[matchIndex].notes || "") + `\n[SMS ${new Date().toLocaleDateString("fr-CA")}] ${crmData.note}`;
    } else if (crmData.action === "nouveau_prospect" && crmData.contact) {
      deals.push({
        id: Date.now(),
        name: crmData.contact,
        status: "prospect",
        lastAction: crmData.action,
        notes: `[SMS ${new Date().toLocaleDateString("fr-CA")}] ${crmData.note}`,
        createdAt: new Date().toISOString(),
      });
    }

    data.deals = deals;
    await redisCommand(["SET", "fortier_data", JSON.stringify(data)]);
  } catch { /* silently fail */ }
}

// ─── GOOGLE DRIVE ─────────────────────────────────────────────────────────────
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
  const { createSign } = await import("crypto");
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(creds.private_key, "base64url");
  const jwt = `${header}.${payload}.${signature}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }).toString(),
  });
  const data = await res.json();
  return data.access_token;
}

async function searchGoogleDrive(query: string): Promise<{ name: string; link: string }[]> {
  const creds = JSON.parse(Buffer.from(process.env.GOOGLE_DRIVE_CREDENTIALS!, "base64").toString());
  const token = await getGoogleAccessToken(creds);
  const stopwords = ["document", "fichier", "budget", "contrat", "rapport", "analyse", "cherche", "envoie", "trouve"];
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopwords.includes(w)).slice(0, 3);
  const q = words.length > 0
    ? words.map(w => `name contains '${w}'`).join(" and ") + " and trashed=false and mimeType!='application/vnd.google-apps.folder'"
    : `trashed=false and mimeType!='application/vnd.google-apps.folder'`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)&orderBy=modifiedTime+desc&pageSize=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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

// ─── CONTACTS & PROXY SMS ────────────────────────────────────────────────────
function getContacts(): Record<string, string> {
  try { return JSON.parse(process.env.LEO_CONTACTS || "{}"); } catch { return {}; }
}

function findContact(message: string, contacts: Record<string, string>): { name: string; number: string } | null {
  const lower = message.toLowerCase();
  for (const [name, number] of Object.entries(contacts)) {
    if (lower.includes(name.toLowerCase())) return { name, number };
  }
  return null;
}

async function composeProxyMessage(originalRequest: string, recipientName: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 160,
      system: `Tu dois composer un SMS que François Fortier envoie à ${recipientName}.
Écris exactement comme François écrirait lui-même — pas comme un assistant IA.
- Si c'est sa femme/fiancée: ton chaleureux, intime, naturel
- Si c'est un client/collègue: ton professionnel mais humain
Commence directement par le message. Signe "François" à la fin. Max 140 caractères.
JAMAIS de formules d'assistant, JAMAIS de "Bien sûr", JAMAIS de ton corporatif.`,
      messages: [{ role: "user", content: originalRequest }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

// ─── INTENT CLASSIFICATION ────────────────────────────────────────────────────
async function classifyIntent(message: string, contacts: Record<string, string>): Promise<"proxy_sms" | "document" | "chat"> {
  const contactNames = Object.keys(contacts).join(", ");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      system: `Classifie ce message en UN seul mot : proxy_sms, document, ou chat.
- proxy_sms : envoyer un SMS à quelqu'un (contacts: ${contactNames})
- document : récupérer un fichier ou document
- chat : tout le reste
Réponds UNIQUEMENT avec : proxy_sms, document, ou chat.`,
      messages: [{ role: "user", content: message }],
    }),
  });
  const data = await res.json();
  const intent = data.content?.[0]?.text?.trim().toLowerCase();
  if (intent === "proxy_sms") return "proxy_sms";
  if (intent === "document") return "document";
  return "chat";
}

// ─── TWILIO SMS ───────────────────────────────────────────────────────────────
async function sendSMS(to: string, message: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_PHONE_NUMBER!;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: from, To: to, Body: message }).toString(),
  });
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);
    const from = params.get("From") || "";
    const message = params.get("Body") || "";

    if (!message || !from) return new Response("OK", { status: 200 });

    const FRANCOIS_NUMBER = "+15146215162";
    const contacts = getContacts();

    // Si le message vient d'un contact (pas de François) → forwarder à François sans répondre
    const isFromContact = Object.values(contacts).some(num => num === from);
    if (from !== FRANCOIS_NUMBER && isFromContact) {
      const contactName = Object.entries(contacts).find(([, num]) => num === from)?.[0] || from;
      await sendSMS(FRANCOIS_NUMBER, `📩 Réponse de ${contactName}:\n"${message}"`);
      return new Response("OK", { status: 200 });
    }

    // Si c'est un numéro inconnu → ignorer silencieusement
    if (from !== FRANCOIS_NUMBER) {
      return new Response("OK", { status: 200 });
    }

    const intent = await classifyIntent(message, contacts);

    // 1. Proxy SMS
    if (intent === "proxy_sms") {
      const contact = findContact(message, contacts);
      if (!contact) {
        await sendSMS(from, "Contact introuvable. Disponibles : " + Object.keys(contacts).join(", "));
      } else {
        const composed = await composeProxyMessage(message, contact.name);
        if (composed) {
          await sendSMS(contact.number, composed);
          await sendSMS(from, `✓ SMS envoyé à ${contact.name}:\n"${composed}"`);
        }
      }
      return new Response("OK", { status: 200 });
    }

    // 2. Document Drive
    if (intent === "document") {
      try {
        const files = await searchGoogleDrive(message);
        if (files.length === 0) {
          await sendSMS(from, "Aucun document trouvé. Précise le nom du fichier.");
        } else if (files.length === 1) {
          await sendSMS(from, `📄 ${files[0].name}\n${files[0].link}`);
        } else {
          const list = files.slice(0, 3).map((f: { name: string; link: string }, i: number) => `${i + 1}. ${f.name}\n${f.link}`).join("\n\n");
          await sendSMS(from, `📁 ${files.length} docs:\n\n${list}`);
        }
      } catch {
        await sendSMS(from, "Erreur Drive. Réessaie.");
      }
      return new Response("OK", { status: 200 });
    }

    // 3. Chat Léo Atlas avec mémoire
    const history = await getConversationHistory(from);
    history.push({ role: "user", content: message });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 250,
        system: SYSTEM_PROMPT,
        messages: history,
      }),
    });

    const data = await res.json();
    let reply = data.content?.[0]?.text ?? "Erreur — réessaie.";

    // Extraire et traiter les mises à jour CRM
    const crmMatch = reply.match(/CRM_UPDATE:\s*(\{[^}]+\})/);
    if (crmMatch) {
      try {
        const crmData = JSON.parse(crmMatch[1]);
        await updateCRM(crmData);
        reply = reply.replace(/CRM_UPDATE:\s*\{[^}]+\}/, "").trim();
      } catch { /* ignore */ }
    }

    // Sauvegarder l'historique
    history.push({ role: "assistant", content: reply });
    await saveConversationHistory(from, history);

    await sendSMS(from, reply);
    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("SMS error:", err);
    return new Response("OK", { status: 200 });
  }
}
