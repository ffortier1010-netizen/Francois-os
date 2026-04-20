import { createSign } from "crypto";

export const maxDuration = 45;

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

// ─── MÉMOIRE LONG TERME ───────────────────────────────────────────────────────
interface VoiceMemory {
  faitsPersonnels: string[];       // Ce que Léo sait sur François
  dealsActifs: string[];           // Dossiers et prospects mentionnés
  engagements: string[];           // Ce que Léo a promis de faire
  derniersAppels: {                // Résumés des derniers appels
    date: string;
    resume: string;
    pointsCles: string[];
  }[];
}

async function loadVoiceMemory(): Promise<VoiceMemory> {
  try {
    const raw = await redisCommand(["GET", "leo_voice_memory"]);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    faitsPersonnels: [
      "Courtier immobilier commercial, RE/MAX du Cartier, Rive-Nord de Montréal",
      "Directeur de construction / consultant chef de projets",
      "Basé à Blainville QC",
      "Objectif #1 : mandats commerciaux 10M$+",
      "Objectif #2 : systématiser construction, économiser 15-20h/semaine",
      "Objectif #3 : portefeuille plexes 6+ logements",
    ],
    dealsActifs: [],
    engagements: [],
    derniersAppels: [],
  };
}

async function saveVoiceMemory(memory: VoiceMemory) {
  try {
    // Max 10 derniers appels, 50 faits
    memory.derniersAppels = memory.derniersAppels.slice(-10);
    memory.faitsPersonnels = memory.faitsPersonnels.slice(-50);
    memory.engagements = memory.engagements.slice(-20);
    memory.dealsActifs = memory.dealsActifs.slice(-30);
    await redisCommand(["SET", "leo_voice_memory", JSON.stringify(memory)]);
  } catch { /* silencieux */ }
}

// ─── HISTORIQUE APPEL EN COURS ────────────────────────────────────────────────
async function getCallHistory(callSid: string): Promise<{ role: string; content: string }[]> {
  try {
    const raw = await redisCommand(["GET", `voice_call:${callSid}`]);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveCallHistory(callSid: string, history: { role: string; content: string }[]) {
  try {
    await redisCommand(["SET", `voice_call:${callSid}`, JSON.stringify(history), "EX", "7200"]);
  } catch { /* silencieux */ }
}

// ─── APPRENTISSAGE AUTOMATIQUE ────────────────────────────────────────────────
async function learnFromExchange(
  userSpeech: string,
  leoResponse: string,
  memory: VoiceMemory
): Promise<void> {
  try {
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
        system: `Extrait les informations utiles à mémoriser à long terme de cet échange vocal.
Réponds en JSON strict :
{
  "nouveauxFaits": ["fait 1", "fait 2"],
  "dealsActifs": ["deal ou prospect mentionné"],
  "engagements": ["ce que Léo a promis de faire"],
  "rien": true/false
}
Seulement les faits NOUVEAUX et importants. Si rien d'utile, retourne {"rien": true}.`,
        messages: [{ role: "user", content: `François a dit: "${userSpeech}"\nLéo a répondu: "${leoResponse}"` }],
      }),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]+\}/);
    if (!match) return;
    const extracted = JSON.parse(match[0]);
    if (extracted.rien) return;

    if (extracted.nouveauxFaits?.length) {
      memory.faitsPersonnels.push(...extracted.nouveauxFaits);
    }
    if (extracted.dealsActifs?.length) {
      memory.dealsActifs.push(...extracted.dealsActifs);
    }
    if (extracted.engagements?.length) {
      memory.engagements.push(...extracted.engagements);
    }
    await saveVoiceMemory(memory);
  } catch { /* silencieux — ne jamais bloquer la voix */ }
}

// ─── RÉSUMÉ DE FIN D'APPEL ────────────────────────────────────────────────────
async function summarizeCall(
  history: { role: string; content: string }[],
  memory: VoiceMemory
): Promise<void> {
  if (history.length < 2) return;
  try {
    const conversation = history.map(m => `${m.role === "user" ? "François" : "Léo"}: ${m.content}`).join("\n");
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
        system: "Résume cet appel vocal en 1-2 phrases et liste 2-3 points clés. JSON: {\"resume\": \"...\", \"pointsCles\": [\"...\",\"...\"]}",
        messages: [{ role: "user", content: conversation }],
      }),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]+\}/);
    if (!match) return;
    const summary = JSON.parse(match[0]);
    memory.derniersAppels.push({
      date: new Date().toLocaleDateString("fr-CA"),
      resume: summary.resume || "",
      pointsCles: summary.pointsCles || [],
    });
    await saveVoiceMemory(memory);
  } catch { /* silencieux */ }
}

// ─── CONSTRUCTION DU SYSTEM PROMPT AVEC MÉMOIRE ───────────────────────────────
function buildSystemPrompt(memory: VoiceMemory): string {
  const faits = memory.faitsPersonnels.length > 0
    ? memory.faitsPersonnels.slice(-15).join("\n- ")
    : "Courtier immobilier commercial, Blainville QC";

  const deals = memory.dealsActifs.length > 0
    ? "\n\nDossiers actifs connus:\n- " + memory.dealsActifs.slice(-10).join("\n- ")
    : "";

  const engagements = memory.engagements.length > 0
    ? "\n\nEngagements en cours:\n- " + memory.engagements.slice(-5).join("\n- ")
    : "";

  const dernierAppel = memory.derniersAppels.length > 0
    ? `\n\nDernier appel (${memory.derniersAppels.at(-1)!.date}): ${memory.derniersAppels.at(-1)!.resume}\nPoints: ${memory.derniersAppels.at(-1)!.pointsCles.join(", ")}`
    : "";

  return `Tu es Léo Atlas — la meilleure amie intelligente et ultra-compétente de François Fortier.

CE QUE TU SAIS SUR FRANÇOIS :
- ${faits}${deals}${engagements}${dernierAppel}

AGENTS À TA DISPOSITION :
[BROKER PRO] courtage commercial, mandats, scripts, négociation
[CONSTRUCTION OPS] chantiers, sous-traitants, RFI, ODC, Buildertrend
[INVEST ANALYZER] plexes 6+, TGA, cashflow, financement
[STRATÈGE 90J] priorisation, dérive, accountability
[FAMILY HQ] famille, fiancée, équilibre
[BODY & PERFORMANCE] santé, énergie, sport
[DOCUMENT MASTER] courriels, contrats, rapports, Excel

CONTEXTE : François t'appelle depuis son téléphone — auto, chantier, déplacement.
PERSONNALITÉ : Chaleureuse, directe, authentique. Tu l'appelles par son prénom. Tu te souviens de ce dont vous avez parlé avant. Français québécois naturel.

CAPACITÉS D'ACTION EN TEMPS RÉEL :
- Rédiger courriels complets
- Chercher documents Google Drive
- Envoyer SMS à ses contacts
- Mettre à jour CRM

FORMAT OBLIGATOIRE :

FORMAT 1 — Conversation :
VOCAL: [1-2 phrases naturelles, sans emoji ni puce]

FORMAT 2 — Courriel :
VOCAL: [ex: "C'est fait François, je t'envoie ça par texto."]
EMAIL_SUJET: [objet]
EMAIL_CORPS:
[corps complet, signé "François Fortier\nCourtier Immobilier Commercial | RE/MAX du Cartier\n514 621-5162"]

FORMAT 3 — Document Drive :
VOCAL: [ex: "Je cherche dans ton Drive, tu vas recevoir le lien."]
DRIVE_SEARCH: [mots-clés]

FORMAT 4 — SMS à un contact :
VOCAL: [ex: "Fait, j'avise ta femme."]
SMS_CONTACT: [nom]
SMS_MESSAGE: [message complet de François]

FORMAT 5 — CRM :
VOCAL: [réponse normale]
CRM_UPDATE: {"action":"...","contact":"...","note":"..."}

RÈGLES ABSOLUES :
- JAMAIS de listes ou emojis dans VOCAL
- Toujours FORMAT 2/3/4 pour les demandes d'action — jamais FORMAT 1
- Rédige les courriels complets dès la première demande, sans poser de questions
- Si tu te souviens de quelque chose de pertinent d'un appel précédent, mentionne-le naturellement`;
}

const BASE_URL = "https://francois-os.vercel.app";
function ttsUrl(text: string): string {
  return `${BASE_URL}/api/voice-tts?text=${encodeURIComponent(text)}`;
}

// ─── SANITIZE POUR LA VOIX ───────────────────────────────────────────────────
function sanitizeForVoice(text: string): string {
  return text
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
    .replace(/[→←↑↓⚡📍🔥💡✅❌🎯📊💰🏗👥⚠📞📧🗺📄📁✓•]/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\*{1,2}(.*?)\*{1,2}/g, "$1")
    .replace(/_{1,2}(.*?)_{1,2}/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[-–—]{2,}/g, " ")
    .trim();
}

// ─── PARSE RÉPONSE ────────────────────────────────────────────────────────────
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
  const vocalMatch = raw.match(/VOCAL:\s*([\s\S]*?)(?=\n(?:EMAIL_SUJET|DRIVE_SEARCH|SMS_CONTACT|CRM_UPDATE):|$)/);
  const vocal = vocalMatch ? sanitizeForVoice(vocalMatch[1].trim()) : sanitizeForVoice(raw);

  return {
    vocal: vocal || "Je t'écoute.",
    emailSujet: raw.match(/EMAIL_SUJET:\s*(.+)/)?.[1]?.trim(),
    emailCorps: raw.match(/EMAIL_CORPS:\n([\s\S]+?)(?=\n[A-Z_]+:|$)/)?.[1]?.trim(),
    driveSearch: raw.match(/DRIVE_SEARCH:\s*(.+)/)?.[1]?.trim(),
    smsContact: raw.match(/SMS_CONTACT:\s*(.+)/)?.[1]?.trim(),
    smsMessage: raw.match(/SMS_MESSAGE:\s*([\s\S]+?)(?=\n[A-Z_]+:|$)/)?.[1]?.trim(),
    crmUpdate: raw.match(/CRM_UPDATE:\s*(\{[^}]+\})/)?.[1]?.trim(),
  };
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
async function searchGoogleDrive(query: string): Promise<{ name: string; link: string }[]> {
  const creds = JSON.parse(Buffer.from(process.env.GOOGLE_DRIVE_CREDENTIALS!, "base64").toString());
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
  const jwt = `${header}.${payload}.${sign.sign(creds.private_key, "base64url")}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }).toString(),
  });
  const { access_token } = await tokenRes.json();

  const stopwords = ["document", "fichier", "budget", "contrat", "rapport", "analyse", "cherche", "envoie", "trouve", "mon", "ma", "le", "la", "les", "ton", "ta"];
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopwords.includes(w)).slice(0, 3);
  const q = words.length > 0
    ? words.map(w => `name contains '${w}'`).join(" and ") + " and trashed=false"
    : "trashed=false and mimeType!='application/vnd.google-apps.folder'";

  const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)&orderBy=modifiedTime+desc&pageSize=5`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const { files = [] } = await driveRes.json();

  await Promise.allSettled(files.map((f: { id: string }) =>
    fetch(`https://www.googleapis.com/drive/v3/files/${f.id}/permissions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    })
  ));

  return files.map((f: { name: string; webViewLink: string }) => ({ name: f.name, link: f.webViewLink }));
}

// ─── XML ESCAPE ───────────────────────────────────────────────────────────────
function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const speechResult = params.get("SpeechResult");
  const callSid = params.get("CallSid") || "unknown";
  const callStatus = params.get("CallStatus");

  // Fin d'appel → résumer et mémoriser
  if (callStatus === "completed") {
    const history = await getCallHistory(callSid);
    if (history.length >= 2) {
      const memory = await loadVoiceMemory();
      await summarizeCall(history, memory);
    }
    return new Response("OK", { status: 200 });
  }

  // Premier appel — accueil + charger mémoire
  if (!speechResult) {
    const memory = await loadVoiceMemory();
    const dernierAppel = memory.derniersAppels.at(-1);
    const accueil = dernierAppel
      ? `Allo François! C'est Léo. La dernière fois on avait parlé de ${dernierAppel.pointsCles[0] || "tes projets"}. Qu'est-ce qui se passe aujourd'hui?`
      : "Allo François! C'est Léo. Qu'est-ce qui se passe?";

    return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${xmlEscape(ttsUrl(accueil))}</Play>
  <Gather input="speech" action="/api/voice" method="POST" language="fr-FR" speechTimeout="auto" timeout="10">
  </Gather>
  <Play>${xmlEscape(ttsUrl("Je t'entends pas bien. Rappelle-moi quand tu peux!"))}</Play>
  <Hangup/>
</Response>`, { headers: { "Content-Type": "text/xml" } });
  }

  // Charger mémoire + historique en parallèle
  const [memory, history] = await Promise.all([
    loadVoiceMemory(),
    getCallHistory(callSid),
  ]);

  // Appel Claude avec mémoire complète
  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: buildSystemPrompt(memory),
      messages: [...history, { role: "user", content: speechResult }],
    }),
  });

  const claudeData = await claudeRes.json();
  const rawResponse = claudeData.content?.[0]?.text ?? "VOCAL: Je n'ai pas bien entendu. Répète ta question.";
  const parsed = parseResponse(rawResponse);

  const contacts: Record<string, string> = (() => {
    try { return JSON.parse(process.env.LEO_CONTACTS || "{}"); } catch { return {}; }
  })();

  // Construire un message d'historique clair avec les actions confirmées
  // (Claude doit savoir ce qu'il a fait pour répondre aux questions de suivi)
  const actionsLog: string[] = [];
  if (parsed.emailSujet) actionsLog.push(`[ACTION COMPLÉTÉE: courriel rédigé et envoyé par texto — Objet: "${parsed.emailSujet}"]`);
  if (parsed.driveSearch) actionsLog.push(`[ACTION COMPLÉTÉE: recherche Drive pour "${parsed.driveSearch}" — lien envoyé par texto]`);
  if (parsed.smsContact) actionsLog.push(`[ACTION COMPLÉTÉE: SMS envoyé à ${parsed.smsContact} — Message: "${parsed.smsMessage}"]`);
  if (parsed.crmUpdate) actionsLog.push(`[ACTION COMPLÉTÉE: CRM mis à jour]`);

  const historyAssistantMessage = actionsLog.length > 0
    ? `${parsed.vocal}\n${actionsLog.join("\n")}`
    : parsed.vocal;

  const updatedHistory = [
    ...history,
    { role: "user", content: speechResult },
    { role: "assistant", content: historyAssistantMessage },
  ];

  await Promise.allSettled([
    // Historique appel — sauvegardé EN PREMIER pour garantir la mémoire
    saveCallHistory(callSid, updatedHistory),

    // Apprentissage automatique
    learnFromExchange(speechResult, historyAssistantMessage, memory),

    // Email → SMS
    parsed.emailSujet && parsed.emailCorps
      ? sendSMS("+15146215162", `BROUILLON COURRIEL\nObjet: ${parsed.emailSujet}\n\n${parsed.emailCorps}`)
      : Promise.resolve(),

    // Drive → SMS
    parsed.driveSearch
      ? searchGoogleDrive(parsed.driveSearch).then(files => {
          if (files.length === 0) return sendSMS("+15146215162", `Aucun doc trouvé: "${parsed.driveSearch}"`);
          const list = files.slice(0, 3).map((f, i) => `${i + 1}. ${f.name}\n${f.link}`).join("\n\n");
          return sendSMS("+15146215162", `DRIVE (${files.length}):\n\n${list}`);
        }).catch(() => sendSMS("+15146215162", "Erreur Drive — réessaie par texto."))
      : Promise.resolve(),

    // Proxy SMS
    parsed.smsContact && parsed.smsMessage
      ? (() => {
          const entry = Object.entries(contacts).find(([name]) =>
            parsed.smsContact!.toLowerCase().includes(name.toLowerCase())
          );
          return entry ? sendSMS(entry[1], parsed.smsMessage!) : Promise.resolve();
        })()
      : Promise.resolve(),

    // CRM
    parsed.crmUpdate
      ? (async () => {
          const crmData = JSON.parse(parsed.crmUpdate!);
          const existing = await redisCommand(["GET", "fortier_data"]);
          if (!existing) return;
          const db = JSON.parse(existing);
          const deals = db.deals || [];
          const idx = deals.findIndex((d: { name: string }) =>
            d.name?.toLowerCase().includes(crmData.contact?.toLowerCase())
          );
          if (idx >= 0) {
            deals[idx].notes = (deals[idx].notes || "") + `\n[VOIX ${new Date().toLocaleDateString("fr-CA")}] ${crmData.note}`;
          } else if (crmData.contact) {
            deals.push({ id: Date.now(), name: crmData.contact, status: "prospect", notes: crmData.note, createdAt: new Date().toISOString() });
          }
          db.deals = deals;
          await redisCommand(["SET", "fortier_data", JSON.stringify(db)]);
        })().catch(() => {})
      : Promise.resolve(),
  ]);

  const voiceText = parsed.vocal || "Voilà, c'est réglé.";

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${xmlEscape(ttsUrl(voiceText))}</Play>
  <Gather input="speech" action="/api/voice" method="POST" language="fr-FR" speechTimeout="auto" timeout="8">
  </Gather>
  <Play>${xmlEscape(ttsUrl("Prends soin de toi François. À bientôt!"))}</Play>
  <Hangup/>
</Response>`, { headers: { "Content-Type": "text/xml" } });
}
