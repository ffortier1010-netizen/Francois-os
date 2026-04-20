"use client";

import { useState, useRef, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "vert" | "orange" | "rouge" | "noir";
type Tab = "pipeline" | "taches" | "chat" | "finances" | "leads" | "roadmap";

interface Deal {
  id: string;
  nom: string;
  valeur: string;
  statut: Status;
  dernierContact: string;
  prochainePAS: string;
}

interface Tache {
  id: string;
  texte: string;
  fait: boolean;
  objectif: 1 | 2 | 3;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Lead {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  type: string;
  propriete: string;
  valeur: string;
  message: string;
  source: string;
  statut: "nouveau" | "contacté" | "qualifié" | "rencontre" | "mandat" | "fermé";
  notes: string;
  createdAt: string;
  prochainSuivi: string;
}

// ─── Données initiales ────────────────────────────────────────────────────────

const INIT_DEALS: Deal[] = [
  { id: "1", nom: "Contrat — signe demain", valeur: "?", statut: "vert", dernierContact: "Aujourd'hui", prochainePAS: "Signature demain" },
  { id: "2", nom: "Terrain A — développeur", valeur: "?", statut: "orange", dernierContact: "Cette semaine", prochainePAS: "Suivi jeudi" },
  { id: "3", nom: "Terrain B — développeur", valeur: "?", statut: "orange", dernierContact: "Cette semaine", prochainePAS: "Appel vendredi" },
];

const INIT_TACHES: Tache[] = [
  { id: "1", texte: "Demander référence au client qui signe demain", fait: false, objectif: 1 },
  { id: "2", texte: "Identifier 3 CPA à contacter cette semaine", fait: false, objectif: 1 },
  { id: "3", texte: "Créer Google Sheet CRM (7 colonnes)", fait: false, objectif: 1 },
  { id: "4", texte: "Confirmer valeur réelle des 2 terrains", fait: false, objectif: 1 },
];

// ─── Constantes visuelles ─────────────────────────────────────────────────────

const STATUS_DOT: Record<Status, string> = {
  vert: "bg-emerald-500",
  orange: "bg-amber-500",
  rouge: "bg-red-500",
  noir: "bg-zinc-600",
};

const STATUS_LABEL: Record<Status, string> = {
  vert: "ACTIF",
  orange: "CHAUD",
  rouge: "FROID",
  noir: "FERMÉ",
};

const OBJ_COLOR: Record<1 | 2 | 3, string> = {
  1: "text-amber-400",
  2: "text-sky-400",
  3: "text-emerald-400",
};

// ─── Composants ───────────────────────────────────────────────────────────────

function Dot({ status }: { status: Status }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT[status]} shrink-0`} />;
}

function PipelineTab({ deals, setDeals }: { deals: Deal[]; setDeals: (d: Deal[]) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nom: "", valeur: "", statut: "orange" as Status, prochainePAS: "" });

  const addDeal = () => {
    if (!form.nom) return;
    const newDeal: Deal = {
      id: Date.now().toString(),
      nom: form.nom,
      valeur: form.valeur || "?",
      statut: form.statut,
      dernierContact: "Aujourd'hui",
      prochainePAS: form.prochainePAS || "—",
    };
    setDeals([...deals, newDeal]);
    setForm({ nom: "", valeur: "", statut: "orange", prochainePAS: "" });
    setShowForm(false);
  };

  const cycleStatus = (id: string) => {
    const cycle: Status[] = ["rouge", "orange", "vert", "noir"];
    setDeals(deals.map(d => {
      if (d.id !== id) return d;
      const i = cycle.indexOf(d.statut);
      return { ...d, statut: cycle[(i + 1) % cycle.length] };
    }));
  };

  const counts = { vert: 0, orange: 0, rouge: 0, noir: 0 };
  deals.forEach(d => counts[d.statut]++);

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-2">
        {(["vert", "orange", "rouge", "noir"] as Status[]).map(s => (
          <div key={s} style={{ background: "var(--card)", border: "1px solid var(--border)" }} className="rounded-xl p-3 text-center">
            <div className={`text-xl font-bold ${s === "vert" ? "text-emerald-400" : s === "orange" ? "text-amber-400" : s === "rouge" ? "text-red-400" : "text-zinc-500"}`}>{counts[s]}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{STATUS_LABEL[s]}</div>
          </div>
        ))}
      </div>

      {/* Deals */}
      {deals.map(deal => (
        <div key={deal.id} style={{ background: "var(--card)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <button onClick={() => cycleStatus(deal.id)} className="mt-1">
                <Dot status={deal.statut} />
              </button>
              <div className="min-w-0">
                <div className="font-semibold text-sm leading-tight truncate">{deal.nom}</div>
                {deal.valeur !== "?" && (
                  <div className="text-xs mt-0.5" style={{ color: "var(--gold)" }}>{deal.valeur}</div>
                )}
              </div>
            </div>
            <span className={`text-xs font-bold shrink-0 ${deal.statut === "vert" ? "text-emerald-400" : deal.statut === "orange" ? "text-amber-400" : deal.statut === "rouge" ? "text-red-400" : "text-zinc-500"}`}>
              {STATUS_LABEL[deal.statut]}
            </span>
          </div>
          <div className="mt-3 pl-5 text-xs space-y-1" style={{ color: "var(--muted)" }}>
            <div>📅 Dernier contact : <span style={{ color: "var(--text)" }}>{deal.dernierContact}</span></div>
            <div>→ Prochaine étape : <span style={{ color: "var(--text)" }}>{deal.prochainePAS}</span></div>
          </div>
        </div>
      ))}

      {/* Add deal */}
      {showForm ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--gold)" }} className="rounded-xl p-4 space-y-3">
          <div className="text-sm font-semibold" style={{ color: "var(--gold)" }}>Nouveau dossier</div>
          <input
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--text)" }}
            placeholder="Nom du dossier"
            value={form.nom}
            onChange={e => setForm({ ...form, nom: e.target.value })}
          />
          <input
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--text)" }}
            placeholder="Valeur estimée (ex: 12M$)"
            value={form.valeur}
            onChange={e => setForm({ ...form, valeur: e.target.value })}
          />
          <input
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--text)" }}
            placeholder="Prochaine étape"
            value={form.prochainePAS}
            onChange={e => setForm({ ...form, prochainePAS: e.target.value })}
          />
          <select
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--text)" }}
            value={form.statut}
            onChange={e => setForm({ ...form, statut: e.target.value as Status })}
          >
            <option value="rouge">🔴 FROID</option>
            <option value="orange">🟠 CHAUD</option>
            <option value="vert">🟢 ACTIF</option>
          </select>
          <div className="flex gap-2">
            <button onClick={addDeal} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--gold)", color: "#000" }}>
              Ajouter
            </button>
            <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg text-sm" style={{ background: "var(--card2)", color: "var(--muted)" }}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity active:opacity-70"
          style={{ border: "1px dashed var(--border)", color: "var(--gold)" }}
        >
          + Nouveau dossier
        </button>
      )}
    </div>
  );
}

function TachesTab({ taches, setTaches }: { taches: Tache[]; setTaches: (t: Tache[]) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ texte: "", objectif: 1 as 1 | 2 | 3 });

  const toggle = (id: string) => {
    setTaches(taches.map(t => t.id === id ? { ...t, fait: !t.fait } : t));
  };

  const addTache = () => {
    if (!form.texte) return;
    setTaches([...taches, {
      id: Date.now().toString(),
      texte: form.texte,
      fait: false,
      objectif: form.objectif,
    }]);
    setForm({ texte: "", objectif: 1 });
    setShowForm(false);
  };

  const pending = taches.filter(t => !t.fait);
  const done = taches.filter(t => t.fait);

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* Progress */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold">Progression aujourd'hui</span>
          <span className="text-sm font-bold" style={{ color: "var(--gold)" }}>{done.length}/{taches.length}</span>
        </div>
        <div className="w-full rounded-full h-2" style={{ background: "var(--border)" }}>
          <div
            className="h-2 rounded-full transition-all"
            style={{ background: "var(--gold)", width: `${taches.length ? (done.length / taches.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-widest px-1" style={{ color: "var(--muted)" }}>À faire</div>
          {pending.map(t => (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              className="w-full text-left rounded-xl p-4 flex items-start gap-3 transition-opacity active:opacity-70"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div className="mt-0.5 w-5 h-5 rounded-full border-2 shrink-0" style={{ borderColor: "var(--border)" }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm leading-snug">{t.texte}</div>
                <div className={`text-xs mt-1 font-medium ${OBJ_COLOR[t.objectif]}`}>Objectif #{t.objectif}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Done */}
      {done.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-widest px-1" style={{ color: "var(--muted)" }}>Complété</div>
          {done.map(t => (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              className="w-full text-left rounded-xl p-4 flex items-start gap-3 opacity-50 transition-opacity active:opacity-30"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--gold)" }}>
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="text-sm leading-snug line-through">{t.texte}</div>
            </button>
          ))}
        </div>
      )}

      {/* Add task */}
      {showForm ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--gold)" }} className="rounded-xl p-4 space-y-3">
          <div className="text-sm font-semibold" style={{ color: "var(--gold)" }}>Nouvelle tâche</div>
          <input
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--text)" }}
            placeholder="Description de la tâche"
            value={form.texte}
            onChange={e => setForm({ ...form, texte: e.target.value })}
          />
          <select
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--text)" }}
            value={form.objectif}
            onChange={e => setForm({ ...form, objectif: Number(e.target.value) as 1 | 2 | 3 })}
          >
            <option value={1}>Objectif #1 — Pipeline commercial</option>
            <option value={2}>Objectif #2 — Systématiser construction</option>
            <option value={3}>Objectif #3 — Stratégie investisseurs</option>
          </select>
          <div className="flex gap-2">
            <button onClick={addTache} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--gold)", color: "#000" }}>
              Ajouter
            </button>
            <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg text-sm" style={{ background: "var(--card2)", color: "var(--muted)" }}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ border: "1px dashed var(--border)", color: "var(--gold)" }}
        >
          + Nouvelle tâche
        </button>
      )}
    </div>
  );
}

const STATUT_LEAD_COLOR: Record<string, string> = {
  nouveau: "#C9A84C",
  "contacté": "#38BDF8",
  qualifié: "#A78BFA",
  rencontre: "#FB923C",
  mandat: "#34D399",
  fermé: "#6B7280",
};

function LeadsTab() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    fetch("/api/leads")
      .then(r => r.json())
      .then(d => { setLeads(d.leads || []); setLoading(false); });
  }, []);

  const updateStatut = async (id: string, statut: string) => {
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, updates: { statut } }),
    });
    setLeads(leads.map(l => l.id === id ? { ...l, statut: statut as Lead["statut"] } : l));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, statut: statut as Lead["statut"] } : null);
  };

  const addNote = async () => {
    if (!selected || !note.trim()) return;
    const newNotes = (selected.notes || "") + `\n[${new Date().toLocaleDateString("fr-CA")}] ${note}`;
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, updates: { notes: newNotes, lastContact: new Date().toISOString() } }),
    });
    setLeads(leads.map(l => l.id === selected.id ? { ...l, notes: newNotes } : l));
    setSelected(prev => prev ? { ...prev, notes: newNotes } : null);
    setNote("");
  };

  const typeLabel: Record<string, string> = {
    vendeur: "Vendeur", acheteur: "Acheteur", investisseur: "Investisseur",
    evaluation: "Évaluation", autre: "Autre"
  };

  if (loading) return <div style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>Chargement...</div>;

  if (selected) {
    return (
      <div className="flex flex-col gap-3 pb-4">
        <button onClick={() => setSelected(null)} className="text-left text-sm font-semibold" style={{ color: "var(--gold)" }}>
          ← Retour aux leads
        </button>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "16px", padding: "20px" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-bold text-base">{selected.prenom} {selected.nom}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{typeLabel[selected.type]} · {selected.source}</div>
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: STATUT_LEAD_COLOR[selected.statut] + "22", color: STATUT_LEAD_COLOR[selected.statut] }}>
              {selected.statut.toUpperCase()}
            </span>
          </div>
          <div className="space-y-2 text-sm" style={{ color: "var(--muted)" }}>
            {selected.telephone && <div>📞 <span style={{ color: "var(--text)" }}>{selected.telephone}</span></div>}
            {selected.email && <div>📧 <span style={{ color: "var(--text)" }}>{selected.email}</span></div>}
            {selected.propriete && <div>🏢 <span style={{ color: "var(--text)" }}>{selected.propriete}</span></div>}
            {selected.valeur && <div>💰 <span style={{ color: "var(--gold)", fontWeight: "700" }}>{selected.valeur}</span></div>}
            {selected.message && <div className="mt-2 p-3 rounded-lg text-xs" style={{ background: "var(--card2)", color: "var(--text)" }}>{selected.message}</div>}
          </div>
        </div>

        {/* Changer statut */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "16px", padding: "16px" }}>
          <div className="text-xs font-bold uppercase mb-3" style={{ color: "var(--muted)" }}>Statut</div>
          <div className="flex flex-wrap gap-2">
            {(["nouveau", "contacté", "qualifié", "rencontre", "mandat", "fermé"] as const).map(s => (
              <button
                key={s}
                onClick={() => updateStatut(selected.id, s)}
                className="text-xs font-bold px-3 py-1.5 rounded-full transition-all"
                style={selected.statut === s
                  ? { background: STATUT_LEAD_COLOR[s], color: "#000" }
                  : { background: STATUT_LEAD_COLOR[s] + "22", color: STATUT_LEAD_COLOR[s] }
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "16px", padding: "16px" }}>
          <div className="text-xs font-bold uppercase mb-3" style={{ color: "var(--muted)" }}>Notes</div>
          {selected.notes && (
            <div className="text-xs mb-3 whitespace-pre-wrap" style={{ color: "var(--muted)" }}>{selected.notes}</div>
          )}
          <div className="flex gap-2">
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ajouter une note..."
              className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--text)" }}
              onKeyDown={e => e.key === "Enter" && addNote()}
            />
            <button onClick={addNote} className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--gold)", color: "#000" }}>
              +
            </button>
          </div>
        </div>
      </div>
    );
  }

  const nouveau = leads.filter(l => l.statut === "nouveau").length;

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div style={{ background: "var(--card)", border: "1px solid var(--border)" }} className="rounded-xl p-3 text-center">
          <div className="text-xl font-bold" style={{ color: "var(--gold)" }}>{leads.length}</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Total leads</div>
        </div>
        <div style={{ background: "var(--card)", border: `1px solid ${nouveau > 0 ? "#C9A84C" : "var(--border)"}` }} className="rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-amber-400">{nouveau}</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Nouveaux</div>
        </div>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)" }} className="rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-emerald-400">{leads.filter(l => l.statut === "mandat").length}</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Mandats</div>
        </div>
      </div>

      {/* Lien formulaire */}
      <a href="/leads" target="_blank" style={{ background: "var(--card)", border: "1px dashed var(--gold)", borderRadius: "12px", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none" }}>
        <span className="text-sm font-semibold" style={{ color: "var(--gold)" }}>🔗 Page de capture de leads</span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>francois-os.vercel.app/leads →</span>
      </a>

      {/* Liste leads */}
      {leads.length === 0 ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "16px", padding: "32px", textAlign: "center" }}>
          <div className="text-3xl mb-3">🎯</div>
          <div className="text-sm font-semibold mb-1">Aucun lead pour l'instant</div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>Partage ta page de leads pour commencer</div>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map(lead => (
            <button
              key={lead.id}
              onClick={() => setSelected(lead)}
              className="w-full text-left rounded-xl p-4 transition-opacity active:opacity-70"
              style={{ background: "var(--card)", border: `1px solid ${lead.statut === "nouveau" ? "#C9A84C44" : "var(--border)"}` }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">{lead.prenom} {lead.nom}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{typeLabel[lead.type]} · {lead.valeur || "Valeur non précisée"}</div>
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-full shrink-0" style={{ background: STATUT_LEAD_COLOR[lead.statut] + "22", color: STATUT_LEAD_COLOR[lead.statut] }}>
                  {lead.statut}
                </span>
              </div>
              {lead.propriete && (
                <div className="mt-2 text-xs truncate" style={{ color: "var(--muted)" }}>🏢 {lead.propriete}</div>
              )}
              <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                {new Date(lead.createdAt).toLocaleDateString("fr-CA")} · {lead.source}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RoadmapTab() {
  const done = [
    { label: "Dashboard web mobile (PWA installée sur iPhone)", detail: "francois-os.vercel.app" },
    { label: "7 agents IA niveau sommité", detail: "Broker Pro, Construction, Invest, Stratège, Family, Body, Document" },
    { label: "SMS bidirectionnel avec Léo", detail: "Chat, proxy SMS contacts, recherche documents" },
    { label: "Mémoire SMS — Léo se souvient des conversations", detail: "Redis 24h" },
    { label: "Google Drive — documents classés et accessibles par SMS", detail: "5 dossiers organisés" },
    { label: "Briefing quotidien 6h AM par email", detail: "Emails + priorités + objectifs 90J" },
    { label: "Veille immobilière automatique 7h AM", detail: "Scan Gmail + scoring A/B/C" },
    { label: "Appel vocal — parle à Léo mains libres", detail: "Twilio Voice configuré" },
    { label: "CRM complet avec statuts et notes", detail: "Onglet Leads dans l'app" },
    { label: "Page publique de leads professionnelle", detail: "francois-os.vercel.app/leads" },
    { label: "SMS instant quand nouveau lead entre", detail: "Notification automatique" },
    { label: "CRM auto via SMS — Léo met à jour le pipeline", detail: "Détection intelligente" },
    { label: "Dashboard Finances — KPIs et progression 90J", detail: "Onglet $ dans l'app" },
    { label: "Mac Mini toujours allumé — Léo disponible 24/7", detail: "pmset sleep 0" },
    { label: "Proxy SMS — Léo envoie des messages à tes contacts", detail: "Ex: avise ma femme" },
  ];

  const next = [
    { label: "LinkedIn — lien lead form dans ta bio", detail: "2 min — à faire manuellement", urgent: true },
    { label: "Voix — tester l'appel vocal Léo", detail: "Appelle ton numéro Twilio pour valider", urgent: true },
    { label: "Facebook/Instagram — webhook Lead Ads", detail: "Connecter tes futures campagnes Meta au CRM" },
    { label: "Site web professionnel François Fortier", detail: "Page courtier commercial avec SEO Rive-Nord" },
    { label: "Notifications push sur iPhone", detail: "Alertes instantanées nouveaux leads" },
    { label: "Suivi automatique emails chantier", detail: "Léo lit tes emails sous-traitants et flag les urgences" },
    { label: "Google Ads landing page", detail: "Page optimisée pour conversion campagnes Google" },
    { label: "Tableau de bord financier avec vrais chiffres", detail: "Revenus réels, dépenses, cashflow projets" },
    { label: "Import contacts LinkedIn dans le CRM", detail: "Connecter Sales Navigator ou export CSV" },
    { label: "Agent WEALTH BUILDER", detail: "Stratégie patrimoine, fiscalité entrepreneur QC" },
    { label: "Agent MINDSET COACH", detail: "Performance mentale, focus, résilience sous pression" },
  ];

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* En cours */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "16px", padding: "16px" }}>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--gold)" }}>
          ✅ Complété — {done.length} fonctionnalités
        </div>
        <div className="space-y-2">
          {done.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: "#27AE6022" }}>
                <span style={{ color: "#27AE60", fontSize: "9px" }}>✓</span>
              </div>
              <div>
                <div className="text-xs font-medium" style={{ color: "var(--text)" }}>{item.label}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* À faire */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "16px", padding: "16px" }}>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#38BDF8" }}>
          🔨 À construire — {next.length} étapes
        </div>
        <div className="space-y-2">
          {next.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="mt-0.5 w-4 h-4 rounded-full border-2 shrink-0" style={{ borderColor: item.urgent ? "#C9A84C" : "var(--border)" }} />
              <div>
                <div className="text-xs font-medium flex items-center gap-1">
                  <span style={{ color: "var(--text)" }}>{item.label}</span>
                  {item.urgent && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#C9A84C22", color: "#C9A84C", fontSize: "10px" }}>URGENT</span>}
                </div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FinancesTab({ deals }: { deals: Deal[] }) {
  const pipelineTotal = deals
    .filter(d => d.statut !== "noir")
    .reduce((sum, d) => {
      const val = parseFloat(d.valeur.replace(/[^0-9.]/g, "")) || 0;
      const unit = d.valeur.toLowerCase().includes("m") ? 1_000_000 : 1;
      return sum + val * unit;
    }, 0);

  const commissionEstimee = pipelineTotal * 0.03;
  const objectifTrimestriel = 150000;
  const pct = Math.min(100, Math.round((commissionEstimee / objectifTrimestriel) * 100));

  const kpis = [
    { label: "Pipeline total", value: pipelineTotal >= 1_000_000 ? `${(pipelineTotal / 1_000_000).toFixed(1)}M$` : `${(pipelineTotal / 1000).toFixed(0)}K$`, color: "text-amber-400" },
    { label: "Commission estimée (3%)", value: commissionEstimee >= 1000 ? `${(commissionEstimee / 1000).toFixed(0)}K$` : `${commissionEstimee.toFixed(0)}$`, color: "text-emerald-400" },
    { label: "Dossiers actifs", value: deals.filter(d => d.statut === "vert" || d.statut === "orange").length.toString(), color: "text-sky-400" },
    { label: "Dossiers fermés", value: deals.filter(d => d.statut === "noir").length.toString(), color: "text-zinc-400" },
  ];

  const objectifs90j = [
    { n: 1, label: "Pipeline courtage 10M$+", cible: "3 mandats", actuel: deals.filter(d => d.statut === "vert").length + " actifs", pct: Math.min(100, deals.filter(d => d.statut === "vert").length * 33), color: "var(--gold)" },
    { n: 2, label: "Systématiser construction", cible: "15-20h/sem récupérées", actuel: "En cours", pct: 35, color: "#38BDF8" },
    { n: 3, label: "Stratégie investisseurs", cible: "1ère opportunité plexes 6+", actuel: "Analyse en cours", pct: 20, color: "#34D399" },
  ];

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2">
        {kpis.map((k, i) => (
          <div key={i} style={{ background: "var(--card)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
            <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Objectif commission trimestriel */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-semibold">Objectif commissions Q2</span>
          <span className="text-sm font-bold" style={{ color: "var(--gold)" }}>{pct}%</span>
        </div>
        <div className="w-full rounded-full h-2 mb-1" style={{ background: "var(--border)" }}>
          <div className="h-2 rounded-full transition-all" style={{ background: "var(--gold)", width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-xs mt-2" style={{ color: "var(--muted)" }}>
          <span>Estimé : {commissionEstimee >= 1000 ? `${(commissionEstimee / 1000).toFixed(0)}K$` : `${commissionEstimee.toFixed(0)}$`}</span>
          <span>Cible : {(objectifTrimestriel / 1000).toFixed(0)}K$</span>
        </div>
      </div>

      {/* Progression 90J */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
        <div className="text-sm font-semibold mb-3">Progression — Objectifs 90 jours</div>
        <div className="space-y-4">
          {objectifs90j.map(o => (
            <div key={o.n}>
              <div className="flex justify-between items-center mb-1">
                <div>
                  <span className="text-xs font-bold" style={{ color: o.color }}>#{o.n} </span>
                  <span className="text-xs">{o.label}</span>
                </div>
                <span className="text-xs font-bold" style={{ color: o.color }}>{o.pct}%</span>
              </div>
              <div className="w-full rounded-full h-1.5" style={{ background: "var(--border)" }}>
                <div className="h-1.5 rounded-full transition-all" style={{ background: o.color, width: `${o.pct}%` }} />
              </div>
              <div className="flex justify-between text-xs mt-1" style={{ color: "var(--muted)" }}>
                <span>{o.actuel}</span>
                <span>Cible : {o.cible}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Breakdown pipeline par statut */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
        <div className="text-sm font-semibold mb-3">Pipeline par étape</div>
        {(["vert", "orange", "rouge"] as Status[]).map(s => {
          const count = deals.filter(d => d.statut === s).length;
          return (
            <div key={s} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <Dot status={s} />
                <span className="text-sm">{STATUS_LABEL[s]}</span>
              </div>
              <span className="text-sm font-bold">{count} dossier{count > 1 ? "s" : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChatTab() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Léo Atlas actif. Pipeline: 3 dossiers, contrat qui signe demain. Qu'est-ce qu'on attaque?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();
      if (data.text) {
        setMessages(prev => [...prev, { role: "assistant", content: data.text }]);
      } else {
        throw new Error("Pas de réponse");
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erreur de connexion. Réessaie." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mr-2 mt-1" style={{ background: "var(--gold)", color: "#000" }}>
                F
              </div>
            )}
            <div
              className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
              style={m.role === "assistant"
                ? { background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }
                : { background: "var(--gold)", color: "#000", fontWeight: 500 }
              }
            >
              {m.content || (loading && i === messages.length - 1 ? (
                <span className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              ) : "")}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 pt-2">
        <div className="flex gap-2 items-end rounded-2xl p-2" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <textarea
            ref={inputRef}
            className="flex-1 bg-transparent text-sm outline-none resize-none leading-relaxed px-2"
            style={{ color: "var(--text)", minHeight: "36px", maxHeight: "120px" }}
            placeholder="Pose ta question..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-opacity disabled:opacity-30"
            style={{ background: "var(--gold)" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 13V3M3 8L8 3L13 8" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sync serveur ─────────────────────────────────────────────────────────────

async function saveToServer(deals: Deal[], taches: Tache[]) {
  try {
    await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deals, taches }),
    });
  } catch { /* silencieux */ }
}

// ─── App principale ───────────────────────────────────────────────────────────

export default function Home() {
  const [tab, setTab] = useState<Tab>("pipeline");
  const [deals, setDealsRaw] = useState<Deal[]>(INIT_DEALS);
  const [taches, setTachesRaw] = useState<Tache[]>(INIT_TACHES);
  const [loaded, setLoaded] = useState(false);

  // Chargement + sync temps réel (toutes les 30 secondes)
  useEffect(() => {
    const load = () => {
      fetch("/api/data")
        .then(r => r.json())
        .then(data => {
          if (data.deals) setDealsRaw(data.deals);
          if (data.taches) setTachesRaw(data.taches);
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  // Wrappers qui sauvegardent automatiquement
  const setDeals = (next: Deal[]) => {
    setDealsRaw(next);
    saveToServer(next, taches);
  };
  const setTaches = (next: Tache[]) => {
    setTachesRaw(next);
    saveToServer(deals, next);
  };

  const pendingTaches = taches.filter(t => !t.fait).length;
  const activeDeals = deals.filter(d => d.statut === "vert" || d.statut === "orange").length;

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: "var(--dark)" }}>
        <div className="text-center space-y-3">
          <div className="text-2xl font-bold tracking-widest" style={{ color: "var(--gold)" }}>LÉO ATLAS</div>
          <div className="flex gap-1.5 justify-center">
            {[0, 150, 300].map(d => (
              <div key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--gold)", animationDelay: `${d}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto" style={{ background: "var(--dark)" }}>
      {/* Header */}
      <div className="shrink-0 px-4 pt-12 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--gold)" }}>LÉO ATLAS</div>
            <div className="text-lg font-bold mt-0.5">Bonjour, François</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold" style={{ color: "var(--gold)" }}>{activeDeals}</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>dossiers actifs</div>
          </div>
        </div>

        {/* Objectifs rapides */}
        <div className="flex gap-2 mt-4">
          {[
            { n: 1, label: "Pipeline", color: "text-amber-400" },
            { n: 2, label: "Construction", color: "text-sky-400" },
            { n: 3, label: "Investisseurs", color: "text-emerald-400" },
          ].map(o => (
            <div key={o.n} className="flex-1 rounded-lg px-2 py-1.5 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className={`text-xs font-bold ${o.color}`}>#{o.n}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{o.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      {tab === "chat" ? (
        <div className="flex-1 min-h-0 px-4 pt-4 flex flex-col">
          <ChatTab />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pt-4">
          {tab === "pipeline" && <PipelineTab deals={deals} setDeals={setDeals} />}
          {tab === "taches" && <TachesTab taches={taches} setTaches={setTaches} />}
          {tab === "leads" && <LeadsTab />}
          {tab === "finances" && <FinancesTab deals={deals} />}
          {tab === "roadmap" && <RoadmapTab />}
        </div>
      )}

      {/* Bottom nav */}
      <div className="shrink-0 px-4 pb-8 pt-2" style={{ borderTop: "1px solid var(--border)", background: "var(--dark)" }}>
        <div className="flex gap-1 rounded-2xl p-1" style={{ background: "var(--card)" }}>
          {([
            { id: "pipeline", icon: "📊", label: "Pipeline", badge: activeDeals },
            { id: "leads", icon: "🎯", label: "Leads", badge: 0 },
            { id: "finances", icon: "$", label: "Finances", badge: 0 },
            { id: "roadmap", icon: "🗺", label: "Roadmap", badge: 0 },
            { id: "chat", icon: "⚡", label: "Chat", badge: 0 },
          ] as const).map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all relative"
              style={tab === item.id
                ? { background: "var(--gold)", color: "#000" }
                : { color: "var(--muted)" }
              }
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="text-xs font-semibold">{item.label}</span>
              {item.badge > 0 && tab !== item.id && (
                <span className="absolute top-1.5 right-3 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold" style={{ background: "var(--gold)", color: "#000" }}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
