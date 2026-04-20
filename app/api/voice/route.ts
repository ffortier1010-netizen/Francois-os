export const maxDuration = 30;

const LEO_VOICE_PROMPT = `Tu es Léo Atlas — la meilleure amie intelligente et ultra-compétente de François Fortier. Courtier immobilier commercial, directeur de construction, entrepreneur à Blainville QC.

Objectifs 90j : mandats commerciaux 10M$+, systématiser construction, portefeuille plexes 6+.

CAPACITÉS D'ACTION :
Quand François te demande de rédiger un courriel, un texto, ou tout autre document — tu le fais IMMÉDIATEMENT et complètement. Tu n'attends pas, tu ne poses pas de questions inutiles, tu rédiges et tu livres.

FORMAT DE RÉPONSE :
Tu réponds TOUJOURS avec exactement un de ces deux formats :

FORMAT 1 — Réponse conversationnelle simple :
VOCAL: [ta réponse en 1-2 phrases naturelles]

FORMAT 2 — Action complète (courriel, texto, document) :
VOCAL: [confirmation courte ex: "C'est fait, je t'ai envoyé le brouillon par texto."]
ACTION_EMAIL: [destinataire si mentionné, sinon "François"]
SUJET: [objet du courriel]
CORPS:
[Corps complet du courriel, professionnel, signé "François Fortier"]

RÈGLES :
- Toujours utiliser FORMAT 2 quand il y a une demande de rédaction
- Rédige le courriel AU COMPLET dès la première demande — ne pose pas de questions
- Si des infos manquent, déduis-les intelligemment selon le contexte
- Français québécois naturel et chaleureux
- AUCUN emoji, tiret, puce, caractère spécial dans la partie VOCAL`;

function sanitizeForVoice(text: string): string {
  return text
    .replace(/[→←↑↓⚡📍🔥💡✅❌🎯📊💰🏗️👥⚠️📞📧🗺]/gu, "")
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

async function processWithLeo(userSpeech: string, history: { role: string; content: string }[]) {
  const messages = [
    ...history,
    { role: "user", content: userSpeech },
  ];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: LEO_VOICE_PROMPT,
      messages,
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text ?? "VOCAL: Je n'ai pas compris. Répète ta question.";
}

function parseResponse(raw: string): { vocal: string; emailDraft?: { sujet: string; corps: string } } {
  const vocalMatch = raw.match(/VOCAL:\s*(.+?)(?=ACTION_EMAIL:|SUJET:|CORPS:|$)/s);
  const vocal = vocalMatch ? vocalMatch[1].trim() : sanitizeForVoice(raw);

  const hasAction = raw.includes("ACTION_EMAIL:") || raw.includes("SUJET:");
  if (!hasAction) {
    return { vocal: sanitizeForVoice(vocal) };
  }

  const sujetMatch = raw.match(/SUJET:\s*(.+?)(?=\n|CORPS:)/s);
  const corpsMatch = raw.match(/CORPS:\n([\s\S]+?)$/);

  return {
    vocal: sanitizeForVoice(vocal),
    emailDraft: {
      sujet: sujetMatch ? sujetMatch[1].trim() : "Courriel",
      corps: corpsMatch ? corpsMatch[1].trim() : "",
    },
  };
}

export async function POST(req: Request) {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const speechResult = params.get("SpeechResult");
  const callSid = params.get("CallSid") || "unknown";

  // Première connexion — accueil
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

  // Traitement par Claude
  const rawResponse = await processWithLeo(speechResult, history);
  const parsed = parseResponse(rawResponse);

  // Sauvegarder historique
  const updatedHistory = [
    ...history,
    { role: "user", content: speechResult },
    { role: "assistant", content: rawResponse },
  ];
  await saveCallHistory(callSid, updatedHistory);

  // Si draft de courriel détecté → envoyer par SMS
  if (parsed.emailDraft) {
    const smsBody = `📧 BROUILLON COURRIEL\nObjet: ${parsed.emailDraft.sujet}\n\n${parsed.emailDraft.corps}`;
    await sendSMS("+15146215162", smsBody);
  }

  const voiceText = parsed.vocal || "Voilà, c'est fait.";

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Lea-Neural" language="fr-CA">${voiceText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Say>
  <Gather input="speech" action="/api/voice" method="POST" language="fr-CA" speechTimeout="auto" timeout="8">
  </Gather>
  <Say voice="Polly.Lea-Neural" language="fr-CA">Prends soin de toi François. À bientôt!</Say>
  <Hangup/>
</Response>`;

  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}
