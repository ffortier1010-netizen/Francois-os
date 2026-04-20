"use client";

import { useState, useRef, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "vert" | "orange" | "rouge" | "noir";
type Tab = "pipeline" | "taches" | "chat" | "finances";

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
    <div className="flex flex-col h-full">
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

  // Chargement initial depuis le serveur
  useEffect(() => {
    fetch("/api/data")
      .then(r => r.json())
      .then(data => {
        if (data.deals) setDealsRaw(data.deals);
        if (data.taches) setTachesRaw(data.taches);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
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
      <div className="flex-1 overflow-y-auto px-4 pt-4" style={{ display: tab === "chat" ? "flex" : "block", flexDirection: "column" }}>
        {tab === "pipeline" && <PipelineTab deals={deals} setDeals={setDeals} />}
        {tab === "taches" && <TachesTab taches={taches} setTaches={setTaches} />}
        {tab === "chat" && <ChatTab />}
        {tab === "finances" && <FinancesTab deals={deals} />}
      </div>

      {/* Bottom nav */}
      <div className="shrink-0 px-4 pb-8 pt-2" style={{ borderTop: "1px solid var(--border)", background: "var(--dark)" }}>
        <div className="flex gap-1 rounded-2xl p-1" style={{ background: "var(--card)" }}>
          {([
            { id: "pipeline", icon: "📊", label: "Pipeline", badge: activeDeals },
            { id: "taches", icon: "✓", label: "Tâches", badge: pendingTaches },
            { id: "finances", icon: "$", label: "Finances", badge: 0 },
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
