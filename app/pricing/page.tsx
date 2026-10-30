"use client";
import { useState, useEffect } from "react";
import { useMe } from "@/lib/useMe";
import { canManageBilling } from "@/lib/rbac";
import { FREE_TIER_CHANNELS } from "@/lib/config";

const PLANS = [
  { id: "free", name: "Free", price: "$0/mo", perks: [`${FREE_TIER_CHANNELS} channels`, "Queue and calendar", "Basic analytics"] },
  { id: "creator", name: "Creator", price: "$12/mo", perks: ["10 channels", "Queue and calendar", "Full analytics", "Export CSV"] },
  { id: "team", name: "Team", price: "$29/mo", perks: ["Unlimited channels", "Team members and roles", "Approvals and full analytics", "Priority support"] },
];

export default function PricingPage() {
  const me = useMe();
  const [error, setError] = useState("");
  const [portalUrl, setPortalUrl] = useState<string | null>(null);

  useEffect(() => {
    if (me && canManageBilling(me.role)) {
      fetch("/api/billing/portal").then((r) => r.ok ? r.json() : null).then((d) => {
        if (d?.url) setPortalUrl(d.url);
      });
    }
  }, [me]);

  async function buy(plan: string) {
    setError("");
    if (plan === "free") return;
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setError(data.detail ?? data.error ?? "Checkout failed.");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pricing</h1>
          <p className="sub">Choose the plan that fits your workspace.</p>
        </div>
        {portalUrl && (
          <a href={portalUrl} className="btn ghost">Manage billing</a>
        )}
      </div>
      <div className="grid">
        {PLANS.map((p) => (
          <div key={p.id} className="card stack">
            <strong>{p.name}</strong>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{p.price}</div>
            <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
              {p.perks.map((perk) => <li key={perk}>{perk}</li>)}
            </ul>
            {p.id !== "free" && me?.role !== "viewer" && (
              <button onClick={() => buy(p.id)}>Buy {p.name}</button>
            )}
            {p.id === "free" && <div className="muted small">Current plan or default</div>}
          </div>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
    </>
  );
}
