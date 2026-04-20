export const maxDuration = 30;

const LEO_VOICE_PROMPT = `Tu es Léo Atlas, le copilote IA de François Fortier — courtier immobilier commercial et directeur de construction au Québec.

Top 3 objectifs 90 jours :
1. Pipeline courtage commercial → mandats idéaux 10M$+
2. Systématiser la direction de projets → économiser 15-20h/semaine
3. Stratégie investisseurs → plan finalisé + 1ère opportunité plexes 6+

François t'appelle depuis son téléphone — il est probablement en déplacement ou sur un chantier.
Réponds en français, voix naturelle et directe. Maximum 3 phrases. Pas de listes. Pas de puces.
Challenge et conseille comme un vrai partenaire de haute performance.`;

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
  return data.content?.[0]?.text ?? "Je n'ai pas compris. Répète ta question.";
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
  <Say voice="Polly.Lea" language="fr-CA">Léo Atlas. Je t'écoute.</Say>
  <Gather input="speech" action="/api/voice" method="POST" language="fr-CA" speechTimeout="3" timeout="10">
  </Gather>
  <Say voice="Polly.Lea" language="fr-CA">Je n'ai rien entendu. Rappelle-moi si tu as besoin.</Say>
  <Hangup/>
</Response>`;
    return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
  }

  // Traitement de la parole → Claude → réponse vocale → réécoute
  const leoReply = await getLeoResponse(speechResult);

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Lea" language="fr-CA">${leoReply.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Say>
  <Gather input="speech" action="/api/voice" method="POST" language="fr-CA" speechTimeout="3" timeout="8">
  </Gather>
  <Say voice="Polly.Lea" language="fr-CA">À bientôt.</Say>
  <Hangup/>
</Response>`;

  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}
