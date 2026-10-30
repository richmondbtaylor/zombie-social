"use client";
import { useState } from "react";

export default function AnalyticsControls({
  canExport,
  sponsored,
  organic,
}: {
  canExport: boolean;
  sponsored: number;
  organic: number;
}) {
  const [showSponsored, setShowSponsored] = useState<"all" | "sponsored" | "organic">("all");
  const [msg, setMsg] = useState("");

  async function exportCsv() {
    setMsg("");
    const res = await fetch("/api/analytics/export?days=30");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMsg(body.detail ?? "Export failed.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "analytics.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <button className={showSponsored === "all" ? "small-btn" : "ghost small-btn"} onClick={() => setShowSponsored("all")}>All</button>
        <button className={showSponsored === "sponsored" ? "small-btn" : "ghost small-btn"} onClick={() => setShowSponsored("sponsored")}>Sponsored</button>
        <button className={showSponsored === "organic" ? "small-btn" : "ghost small-btn"} onClick={() => setShowSponsored("organic")}>Organic</button>
        {canExport && <button className="ghost small-btn" style={{ marginLeft: "auto" }} onClick={exportCsv}>Export CSV</button>}
      </div>
      {msg && <p className="error">{msg}</p>}
      {showSponsored !== "all" && (
        <div className="card" style={{ marginBottom: 16 }}>
          {showSponsored === "sponsored"
            ? `Sponsored impressions: ${sponsored.toLocaleString()}`
            : `Organic impressions: ${organic.toLocaleString()}`}
        </div>
      )}
    </>
  );
}
