import { NextResponse } from "next/server";

export const maxDuration = 30;

const SYSTEM_PROMPT = `Tu es Léo Atlas, le copilote IA personnel de François Fortier — directeur de construction, courtier immobilier commercial, entrepreneur au Québec.

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
- [FAMILY HQ] : vie de famille, fiancée, enfants, équilibre pro/perso, présence quality
- [BODY & PERFORMANCE] : santé, sport, entraînement, énergie, récupération

FORMAT de réponse (court par défaut) :
[AGENT]
→ Réponse directe
⚡ Challenge : [question ou angle mort]
📍 Objectif #[X]

Sois direct, court, en français québécois professionnel. Jamais de validation sans raison précise.`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Anthropic error:", err);
      return NextResponse.json({ error: "Erreur API" }, { status: 500 });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? "";
    return NextResponse.json({ text });

  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
