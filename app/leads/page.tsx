"use client";

import { useState } from "react";

export default function LeadsPage() {
  const [form, setForm] = useState({
    prenom: "", nom: "", email: "", telephone: "",
    type: "vendeur", propriete: "", valeur: "", message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "formulaire_web" }),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div style={{ background: "#0A0A0A", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ maxWidth: "480px", width: "100%", textAlign: "center" }}>
          <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "#C9A84C", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: "36px" }}>
            ✓
          </div>
          <h2 style={{ color: "#C9A84C", fontSize: "24px", fontWeight: "700", marginBottom: "12px" }}>Message reçu</h2>
          <p style={{ color: "#999", fontSize: "16px", lineHeight: "1.6" }}>
            Merci pour votre intérêt. François Fortier vous contactera dans les plus brefs délais.
          </p>
          <p style={{ color: "#666", fontSize: "14px", marginTop: "24px" }}>
            Pour une réponse plus rapide : <span style={{ color: "#C9A84C" }}>514 621-5162</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #222", padding: "20px 24px" }}>
        <div style={{ maxWidth: "600px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#C9A84C", fontSize: "11px", fontWeight: "700", letterSpacing: "3px", textTransform: "uppercase" }}>François Fortier</div>
            <div style={{ color: "#FFF", fontSize: "14px", marginTop: "2px" }}>Courtier Immobilier Commercial</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#C9A84C", fontSize: "12px", fontWeight: "600" }}>514 621-5162</div>
            <div style={{ color: "#666", fontSize: "11px" }}>RE/MAX du Cartier</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "40px 24px" }}>
        {/* Hero */}
        <div style={{ marginBottom: "40px" }}>
          <div style={{ display: "inline-block", background: "#C9A84C", color: "#000", fontSize: "11px", fontWeight: "700", letterSpacing: "2px", padding: "6px 14px", borderRadius: "4px", marginBottom: "20px", textTransform: "uppercase" }}>
            Spécialiste Actifs Commerciaux 10M$+
          </div>
          <h1 style={{ color: "#FFF", fontSize: "32px", fontWeight: "800", lineHeight: "1.2", marginBottom: "16px" }}>
            Vous pensez à vendre ou acquérir un actif commercial?
          </h1>
          <p style={{ color: "#999", fontSize: "16px", lineHeight: "1.7" }}>
            Courtier immobilier commercial basé sur la Rive-Nord de Montréal. Spécialisé dans les transactions commerciales 10M$+ et les immeubles à revenus. Discrétion et efficacité garanties.
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "40px" }}>
          {[
            { val: "10M$+", label: "Transactions spécialisées" },
            { val: "Rive-Nord", label: "Marché cible" },
            { val: "6+ logements", label: "Investissement locatif" },
          ].map((s, i) => (
            <div key={i} style={{ background: "#111", border: "1px solid #222", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
              <div style={{ color: "#C9A84C", fontSize: "16px", fontWeight: "800" }}>{s.val}</div>
              <div style={{ color: "#666", fontSize: "11px", marginTop: "4px" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Formulaire */}
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: "20px", padding: "32px" }}>
          <h2 style={{ color: "#FFF", fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>Parlez-moi de votre projet</h2>
          <p style={{ color: "#666", fontSize: "14px", marginBottom: "28px" }}>Confidentiel — je vous réponds sous 24h</p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <input
                placeholder="Prénom"
                value={form.prenom}
                onChange={e => setForm({ ...form, prenom: e.target.value })}
                style={inputStyle}
              />
              <input
                placeholder="Nom *"
                required
                value={form.nom}
                onChange={e => setForm({ ...form, nom: e.target.value })}
                style={inputStyle}
              />
            </div>
            <input
              placeholder="Téléphone *"
              required
              type="tel"
              value={form.telephone}
              onChange={e => setForm({ ...form, telephone: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="Courriel"
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              style={inputStyle}
            />
            <select
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
              style={{ ...inputStyle, color: form.type ? "#FFF" : "#666" }}
            >
              <option value="vendeur">Je veux vendre un actif commercial</option>
              <option value="acheteur">Je cherche à acheter un actif commercial</option>
              <option value="investisseur">Je cherche un immeuble à revenus (6+ logements)</option>
              <option value="evaluation">Je veux une évaluation de ma propriété</option>
              <option value="autre">Autre demande</option>
            </select>
            <input
              placeholder="Description du bien (adresse, type, superficie...)"
              value={form.propriete}
              onChange={e => setForm({ ...form, propriete: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="Valeur estimée (ex: 5M$, 1.2M$...)"
              value={form.valeur}
              onChange={e => setForm({ ...form, valeur: e.target.value })}
              style={inputStyle}
            />
            <textarea
              placeholder="Message (optionnel — timing, contexte, questions...)"
              value={form.message}
              onChange={e => setForm({ ...form, message: e.target.value })}
              rows={3}
              style={{ ...inputStyle, resize: "vertical", minHeight: "80px" }}
            />
            <button
              type="submit"
              disabled={status === "loading"}
              style={{
                background: status === "loading" ? "#888" : "#C9A84C",
                color: "#000",
                border: "none",
                borderRadius: "12px",
                padding: "16px",
                fontSize: "15px",
                fontWeight: "700",
                cursor: status === "loading" ? "not-allowed" : "pointer",
                marginTop: "8px",
              }}
            >
              {status === "loading" ? "Envoi en cours..." : "Soumettre ma demande →"}
            </button>
            {status === "error" && (
              <p style={{ color: "#EF4444", fontSize: "13px", textAlign: "center" }}>
                Erreur. Appelez directement au 514 621-5162.
              </p>
            )}
          </form>
        </div>

        {/* LinkedIn */}
        <div style={{ marginTop: "32px", textAlign: "center" }}>
          <a
            href="https://linkedin.com/in/francois-fortier-837389299"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "#0A66C2", textDecoration: "none", fontSize: "14px", fontWeight: "600" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            Me rejoindre sur LinkedIn
          </a>
        </div>

        <div style={{ marginTop: "40px", paddingTop: "24px", borderTop: "1px solid #1A1A1A", textAlign: "center" }}>
          <p style={{ color: "#444", fontSize: "12px" }}>
            François Fortier · Courtier Immobilier Commercial · RE/MAX du Cartier · Blainville, QC
          </p>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#1A1A1A",
  border: "1px solid #2A2A2A",
  borderRadius: "10px",
  padding: "14px 16px",
  color: "#FFF",
  fontSize: "15px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};
