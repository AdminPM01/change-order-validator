import { useState, useCallback } from "react";

// ── Demo data ────────────────────────────────────────────────────────────────
const DEMO_DATA = [
    { oz: "1. 2.  20.", kurztext: "Excavation for Foundation Pit up to Soil Class 4 with Disposal", menge: "1890.00", me: "m³", ep: "9,22", gesamt: "17.425,80", nNr: null, langtext: "Soil for Excavation Pits\n— Loosen, load, and transport in accordance with the specified profile.\n— The soil becomes the property of the Contractor.\n— Soil Classes 3 and 4." },
    { oz: "1. 2.  30.", kurztext: "Excavation for Foundation Pit up to Soil Class 4 including Side Storage", menge: "1500.00", me: "m³", ep: "10,47", gesamt: "15.705,00", nNr: null, langtext: "Soil for excavation pits:\nLoosen to profile, stockpile outside the excavation pit;\nSoil Classes 3 and 4." },
    { oz: "1. 2.  40.", kurztext: "Excavation for Isolated and Strip Foundations", menge: "59.00", me: "m³", ep: "15,93", gesamt: "939,87", nNr: null, langtext: "Excavation for individual and strip footings:\nexcavate to specified profile; excavated soil becomes the property of\nthe Contractor and must be removed;\nexcavation to commence following removal of topsoil;\nexcavation depth up to 1.10 m;\nsubgrade to be compacted (verification required);\ndegree of compaction DPr 100%;\nSoil Classes 3 and 4." },
    { oz: "1. 2.  50.", kurztext: "Subgrade Preparation for Base Slab", menge: "623.00", me: "m²", ep: "1,43", gesamt: "890,89", nNr: null, langtext: "Prepare the subgrade for the base slab.\nPermissible deviation from the target elevation:\n± 2 cm." },
    { oz: "1. 2.  60.", kurztext: "Backfilling of Foundation Pit", menge: "567.00", me: "m³", ep: "4,99", gesamt: "2.829,33", nNr: null, langtext: "Backfilling of the excavation pit using stockpiled excavated material for reuse, including compaction." },
    { oz: "90. 1.  10.", kurztext: "Cable Duct Excavation", menge: "0.00", me: null, ep: "0,00", gesamt: "0,00", nNr: "1", nStatus: "Angeboten", langtext: "Excavation of cable trench (Soil Class 4) to a depth of up to 1.2 m, including haulage and disposal costs." },
    { oz: "90. 2.  10.", kurztext: "Remove Topsoil and Store on Site", menge: "50.00", me: "m²", ep: "2,45", gesamt: "122,50", nNr: "2", nStatus: "Angeboten", langtext: "Strip topsoil (DIN 18 300) and stockpile laterally;\nAverage stripping depth: 30 cm; transport distance: up to 100 m.\nQuantity determination based on field measurement at the extraction site." },
    { oz: "90. 2.  20.", kurztext: "Excavation for Isolated and Strip Foundations", menge: "59.00", me: "m³", ep: "15,93", gesamt: "939,87", nNr: "2", nStatus: "Angeboten", langtext: "Excavation for individual and strip footings:\nexcavate to specified profile; excavated soil becomes the property of\nthe Contractor and must be removed;\nexcavation to commence following removal of topsoil;\nexcavation depth up to 1.10 m;\nsubgrade to be compacted (verification required);\ndegree of compaction DPr 100%;\nSoil Classes 3 and 4." },
    { oz: "90. 2.  30.", kurztext: "Excavation for Isolated and Strip Foundations", menge: "59.00", me: "m³", ep: "15,93", gesamt: "939,87", nNr: "2", nStatus: "Angeboten", langtext: "Excavation for individual and strip footings:\nexcavate to specified profile; excavated soil becomes the property of\nthe Contractor and must be removed;\nexcavation to commence following removal of topsoil;\nexcavation depth up to 1.10 m;\nsubgrade to be compacted (verification required);\ndegree of compaction DPr 100%;\nSoil Classes 3 and 4." },
];

// ── Text utils ────────────────────────────────────────────────────────────────
function normalize(text) {
    if (!text) return "";
    return text.toLowerCase().replace(/[\r\n]+/g, " ").replace(/[.,;:!?()\-–—/\\]/g, " ").replace(/\s+/g, " ").trim();
}
function tokenSimilarity(a, b) {
    const tokA = new Set(normalize(a).split(" ").filter(Boolean));
    const tokB = new Set(normalize(b).split(" ").filter(Boolean));
    if (!tokA.size || !tokB.size) return 0;
    const intersection = [...tokA].filter(t => tokB.has(t)).length;
    return Math.round((intersection / new Set([...tokA, ...tokB]).size) * 100);
}
function isSubstring(needle, haystack) {
    const n = normalize(needle), h = normalize(haystack);
    return n.length > 0 && h.includes(n);
}

// ── Validation engine ─────────────────────────────────────────────────────────
function runValidation(allRows, nachtragId, threshold = 80) {
    const nachtragPositions = allRows.filter(r => r.nNr && r.nNr.trim() === String(nachtragId).trim());
    const basePositions = allRows.filter(r => !r.nNr);

    const allMatches = [];
    for (const np of nachtragPositions) {
        const matches = [];
        for (const bp of basePositions) {
            const score = isSubstring(np.langtext, bp.langtext) ? 100 : tokenSimilarity(np.langtext, bp.langtext);
            if (score >= threshold) matches.push({ row: bp, score });
        }
        matches.sort((a, b) => b.score - a.score);
        // Always include every NP — zero matches means it's a genuinely new item
        allMatches.push({ np, matches, isNew: matches.length === 0 });
    }

    const lvOzGlobalCount = new Map();
    for (const { matches } of allMatches)
        for (const m of matches)
            lvOzGlobalCount.set(m.row.oz, (lvOzGlobalCount.get(m.row.oz) || 0) + 1);

    const result = [];
    for (const { np, matches, isNew } of allMatches) {
        result.push({ type: "Nachtragsposition", row: np, uebereinstimmung: null, duplikat: null, isNew });
        for (const m of matches) {
            const duplikat = (lvOzGlobalCount.get(m.row.oz) || 0) > 1 ? "Ja" : "Nein";
            result.push({ type: "Gefundene Position", row: m.row, uebereinstimmung: m.score, duplikat });
        }
    }
    return result;
}

// ── AI Report via Anthropic API ───────────────────────────────────────────────
async function generateAIReport(nachtragId, results) {
    const npRows = results.filter(r => r.type === "Nachtragsposition");
    const foundRows = results.filter(r => r.type === "Gefundene Position");
    const dupRows = foundRows.filter(r => r.duplikat === "Ja");
    const exact100 = foundRows.filter(r => r.uebereinstimmung === 100);

    // Build per-NP detail, clearly separating new items from flagged ones
    const positionDetail = npRows.map(np => {
        const npIdx = results.indexOf(np);
        const nextNpIdx = results.findIndex((r, i) => i > npIdx && r.type === "Nachtragsposition");
        const matches = results.filter((r, i) => r.type === "Gefundene Position" && i > npIdx && (nextNpIdx === -1 || i < nextNpIdx));
        if (np.isNew) {
            return `- OZ ${np.row.oz.trim()} "${np.row.kurztext}": NO MATCH FOUND — genuinely new item, not in base LV. Status: VALID NEW ITEM. Do NOT flag as duplicate.`;
        }
        const dupMatches = matches.filter(m => m.duplikat === "Ja");
        return `- OZ ${np.row.oz.trim()} "${np.row.kurztext}": matched LV positions [${matches.map(m => `${m.row.oz.trim()} at ${m.uebereinstimmung}% dup=${m.duplikat}`).join(", ")}]. ${dupMatches.length > 0 ? "RED FLAG: duplicate detected." : ""}`;
    }).join("\n");

    const prompt = `You are an AI assistant for construction change order validation (Nachtragsprüfung) in iTWO.

Nachtrag ID: ${nachtragId}

Position analysis (IMPORTANT: items marked "genuinely new" must NOT be flagged as red flags):
${positionDetail}

Write a concise validation report in English with exactly these 3 sections:
SUMMARY: 2-3 sentences on what was found overall.
RED FLAGS: Only list positions that have actual duplicate or exact-match issues. Do NOT list positions marked as genuinely new items here.
RECOMMENDED ACTIONS: Per flagged OZ only — what the user should do (remove / edit Langtext to differentiate). For genuinely new items, confirm they are valid and recommend APPROVE.

Be specific about OZ numbers. Under 220 words. Plain text only, no markdown.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            messages: [{ role: "user", content: prompt }],
        }),
    });
    const data = await response.json();
    return data.content?.[0]?.text || "Report generation failed.";
}

// ── Badges ────────────────────────────────────────────────────────────────────
function ScoreBadge({ score }) {
    if (score === null || score === undefined) return <span style={{ color: "#475569" }}>—</span>;
    const bg = score === 100 ? "#00c896" : score >= 90 ? "#4ade80" : "#facc15";
    return <span style={{ display: "inline-block", background: bg, color: "#0f172a", fontWeight: 700, fontSize: "11px", padding: "2px 8px", borderRadius: "99px" }}>{score}%</span>;
}
function DupBadge({ val }) {
    if (!val) return null;
    return <span style={{ display: "inline-block", background: val === "Ja" ? "#ef4444" : "#f1f5f9", color: val === "Ja" ? "#fff" : "#64748b", fontWeight: 600, fontSize: "11px", padding: "2px 8px", borderRadius: "4px", border: val === "Nein" ? "1px solid #e2e8f0" : "none" }}>{val}</span>;
}

// ── Highlighted Langtext ─────────────────────────────────────────────────────
function HighlightedText({ text, otherText, color }) {
    if (!text) return <span style={{ color: "#94a3b8", fontStyle: "italic" }}>—</span>;
    const sharedTokens = new Set(
        normalize(otherText || "").split(" ").filter(t => t.length > 3)
    );
    // Split text into words+whitespace tokens preserving original casing/spacing
    const parts = text.split(/(\s+)/);
    return (
        <span style={{ lineHeight: 1.8, fontSize: 12, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
            {parts.map((part, i) => {
                const isSpace = /^\s+$/.test(part);
                if (isSpace) return <span key={i}>{part}</span>;
                const norm = normalize(part);
                const isMatch = norm.length > 3 && sharedTokens.has(norm);
                return isMatch
                    ? <mark key={i} style={{ background: color === "blue" ? "#dbeafe" : "#fef9c3", color: color === "blue" ? "#1e40af" : "#854d0e", borderRadius: 3, padding: "0 2px", fontWeight: 600 }}>{part}</mark>
                    : <span key={i} style={{ color: "#374151" }}>{part}</span>;
            })}
        </span>
    );
}

// ── Action Panel ──────────────────────────────────────────────────────────────
function ActionPanel({ npItem, onAction, actionState }) {
    const [editText, setEditText] = useState(npItem.row.langtext || "");
    const [showEdit, setShowEdit] = useState(false);
    const state = actionState[npItem.row.oz];

    if (state === "approved") return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, marginTop: 8 }}>
            <span style={{ color: "#16a34a", fontSize: 16 }}>✓</span>
            <span style={{ color: "#16a34a", fontSize: 12, fontWeight: 600 }}>Approved — position accepted as valid change order</span>
        </div>
    );
    if (state === "removed") return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#fff5f5", border: "1px solid #7f1d1d", borderRadius: 8, marginTop: 8 }}>
            <span style={{ color: "#dc2626", fontSize: 16 }}>✕</span>
            <span style={{ color: "#dc2626", fontSize: 12, fontWeight: 600 }}>Removed — position flagged for deletion in iTWO</span>
        </div>
    );
    if (state && state.startsWith("edited:")) return (
        <div style={{ padding: "10px 14px", background: "#eff6ff", border: "1px solid #1e40af", borderRadius: 8, marginTop: 8 }}>
            <div style={{ color: "#1d4ed8", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>✎ Langtext updated — revalidation recommended</div>
            <div style={{ color: "#475569", fontSize: 11, whiteSpace: "pre-wrap" }}>{state.replace("edited:", "")}</div>
        </div>
    );

    return (
        <div style={{ marginTop: 8 }}>
            {/* Action buttons */}
            {!showEdit && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => onAction(npItem.row.oz, "approved")} style={{ background: "#16a34a", color: "#ffffff", border: "1px solid #15803d", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.3px" }}>
                        ✓ APPROVE
                    </button>
                    <button onClick={() => onAction(npItem.row.oz, "removed")} style={{ background: "#7f1d1d", color: "#fca5a5", border: "1px solid #991b1b", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.3px" }}>
                        ✕ REMOVE
                    </button>
                    <button onClick={() => setShowEdit(true)} style={{ background: "#dbeafe", color: "#93c5fd", border: "1px solid #1d4ed8", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.3px" }}>
                        ✎ EDIT LANGTEXT
                    </button>
                </div>
            )}
            {/* Edit langtext inline */}
            {showEdit && (
                <div style={{ background: "#f1f5f9", border: "1px solid #1d4ed8", borderRadius: 8, padding: "12px" }}>
                    <div style={{ fontSize: 10, color: "#1d4ed8", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>Edit Langtext — differentiate from existing LV position</div>
                    <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={6}
                        style={{ width: "100%", background: "#f8fafc", border: "1px solid #e2e8f0", color: "#1e293b", fontFamily: "'DM Mono', monospace", fontSize: 11, padding: "8px", borderRadius: 6, resize: "vertical", outline: "none" }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={() => { onAction(npItem.row.oz, "edited:" + editText); setShowEdit(false); }}
                            style={{ background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                            ✓ Save & Flag for Re-validation
                        </button>
                        <button onClick={() => setShowEdit(false)}
                            style={{ background: "none", color: "#64748b", border: "1px solid #334155", borderRadius: 6, padding: "6px 14px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Report Panel ──────────────────────────────────────────────────────────────
function ReportPanel({ nachtragId, results }) {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);

    const generate = async () => {
        setLoading(true);
        try {
            const text = await generateAIReport(nachtragId, results);
            setReport(text);
        } catch (e) {
            setReport("Error generating report: " + e.message);
        }
        setLoading(false);
    };

    const dupCount = results.filter(r => r.duplikat === "Ja").length;
    const exact100 = results.filter(r => r.uebereinstimmung === 100).length;

    return (
        <div style={{ margin: "0 32px 24px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
            {/* Report header */}
            <div style={{ background: "#f8fafc", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 18 }}>📋</span>
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>AI Validation Report — Nachtrag {nachtragId}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>Automated red-flag summary with recommended actions</div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    {dupCount > 0 && <span style={{ background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>⚠ {dupCount} DUPLICATE{dupCount > 1 ? "S" : ""}</span>}
                    {exact100 > 0 && <span style={{ background: "#dbeafe", color: "#93c5fd", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>🔍 {exact100} EXACT MATCH{exact100 > 1 ? "ES" : ""}</span>}
                </div>
            </div>

            {/* Report body */}
            <div style={{ padding: "16px 20px" }}>
                {!report && !loading && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1, fontSize: 12, color: "#64748b" }}>
                            Generate an AI-powered report explaining all findings, red flags, and recommended actions for each flagged position.
                        </div>
                        <button onClick={generate} style={{ background: "#1d4ed8", color: "#fff", border: "none", padding: "8px 20px", borderRadius: 6, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                            ▶ Generate Report
                        </button>
                    </div>
                )}
                {loading && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#64748b", fontSize: 12 }}>
                        <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #3b82f6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                        Generating AI validation report…
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                )}
                {report && (
                    <div style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.8, whiteSpace: "pre-wrap", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        {report}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── VE / Subcontractor Package list ──────────────────────────────────────────
const VE_LIST = [
    { id: "1.002", code: "1.002 (Auftr)", name: "Excavation Works", de: "Erdarbeiten" },
    { id: "1.009", code: "1.009 (Verg)", name: "Sewage Canal Works", de: "Kanalbauarbeiten" },
    { id: "3.000", code: "3.000 (Auss)", name: "Office Building", de: "Bürogebäude" },
    { id: "4.011", code: "4.011 (Auftr)", name: "Screed & Plastering Works", de: "Estrich- & Putzarbeiten" },
    { id: "4.021", code: "4.021 (Auftr)", name: "Tiles & Floor Coverings", de: "Fliesen & Bodenbeläge" },
    { id: "4.031", code: "4.031 (Auftr)", name: "Carpentry & Glazing Works", de: "Tischler- & Glasarbeiten" },
];

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
    const [selectedVE, setSelectedVE] = useState("1.002");
    const [nachtragId, setNachtragId] = useState("");
    const [threshold, setThreshold] = useState(80);
    const [results, setResults] = useState(null);
    const [expandedLangtexts, setExpandedLangtexts] = useState(new Set());
    const [hasRun, setHasRun] = useState(false);
    const [actionState, setActionState] = useState({});
    const [view, setView] = useState("table"); // "table" | "actions"

    const availableNachtraege = [...new Set(DEMO_DATA.filter(r => r.nNr).map(r => r.nNr.trim()))];

    const handleRun = useCallback(() => {
        if (!nachtragId) return;
        const res = runValidation(DEMO_DATA, nachtragId, threshold);
        setResults(res);
        setHasRun(true);
        setExpandedLangtexts(new Set());
        setActionState({});
        setView("table");
    }, [nachtragId, threshold]);

    const toggleLangtext = (idx) => {
        setExpandedLangtexts(prev => {
            const next = new Set(prev);
            next.has(idx) ? next.delete(idx) : next.add(idx);
            return next;
        });
    };

    const handleAction = (oz, action) => {
        setActionState(prev => ({ ...prev, [oz]: action }));
    };

    const npItems = results?.filter(r => r.type === "Nachtragsposition") ?? [];
    const foundCount = results?.filter(r => r.type === "Gefundene Position").length ?? 0;
    const dupCount = results?.filter(r => r.duplikat === "Ja").length ?? 0;
    const exact100 = results?.filter(r => r.uebereinstimmung === 100).length ?? 0;
    const actioned = Object.keys(actionState).length;
    const totalNP = npItems.length;

    return (
        <div style={{ minHeight: "100vh", width: "100%", background: "#f8fafc", color: "#0f172a", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", boxSizing: "border-box" }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html, body, #root { width:100%; min-height:100vh; margin:0; padding:0; overflow-x:hidden; }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background:#f1f5f9; }
        ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:3px; }
        .nachtrag-row { background:linear-gradient(90deg,#eff6ff,#f8fafc); border-left:3px solid #3b82f6; }
        .found-row { background:#ffffff; border-left:3px solid transparent; }
        .found-row:hover { background:#f8fafc; }
        tr.found-row td { border-bottom:1px solid #f1f5f9; }
        tr.nachtrag-row td { border-bottom:2px solid #bfdbfe; }
        select,input[type=number] { background:#ffffff; border:1px solid #e2e8f0; color:#1e293b; font-family:inherit; font-size:13px; padding:6px 10px; border-radius:6px; outline:none; }
        select:focus,input[type=number]:focus { border-color:#3b82f6; }
        .run-btn { background:#1d4ed8; color:#fff; border:none; padding:8px 24px; border-radius:6px; font-family:inherit; font-size:13px; font-weight:600; cursor:pointer; transition:background 0.15s; }
        .run-btn:hover { background:#2563eb; }
        .run-btn:disabled { background:#e2e8f0; color:#94a3b8; cursor:not-allowed; }
        .tab-btn { background:none; border:none; padding:8px 16px; font-family:inherit; font-size:11px; font-weight:600; cursor:pointer; letter-spacing:1px; text-transform:uppercase; border-bottom:2px solid transparent; transition:all 0.15s; color:#94a3b8; }
        .tab-btn.active { color:#3b82f6; border-bottom-color:#3b82f6; }
        .tab-btn:hover { color:#3b82f6; }
      `}</style>

            {/* Project context bar */}
            <div style={{ background: "#1e3a5f", padding: "9px 32px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                {/* Project */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 9, color: "#7dd3fc", fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase" }}>Project</span>
                    <span style={{ fontSize: 13, color: "#ffffff", fontWeight: 700, letterSpacing: "-0.2px" }}>AI iTWO Building Construction</span>
                </div>
                <div style={{ width: 1, height: 18, background: "#2d5a8e", flexShrink: 0 }} />
                {/* VE / SP dropdown */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 9, color: "#7dd3fc", fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", whiteSpace: "nowrap" }}>VE / SP</span>
                    <div style={{ position: "relative" }}>
                        <select
                            value={selectedVE}
                            onChange={e => { setSelectedVE(e.target.value); setResults(null); setHasRun(false); setNachtragId(""); }}
                            style={{
                                background: "#163d6e",
                                border: "1px solid #2d5a8e",
                                color: "#ffffff",
                                fontFamily: "'Plus Jakarta Sans', sans-serif",
                                fontSize: 12,
                                fontWeight: 600,
                                padding: "5px 32px 5px 12px",
                                borderRadius: 6,
                                outline: "none",
                                cursor: "pointer",
                                appearance: "none",
                                WebkitAppearance: "none",
                                minWidth: 300,
                            }}
                        >
                            {VE_LIST.map(ve => (
                                <option key={ve.id} value={ve.id} style={{ background: "#1e3a5f", color: "#ffffff" }}>
                                    {ve.code} — {ve.name} / {ve.de}
                                </option>
                            ))}
                        </select>
                        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#93c5fd", fontSize: 10 }}>▾</span>
                    </div>
                </div>
                {/* Active VE indicator */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: "#bfdbfe", letterSpacing: "0.3px", fontWeight: 500 }}>
                        Active: <strong style={{ color: "#ffffff" }}>VE {selectedVE}</strong> · {VE_LIST.find(v => v.id === selectedVE)?.de}
                    </span>
                </div>
            </div>

            {/* Header */}
            <div style={{ borderBottom: "1px solid #e2e8f0", padding: "16px 32px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ background: "#1d4ed8", width: 6, height: 36, borderRadius: 3 }} />
                <div>
                    <div style={{ fontSize: "10px", color: "#94a3b8", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 3, fontWeight: 600 }}>AI Change Order Validator</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.5px" }}>Nachtrag Validation Engine</div>
                </div>
            </div>

            {/* Controls */}
            <div style={{ padding: "16px 32px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: "10px", color: "#64748b", letterSpacing: "1px", textTransform: "uppercase" }}>Nachtrag ID</label>
                    <select value={nachtragId} onChange={e => setNachtragId(e.target.value)}>
                        <option value="">— Select —</option>
                        {availableNachtraege.map(n => <option key={n} value={n}>Nachtrag {n}</option>)}
                    </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: "10px", color: "#64748b", letterSpacing: "1px", textTransform: "uppercase" }}>Min. Match %</label>
                    <input type="number" min={50} max={100} value={threshold} onChange={e => setThreshold(Number(e.target.value))} style={{ width: 80 }} />
                </div>
                <div style={{ marginTop: 18 }}>
                    <button className="run-btn" disabled={!nachtragId} onClick={handleRun}>▶ Analyse starten</button>
                </div>

                {hasRun && results && (
                    <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {[
                            { val: npItems.length, label: "NT Positionen", color: "#3b82f6" },
                            { val: foundCount, label: "Gefundene Pos.", color: "#a78bfa" },
                            { val: exact100, label: "100% Matches", color: "#00c896" },
                            { val: dupCount, label: "Duplikate", color: dupCount > 0 ? "#ef4444" : "#475569" },
                        ].map(s => (
                            <div key={s.label} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 16px", minWidth: 90 }}>
                                <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div>
                                <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 4, letterSpacing: "0.8px", textTransform: "uppercase" }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Empty state */}
            {!hasRun && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 32px", gap: 12, color: "#94a3b8" }}>
                    <div style={{ fontSize: 48 }}>⚙</div>
                    <div style={{ fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Nachtrag ID wählen und Analyse starten</div>
                </div>
            )}

            {hasRun && results && results.length === 0 && (
                <div style={{ padding: "60px 32px", textAlign: "center", color: "#64748b", fontSize: 13 }}>
                    Keine Nachtragspositionen für Nachtrag {nachtragId} gefunden.
                </div>
            )}

            {hasRun && results && results.length > 0 && (
                <>
                    {/* Tabs */}
                    <div style={{ padding: "0 32px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 0, marginTop: 8 }}>
                        <button className={`tab-btn${view === "table" ? " active" : ""}`} onClick={() => setView("table")}>📊 Results Table</button>
                        <button className={`tab-btn${view === "actions" ? " active" : ""}`} onClick={() => setView("actions")}>
                            ⚡ Review & Actions
                            {actioned > 0 && <span style={{ marginLeft: 6, background: "#1d4ed8", color: "#fff", fontSize: 9, padding: "1px 6px", borderRadius: 99 }}>{actioned}/{totalNP}</span>}
                        </button>
                    </div>

                    {/* ── TABLE VIEW ── */}
                    {view === "table" && (
                        <div style={{ overflowX: "auto", padding: "20px 32px 32px" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", tableLayout: "auto" }}>
                                <colgroup>
                                    <col style={{ width: "150px" }} /><col style={{ width: "50px" }} /><col style={{ width: "110px" }} />
                                    <col style={{ width: "18%" }} /><col style={{ width: "24%" }} /><col style={{ width: "70px" }} />
                                    <col style={{ width: "42px" }} /><col style={{ width: "70px" }} /><col style={{ width: "90px" }} />
                                    <col style={{ width: "110px" }} /><col style={{ width: "70px" }} />
                                </colgroup>
                                <thead>
                                    <tr style={{ background: "#f1f5f9", color: "#64748b", fontSize: "10px", letterSpacing: "1px", textTransform: "uppercase" }}>
                                        {["Typ", "LV", "OZ", "Kurztext", "Langtext", "Menge", "ME", "EP", "Gesamtbetrag", "Übereinstimmung", "Duplikat"].map(h => (
                                            <th key={h} style={{ padding: "10px", textAlign: "left", fontWeight: 600, borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((item, idx) => {
                                        const isNP = item.type === "Nachtragsposition";
                                        const r = item.row;
                                        const lt = r.langtext || "";
                                        const expanded = expandedLangtexts.has(idx);
                                        return (
                                            <tr key={idx} className={isNP ? "nachtrag-row" : "found-row"}>
                                                <td style={{ padding: "9px 10px", fontWeight: isNP ? 700 : 400, color: isNP ? "#1d4ed8" : "#64748b", whiteSpace: "nowrap" }}>
                                                    {isNP
                                                        ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.isNew ? "#16a34a" : "#3b82f6", display: "inline-block", flexShrink: 0 }} />
                                                            <span>Nachtragsposition</span>
                                                        </span>
                                                        : <span style={{ paddingLeft: 12, color: "#64748b" }}>↳ Gefundene Pos.</span>}
                                                </td>
                                                <td style={{ padding: "9px 10px", color: "#64748b" }}>{isNP ? (r.nNr ? `N${r.nNr.trim()}` : "—") : "LV"}</td>
                                                <td style={{ padding: "9px 10px", color: isNP ? "#1e293b" : "#64748b", fontWeight: isNP ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'DM Mono', monospace", fontSize: "11px" }}>{r.oz}</td>
                                                <td style={{ padding: "9px 10px", color: isNP ? "#0f172a" : "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.kurztext}>{r.kurztext}</td>
                                                <td style={{ padding: "9px 10px", maxWidth: 260 }}>
                                                    <span style={{ display: "block", whiteSpace: expanded ? "pre-wrap" : "nowrap", overflow: "hidden", textOverflow: expanded ? "clip" : "ellipsis", color: isNP ? "#1e293b" : "#475569", maxWidth: 240, wordBreak: "break-word" }}>{lt || "—"}</span>
                                                    {lt.length > 60 && <button onClick={() => toggleLangtext(idx)} style={{ background: "none", border: "1px solid #334155", color: "#64748b", fontSize: "10px", padding: "1px 6px", borderRadius: 3, cursor: "pointer", marginTop: 4, fontFamily: "inherit" }}>{expanded ? "▲ less" : "▼ more"}</button>}
                                                </td>
                                                <td style={{ padding: "9px 10px", color: "#64748b", textAlign: "right" }}>{r.menge ?? "—"}</td>
                                                <td style={{ padding: "9px 10px", color: "#64748b" }}>{r.me ?? "—"}</td>
                                                <td style={{ padding: "9px 10px", color: "#64748b", textAlign: "right" }}>{r.ep ?? "—"}</td>
                                                <td style={{ padding: "9px 10px", color: "#64748b", textAlign: "right", whiteSpace: "nowrap" }}>{r.gesamt ?? "—"}</td>
                                                <td style={{ padding: "9px 10px", textAlign: "center" }}>
                                                    {isNP
                                                        ? item.isNew
                                                            ? <span style={{ display: "inline-block", background: "#f0fdf4", color: "#16a34a", fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 99, border: "1px solid #bbf7d0" }}>✓ New</span>
                                                            : <span style={{ color: "#cbd5e1" }}>—</span>
                                                        : <ScoreBadge score={item.uebereinstimmung} />}
                                                </td>
                                                <td style={{ padding: "9px 10px", textAlign: "center" }}>{isNP ? null : <DupBadge val={item.duplikat} />}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div style={{ marginTop: 20, display: "flex", gap: 20, flexWrap: "wrap", fontSize: "11px", color: "#64748b" }}>
                                <span><span style={{ color: "#00c896" }}>█</span> 100% exact substring match</span>
                                <span><span style={{ color: "#4ade80" }}>█</span> 90–99% very high similarity</span>
                                <span><span style={{ color: "#facc15" }}>█</span> 80–89% high similarity</span>
                                <span><span style={{ color: "#ef4444" }}>█</span> Duplicate — same LV position matched by multiple NT positions</span>
                            </div>
                        </div>
                    )}

                    {/* ── ACTIONS VIEW ── */}
                    {view === "actions" && (
                        <div style={{ padding: "20px 0 40px" }}>
                            {/* AI Report */}
                            <ReportPanel nachtragId={nachtragId} results={results} />

                            {/* Progress bar */}
                            {totalNP > 0 && (
                                <div style={{ margin: "0 32px 20px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 16px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                        <span style={{ fontSize: 11, color: "#64748b", letterSpacing: "1px", textTransform: "uppercase" }}>Review Progress</span>
                                        <span style={{ fontSize: 11, color: "#64748b" }}>{actioned} / {totalNP} positions reviewed</span>
                                    </div>
                                    <div style={{ background: "#e2e8f0", borderRadius: 99, height: 6 }}>
                                        <div style={{ background: "#1d4ed8", height: 6, borderRadius: 99, width: `${(actioned / totalNP) * 100}%`, transition: "width 0.3s" }} />
                                    </div>
                                </div>
                            )}

                            {/* Per-position action cards */}
                            <div style={{ padding: "0 32px", display: "flex", flexDirection: "column", gap: 16 }}>
                                {npItems.map((npItem, i) => {
                                    const npMatches = results.filter((r, idx) => {
                                        if (r.type !== "Gefundene Position") return false;
                                        // find matches that belong to this NP (between this NP and next NP)
                                        const npIdxInResults = results.indexOf(npItem);
                                        const nextNpIdx = results.findIndex((rr, ii) => ii > npIdxInResults && rr.type === "Nachtragsposition");
                                        return idx > npIdxInResults && (nextNpIdx === -1 || idx < nextNpIdx);
                                    });
                                    const hasDup = npMatches.some(m => m.duplikat === "Ja");
                                    const has100 = npMatches.some(m => m.uebereinstimmung === 100);
                                    const st = actionState[npItem.row.oz];

                                    return (
                                        <div key={i} style={{ background: "#ffffff", border: `1px solid ${hasDup ? "#fca5a5" : npItem.isNew ? "#86efac" : "#e2e8f0"}`, borderRadius: 10, overflow: "hidden" }}>
                                            {/* Card header */}
                                            <div style={{ background: hasDup ? "#fff5f5" : npItem.isNew ? "#f0fdf4" : "#f8fafc", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #e2e8f0" }}>
                                                <div style={{ width: 32, height: 32, borderRadius: 6, background: hasDup ? "#fee2e2" : npItem.isNew ? "#dcfce7" : "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                                                    {hasDup ? "⚠" : npItem.isNew ? "✅" : "🔍"}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: hasDup ? "#dc2626" : npItem.isNew ? "#16a34a" : "#1d4ed8" }}>
                                                        OZ {npItem.row.oz.trim()} — {npItem.row.kurztext}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                                                        {hasDup && "🚩 DUPLICATE FLAG — "}
                                                        {has100 && !hasDup && "100% match with existing LV position — "}
                                                        {npItem.isNew ? "✅ No match found — genuinely new change order item" : `${npMatches.length} match${npMatches.length !== 1 ? "es" : ""} found`}
                                                    </div>
                                                </div>
                                                {/* Key figures */}
                                                <div style={{ display: "flex", gap: 0, borderLeft: "1px solid #e2e8f0", paddingLeft: 16, marginLeft: 4 }}>
                                                    {[
                                                        { label: "Menge", value: npItem.row.menge ?? "—", unit: npItem.row.me ?? "" },
                                                        { label: "EP", value: npItem.row.ep ?? "—", unit: "€" },
                                                        { label: "Gesamt", value: npItem.row.gesamt ?? "—", unit: "€" },
                                                    ].map((f, fi) => (
                                                        <div key={fi} style={{ textAlign: "right", paddingLeft: 20, paddingRight: fi < 2 ? 20 : 0, borderRight: fi < 2 ? "1px solid #f1f5f9" : "none" }}>
                                                            <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: "1px", textTransform: "uppercase", fontWeight: 600, marginBottom: 3 }}>{f.label}</div>
                                                            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>{f.value}</div>
                                                            {f.unit && <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 1 }}>{f.unit}</div>}
                                                        </div>
                                                    ))}
                                                </div>
                                                {st && (
                                                    <div style={{ borderLeft: "1px solid #e2e8f0", paddingLeft: 16, marginLeft: 4 }}>
                                                        <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 99, background: st === "approved" ? "#f0fdf4" : st === "removed" ? "#fff5f5" : "#eff6ff", color: st === "approved" ? "#16a34a" : st === "removed" ? "#dc2626" : "#1d4ed8", border: `1px solid ${st === "approved" ? "#86efac" : st === "removed" ? "#fca5a5" : "#93c5fd"}` }}>
                                                            {st === "approved" ? "✓ APPROVED" : st === "removed" ? "✕ REMOVED" : "✎ EDITED"}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Matched positions with Langtext comparison */}
                                            {npMatches.length > 0 && (
                                                <div style={{ borderBottom: "1px solid #f1f5f9" }}>
                                                    <div style={{ padding: "10px 16px 6px", fontSize: 9, color: "#64748b", letterSpacing: "1px", textTransform: "uppercase", fontWeight: 700 }}>Matched LV Positions</div>
                                                    {npMatches.map((m, mi) => (
                                                        <div key={mi} style={{ borderTop: mi > 0 ? "1px solid #f1f5f9" : "none" }}>
                                                            {/* Match meta row */}
                                                            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 16px", flexWrap: "wrap" }}>
                                                                <ScoreBadge score={m.uebereinstimmung} />
                                                                <DupBadge val={m.duplikat} />
                                                                <span style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Mono',monospace", minWidth: 80 }}>{m.row.oz.trim()}</span>
                                                                <span style={{ fontSize: 12, color: "#475569", flex: 1 }}>{m.row.kurztext}</span>
                                                                <div style={{ display: "flex", gap: 16 }}>
                                                                    {[
                                                                        { label: "Menge", value: `${m.row.menge ?? "—"} ${m.row.me ?? ""}` },
                                                                        { label: "EP", value: `${m.row.ep ?? "—"} €` },
                                                                        { label: "Gesamt", value: `${m.row.gesamt ?? "—"} €` },
                                                                    ].map((f, fi) => (
                                                                        <div key={fi} style={{ textAlign: "right" }}>
                                                                            <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600 }}>{f.label}</div>
                                                                            <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", fontFamily: "'DM Mono',monospace" }}>{f.value}</div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            {/* Side-by-side Langtext comparison */}
                                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, margin: "0 16px 12px", borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
                                                                <div style={{ background: "#fffbeb", borderRight: "1px solid #e2e8f0", padding: "10px 14px" }}>
                                                                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#92400e", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                                                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                                                                        NT Position — OZ {npItem.row.oz.trim()}
                                                                    </div>
                                                                    <HighlightedText text={npItem.row.langtext} otherText={m.row.langtext} color="yellow" />
                                                                </div>
                                                                <div style={{ background: "#eff6ff", padding: "10px 14px" }}>
                                                                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#1e40af", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                                                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", display: "inline-block" }} />
                                                                        LV Position — OZ {m.row.oz.trim()}
                                                                    </div>
                                                                    <HighlightedText text={m.row.langtext} otherText={npItem.row.langtext} color="blue" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Langtext for new items (no match to compare) */}
                                            {npItem.isNew && (
                                                <div style={{ margin: "0 16px 12px", borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
                                                    <div style={{ background: "#f0fdf4", padding: "10px 14px" }}>
                                                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#166534", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                                                            NT Position Langtext — OZ {npItem.row.oz.trim()}
                                                        </div>
                                                        <span style={{ lineHeight: 1.8, fontSize: 12, color: "#374151", whiteSpace: "pre-wrap" }}>{npItem.row.langtext || "—"}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Recommendation */}
                                            <div style={{ padding: "10px 16px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
                                                <div style={{ fontSize: 9, color: "#64748b", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>AI Recommendation</div>
                                                <div style={{ fontSize: 13, color: hasDup ? "#b45309" : npItem.isNew ? "#15803d" : "#475569", lineHeight: 1.7 }}>
                                                    {npItem.isNew
                                                        ? "✅ No match found in the base LV for this Langtext. This appears to be a genuinely new scope item. APPROVE to accept it as a valid change order position."
                                                        : hasDup && has100
                                                            ? `🚩 This position is an exact duplicate of LV position ${npMatches.find(m => m.uebereinstimmung === 100)?.row.oz.trim()}. Either REMOVE it if it is redundant, or EDIT the Langtext to clearly describe the additional scope that differentiates this change order from the base contract item.`
                                                            : has100
                                                                ? `⚠ Exact Langtext match found with an existing LV position. Verify whether this represents genuinely new scope. If yes, EDIT Langtext to add differentiating details. If not, REMOVE it.`
                                                                : `ℹ High text similarity detected. Review whether the described work is sufficiently different from the existing LV position. APPROVE if scope is distinct, or EDIT Langtext to clarify.`}
                                                </div>
                                            </div>

                                            {/* Action buttons */}
                                            <div style={{ padding: "12px 16px" }}>
                                                <ActionPanel npItem={npItem} onAction={handleAction} actionState={actionState} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Final submit */}
                            {actioned === totalNP && totalNP > 0 && (
                                <div style={{ margin: "24px 32px 0", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                                    <span style={{ fontSize: 24 }}>✓</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>All positions reviewed</div>
                                        <div style={{ fontSize: 11, color: "#15803d", marginTop: 2 }}>
                                            {Object.entries(actionState).map(([oz, st]) => `${oz.trim()}: ${st.startsWith("edited:") ? "Edited" : st}`).join(" · ")}
                                        </div>
                                    </div>
                                    <button style={{ background: "#16a34a", color: "#ffffff", border: "1px solid #15803d", borderRadius: 6, padding: "8px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                        📤 Export to iTWO
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}