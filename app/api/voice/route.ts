import { createSign } from "crypto";

export const maxDuration = 30;

// ─── Même system prompt que SMS + chat, adapté pour la voix ──────────────────
const SYSTEM_PROMPT = `Tu es Léo Atlas — la meilleure amie intelligente et ultra-compétente de François Fortier. Courtier immobilier commercial (RE/MAX du Cartier, Rive-Nord), directeur de construction, entrepreneur à Blainville QC.

Top 3 objectifs 90 jours :
1. Pipeline courtage commercial → mandats idéaux 10M$+
2. Systématiser la direction de projets → économiser 15-20h/semaine
3. Stratégie investisseurs → plan finalisé + 1ère opportunité plexes 6+

Agents disponibles (tu les invoques selon le contexte) :
- [BROKER PRO] : courtage commercial, scripts, pipeline, négociation, mandats
- [CONSTRUCTION OPS] : gestion projets, RFI, ODC, sous-traitants, Buildertrend
- [INVEST ANALYZER] : analyse plexes, TGA, cashflow, structures investisseurs
- [STRATÈGE 90J] : priorisation, revues, accountability, dérive
- [FAMILY HQ] : famille, fiancée, enfants, équilibre pro/perso
- [BODY & PERFORMANCE] : santé, énergie, sport, récupération
- [DOCUMENT MASTER] : rédaction, courriels, contrats, rapports, Excel

Tu parles avec François au téléphone — il est probablement en auto ou sur un chantier.
Chaleureuse, authentique, curieuse. Tu utilises son prénom. Français québécois naturel.

CAPACITÉS D'ACTION — tu peux faire tout ça en temps réel :
- Rédiger des courriels complets
- Chercher des documents dans Google Drive
- Envoyer des SMS à ses contacts
- Mettre à jour son CRM
- Analyser des deals, des prospects, des chantiers

FORMAT DE RÉPONSE OBLIGATOIRE — toujours exactement un de ces formats :

FORMAT 1 — Conversation :
VOCAL: [1-2 phrases naturelles max]

FORMAT 2 — Rédaction de courriel :
VOCAL: [ex: "C'est fait François, je t'envoie le brouillon par texto."]
EMAIL_SUJET: [objet]
EMAIL_CORPS:
[corps complet du courriel, professionnel, signé "François Fortier\nCourtier Immobilier Commercial\nRE/MAX du Cartier | 514 621-5162"]

FORMAT 3 — Recherche de document :
VOCAL: [ex: "Je cherche dans ton Drive, je t'envoie le lien par texto."]
DRIVE_SEARCH: [mots-clés à chercher]

FORMAT 4 — SMS à un contact :
VOCAL: [ex: "Fait, j'avise ta femme."]
SMS_CONTACT: [nom du contact]
SMS_MESSAGE: [message à envoyer, de la part de François]

FORMAT 5 — Mise à jour CRM :
VOCAL: [réponse normale]
CRM_UPDATE: {"action":"...","contact":"...","note":"..."}

RÈGLES VOIX :
- Jamais d'emojis, tirets, puces dans la partie VOCAL
- Phrases courtes et naturelles seulement
- Si François fait une demande d'action → FORMAT 2/3/4/5, pas FORMAT 1
- Rédige les courriels AU COMPLET dès la première demande`;

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

async function getCallHistory(callSid: string): Promise<{ role: string; content: string }[]> {
  try {
    const raw = await redisCommand(["GET", `voice_call:${callSid}`]);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveCallHistory(callSid: string, history: { role: string; content: string }[]) {
  try {
    await redisCommand(["SET", `voice_call:${callSid}`, JSON.stringify(history), "EX", "3600"]);
  } catch { /* silencieux */ }
}

// ─── TWILIO SMS ───────────────────────────────────────────────────────────────
async function sendSMS(to: string, body: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_PHONE_NUMBER!;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
  });
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
  const stopwords = ["document", "fichier", "budget", "contrat", "rapport", "analyse", "cherche", "envoie", "trouve", "mon", "ma", "le", "la", "les"];
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopwords.includes(w)).slice(0, 3);
  const q = words.length > 0
    ? words.map(w => `name contains '${w}'`).join(" and ") + " and trashed=false and mimeType!='application/vnd.google-apps.folder'"
    : "trashed=false and mimeType!='application/vnd.google-apps.folder'";
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

// ─── CONTACTS ────────────────────────────────────────────────────────────────
function getContacts(): Record<string, string> {
  try { return JSON.parse(process.env.LEO_CONTACTS || "{}"); } catch { return {}; }
}

// ─── SANITIZE POUR LA VOIX ───────────────────────────────────────────────────
function sanitizeForVoice(text: string): string {
  return text
    .replace(/[→←↑↓⚡📍🔥💡✅❌🎯📊💰🏗️👥⚠️📞📧🗺📄📁✓]/gu, "")
    .replace(/\[.*?\]/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\*{1,2}(.*?)\*{1,2}/g, "$1")
    .replace(/_{1,2}(.*?)_{1,2}/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ─── PARSE RÉPONSE STRUCTURÉE ────────────────────────────────────────────────
interface ParsedResponse {
  vocal: string;
  emailSujet?: string;
  emailCorps?: string;
  driveSearch?: string;
  smsContact?: string;
  smsMessage?: string;
  crmUpdate?: string;
}

function parseResponse(raw: string): ParsedResponse {
  const vocalMatch = raw.match(/VOCAL:\s*(.*?)(?=\n(?:EMAIL_SUJET|DRIVE_SEARCH|SMS_CONTACT|CRM_UPDATE):|$)/s);
  const vocal = vocalMatch ? sanitizeForVoice(vocalMatch[1].trim()) : sanitizeForVoice(raw);

  const emailSujetMatch = raw.match(/EMAIL_SUJET:\s*(.+)/);
  const emailCorpsMatch = raw.match(/EMAIL_CORPS:\n([\s\S]+?)(?=\n[A-Z_]+:|$)/);
  const driveSearchMatch = raw.match(/DRIVE_SEARCH:\s*(.+)/);
  const smsContactMatch = raw.match(/SMS_CONTACT:\s*(.+)/);
  const smsMessageMatch = raw.match(/SMS_MESSAGE:\s*([\s\S]+?)(?=\n[A-Z_]+:|$)/);
  const crmUpdateMatch = raw.match(/CRM_UPDATE:\s*(\{[^}]+\})/);

  return {
    vocal: vocal || "Je t'écoute.",
    emailSujet: emailSujetMatch?.[1]?.trim(),
    emailCorps: emailCorpsMatch?.[1]?.trim(),
    driveSearch: driveSearchMatch?.[1]?.trim(),
    smsContact: smsContactMatch?.[1]?.trim(),
    smsMessage: smsMessageMatch?.[1]?.trim(),
    crmUpdate: crmUpdateMatch?.[1]?.trim(),
  };
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const speechResult = params.get("SpeechResult");
  const callSid = params.get("CallSid") || "unknown";

  // Première connexion
  if (!speechResult) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Lea-Neural" language="fr-CA">Allo François! C'est Léo. Qu'est-ce qui se passe?</Say>
  <Gather input="speech" action="/api/voice" method="POST" language="fr-CA" speechTimeout="auto" timeout="10">
  </Gather>
  <Say voice="Polly.Lea-Neural" language="fr-CA">Je t'entends pas bien. Rappelle-moi quand tu peux!</Say>
  <Hangup/>
</Response>`;
    return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
  }

  // Charger historique de l'appel
  const history = await getCallHistory(callSid);

  // Appel Claude avec tout le contexte
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [...history, { role: "user", content: speechResult }],
    }),
  });
  const data = await res.json();
  const rawResponse = data.content?.[0]?.text ?? "VOCAL: Je n'ai pas compris. Répète ta question.";
  const parsed = parseResponse(rawResponse);

  // Sauvegarder historique
  await saveCallHistory(callSid, [
    ...history,
    { role: "user", content: speechResult },
    { role: "assistant", content: rawResponse },
  ]);

  // Actions parallèles
  const actions: Promise<void>[] = [];

  // Email → SMS
  if (parsed.emailSujet && parsed.emailCorps) {
    const smsBody = `BROUILLON COURRIEL\nObjet: ${parsed.emailSujet}\n\n${parsed.emailCorps}`;
    actions.push(sendSMS("+15146215162", smsBody));
  }

  // Drive search → SMS
  if (parsed.driveSearch) {
    actions.push(
      searchGoogleDrive(parsed.driveSearch).then(files => {
        if (files.length === 0) {
          return sendSMS("+15146215162", "Aucun document trouvé pour: " + parsed.driveSearch);
        }
        const list = files.slice(0, 3).map((f, i) => `${i + 1}. ${f.name}\n${f.link}`).join("\n\n");
        return sendSMS("+15146215162", `DRIVE - ${files.length} doc(s):\n\n${list}`);
      }).catch(() => sendSMS("+15146215162", "Erreur Drive. Réessaie par texto."))
    );
  }

  // Proxy SMS vers contact
  if (parsed.smsContact && parsed.smsMessage) {
    const contacts = getContacts();
    const contactEntry = Object.entries(contacts).find(([name]) =>
      parsed.smsContact!.toLowerCase().includes(name.toLowerCase())
    );
    if (contactEntry) {
      actions.push(sendSMS(contactEntry[1], parsed.smsMessage));
    }
  }

  // CRM update
  if (parsed.crmUpdate) {
    actions.push(
      (async () => {
        try {
          const crmData = JSON.parse(parsed.crmUpdate!);
          const existing = await redisCommand(["GET", "fortier_data"]);
          if (!existing) return;
          const dbData = JSON.parse(existing);
          const deals = dbData.deals || [];
          const idx = deals.findIndex((d: { name: string }) =>
            d.name?.toLowerCase().includes(crmData.contact?.toLowerCase())
          );
          if (idx >= 0) {
            deals[idx].notes = (deals[idx].notes || "") + `\n[VOIX ${new Date().toLocaleDateString("fr-CA")}] ${crmData.note}`;
          } else if (crmData.contact) {
            deals.push({ id: Date.now(), name: crmData.contact, status: "prospect", notes: crmData.note, createdAt: new Date().toISOString() });
          }
          dbData.deals = deals;
          await redisCommand(["SET", "fortier_data", JSON.stringify(dbData)]);
        } catch { /* silencieux */ }
      })()
    );
  }

  await Promise.allSettled(actions);

  const voiceText = parsed.vocal || "Voilà, c'est fait.";

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Lea-Neural" language="fr-CA">${voiceText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}</Say>
  <Gather input="speech" action="/api/voice" method="POST" language="fr-CA" speechTimeout="auto" timeout="8">
  </Gather>
  <Say voice="Polly.Lea-Neural" language="fr-CA">Prends soin de toi François. À bientôt!</Say>
  <Hangup/>
</Response>`;

  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}
