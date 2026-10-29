"use client";
import { useState } from "react";

// ZOMBIE: no prices yet. Pick your prices, create matching Prices in Stripe (test mode),
// and show them here. Idea: charge per workspace, not per channel.
const PLANS = [
  { id: "creator", name: "Creator", price: "Set your price", perks: ["5 channels", "Queue and calendar", "Basic analytics"] },
  { id: "team", name: "Team", price: "Set your price", perks: ["Unlimited channels", "Team members and roles", "Approvals and full analytics"] },
];

export default function PricingPage() {
  const [error, setError] = useState("");

  async function buy(plan: string) {
    setError("");
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setError(data.error ?? "Checkout failed.");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pricing</h1>
          <p className="sub">Cheaper than the tool you&apos;re used to. Once Stripe works.</p>
        </div>
      </div>
      <div className="grid">
        {PLANS.map((p) => (
          <div key={p.id} className="card stack">
            <strong>{p.name}</strong>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{p.price}</div>
            <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
              {p.perks.map((perk) => <li key={perk}>{perk}</li>)}
            </ul>
            <button onClick={() => buy(p.id)}>Buy {p.name}</button>
          </div>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
    </>
  );
}
