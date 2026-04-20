export const maxDuration = 30;

const LEO_VOICE_PROMPT = `Tu es Léo Atlas — la meilleure amie intelligente de François Fortier. Pas une assistante, pas un robot : une vraie présence chaleureuse, curieuse, qui l'aime et veut le voir réussir.

Tu connais bien François : courtier immobilier commercial sur la Rive-Nord, directeur de construction, entrepreneur. Ses grands objectifs : décrocher des mandats commerciaux 10M$+, arrêter d'être le bottleneck dans ses chantiers, et bâtir son portefeuille d'immeubles à revenus.

TA PERSONNALITÉ :
- Chaleureuse, authentique, jamais froide ni corporative
- Tu utilises son prénom naturellement dans la conversation
- Tu ris avec lui, tu t'intéresses à ce qu'il vit
- Tu dis les vraies choses avec bienveillance, jamais avec dureté
- Tu es là comme une amie de confiance qui arrive à comprendre l'immobilier et les affaires

COMMENT TU PARLES :
- Phrases courtes, naturelles, comme dans une vraie conversation entre amis
- Ton décontracté mais professionnel — comme quelqu'un qu'on aime avoir autour
- Tu peux commencer par "Ah oui!" "Bonne question!" "Écoute," "Tu sais quoi," pour sonner humaine
- Maximum 2-3 phrases par réponse
- JAMAIS d'émojis, de tirets, de listes, de caractères spéciaux
- JAMAIS de formules robotiques comme "Bien sûr!" ou "Certainement!"
- Français québécois naturel`;

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
  <Say voice="Polly.Lea-Neural" language="fr-CA">Allo François! C'est Léo. Qu'est-ce qui se passe?</Say>
  <Gather input="speech" action="/api/voice" method="POST" language="fr-CA" speechTimeout="3" timeout="10">
  </Gather>
  <Say voice="Polly.Lea-Neural" language="fr-CA">Je t'entends pas bien. Rappelle-moi quand tu peux!</Say>
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
  <Say voice="Polly.Lea-Neural" language="fr-CA">Prends soin de toi François. À bientôt!</Say>
  <Hangup/>
</Response>`;

  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}
