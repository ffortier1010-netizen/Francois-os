import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

const INIT_DATA = {
  deals: [
    { id: "1", nom: "Contrat — signe demain", valeur: "?", statut: "vert", dernierContact: "Aujourd'hui", prochainePAS: "Signature demain" },
    { id: "2", nom: "Terrain A — développeur", valeur: "?", statut: "orange", dernierContact: "Cette semaine", prochainePAS: "Suivi jeudi" },
    { id: "3", nom: "Terrain B — développeur", valeur: "?", statut: "orange", dernierContact: "Cette semaine", prochainePAS: "Appel vendredi" },
  ],
  taches: [
    { id: "1", texte: "Demander référence au client qui signe demain", fait: false, objectif: 1 },
    { id: "2", texte: "Identifier 3 CPA à contacter cette semaine", fait: false, objectif: 1 },
    { id: "3", texte: "Créer Google Sheet CRM (7 colonnes)", fait: false, objectif: 1 },
    { id: "4", texte: "Confirmer valeur réelle des 2 terrains", fait: false, objectif: 1 },
  ],
};

function getRedis() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export async function GET() {
  try {
    const redis = getRedis();
    const data = await redis.get("fortier_data");
    return NextResponse.json(data ?? INIT_DATA);
  } catch {
    return NextResponse.json(INIT_DATA);
  }
}

export async function POST(req: Request) {
  try {
    const redis = getRedis();
    const body = await req.json();
    await redis.set("fortier_data", body);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Sauvegarde impossible" }, { status: 500 });
  }
}
