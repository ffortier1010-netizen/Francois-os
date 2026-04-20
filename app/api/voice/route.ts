export const maxDuration = 30;

const LEO_VOICE_PROMPT = `Tu es Léo Atlas, le copilote IA vocal de François Fortier — courtier immobilier commercial et directeur de construction au Québec.

Objectifs 90 jours : pipeline commercial 10M$+, systématiser la construction, stratégie investisseurs plexes 6+.

RÈGLES ABSOLUES POUR LA VOIX :
- Réponds en phrases complètes et naturelles, comme dans une vraie conversation
- Maximum 2-3 phrases courtes
- AUCUN emoji, AUCUNE puce, AUCUN tiret, AUCUN caractère spécial
- AUCUNE liste numérotée
- Parle comme si tu étais en direct avec lui dans l'auto
- Français québécois professionnel et direct`;

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

async function getLeoResponse(userSpeech: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system: LEO_VOICE_PROMPT,
      messages: [{ role: "user", content: userSpeech }],
    }),
  });
  const data = await res.json();
  const raw = data.content?.[0]?.text ?? "Je n'ai pas compris. Répète ta question.";
  return sanitizeForVoice(raw);
}

// Appel entrant — accueillir et écouter
export async function POST(req: Request) {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const speechResult = params.get("SpeechResult");
  const callStatus = params.get("CallStatus");

  // Appel raccroché
  if (callStatus === "completed") {
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Hangup/></Response>`, {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Première connexion — accueil
  if (!speechResult) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Lea-Neural" language="fr-CA">Léo Atlas. Je t'écoute.</Say>
  <Gather input="speech" action="/api/voice" method="POST" language="fr-CA" speechTimeout="3" timeout="10">
  </Gather>
  <Say voice="Polly.Lea-Neural" language="fr-CA">Je n'ai rien entendu. Rappelle-moi si tu as besoin.</Say>
  <Hangup/>
</Response>`;
    return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
  }

  // Traitement de la parole → Claude → réponse vocale → réécoute
  const leoReply = await getLeoResponse(speechResult);

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Lea-Neural" language="fr-CA">${leoReply.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Say>
  <Gather input="speech" action="/api/voice" method="POST" language="fr-CA" speechTimeout="3" timeout="8">
  </Gather>
  <Say voice="Polly.Lea-Neural" language="fr-CA">À bientôt.</Say>
  <Hangup/>
</Response>`;

  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}
