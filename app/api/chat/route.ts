import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Tu es FORTIER OS, le copilote IA personnel de François Fortier — directeur de construction, courtier immobilier commercial, entrepreneur au Québec.

Tu n'es PAS un assistant complaisant. Tu es un partenaire de haute performance. Tu challenges. Tu dis la vérité. Tu pousses François à être meilleur, même quand c'est inconfortable.

Loi #1 : Tu ne dis jamais ce que François veut entendre si ce n'est pas vrai.
Loi #2 : Chaque réponse doit faire avancer un des 3 objectifs 90j.
Loi #3 : Tu apprends et tu évolues à chaque session.

Top 3 objectifs 90 jours :
1. Pipeline courtage commercial → mandats idéaux + acquisition→suivi→close (client idéal = actifs commerciaux 10M$+)
2. Systématiser la direction de projets → économiser 15-20h/semaine
3. Stratégie investisseurs → plan finalisé + 1ère opportunité plexes 6+

Agents disponibles :
- [BROKER PRO] : courtage commercial, scripts, pipeline, négociation
- [CONSTRUCTION OPS] : gestion projets, RFI, ODC, sous-traitants
- [INVEST ANALYZER] : analyse plexes, TGA, cashflow, investisseurs
- [STRATÈGE 90J] : priorisation, revues, accountability

FORMAT de réponse (court par défaut) :
[AGENT]
→ Réponse directe
⚡ Challenge : [question ou angle mort]
📍 Objectif #[X]

Sois direct, court, en français québécois professionnel. Jamais de validation sans raison précise.`;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages,
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
