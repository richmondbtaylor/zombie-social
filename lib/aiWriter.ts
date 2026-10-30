import type { Platform } from "@/lib/db";
import { LIMITS } from "@/lib/channels";

export type Tone = "conversational" | "informal" | "professional";

export const POSTURE_PROMPTS: Record<Tone, string> = {
  conversational:
    "warm and chatty, like talking to a regular customer. Use \"we\" and \"you\". End with one light question or invitation.",
  informal:
    "fun and casual. Short punchy sentences. An emoji or two is fine. Keep it playful but clear.",
  professional:
    "polished and confident. No slang, no emoji. Lead with the key point, add one supporting detail, end with a clear call to action.",
};

/** Character budget = strictest selected platform. */
export function budgetFor(platforms: Platform[]): number {
  return Math.min(...platforms.map((p) => LIMITS[p] ?? 280));
}

/** Trim to budget at a word boundary, marking the cut with an ellipsis. */
export function trimToBudget(body: string, budget: number): string {
  if (body.length <= budget) return body;
  const cut = body.slice(0, budget);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > budget * 0.6 ? cut.slice(0, lastSpace) : cut;
  return trimmed.replace(/[\s,—-]+$/, "") + "…";
}

export function buildPrompt(opts: {
  brief?: string;
  original?: string;
  tone: Tone;
  platforms: Platform[];
  sponsored: boolean;
  samples?: string[];
}): string {
  const { brief, original, tone, platforms, sponsored, samples = [] } = opts;
  const limits = platforms.map((p) => `${p} max ${LIMITS[p]} characters`).join(", ");
  const parts = [
    original
      ? `Rewrite this social media post in a different voice: "${original}".`
      : `Write one social media post for a small business based on this brief: "${brief}".`,
    `Tone: ${POSTURE_PROMPTS[tone]}`,
    `It will go to: ${limits}. Use the strictest limit (${budgetFor(platforms)} characters) as your budget.`,
    sponsored
      ? "It is a paid partnership: mention the partner naturally and the hashtag #ad must appear."
      : "No hashtags unless one is essential.",
  ];
  if (samples.length) {
    parts.push(`Match the brand's voice. Recent posts for reference:\n${samples.map((s) => `- ${s}`).join("\n")}`);
  }
  parts.push("Return only the post text, no quotes, no explanations.");
  return parts.join(" ");
}

/** Shared LLM call. Returns null when no key is configured or the call fails. */
async function callLlm(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.8,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = String(data.choices?.[0]?.message?.content ?? "").trim().replace(/^["“]|["”]$/g, "");
    return text || null;
  } catch {
    return null;
  }
}

// ─── Built-in fallback writer (no API key required) ──────────────────────────

function titleCaseLead(s: string): string {
  const clean = s.trim().replace(/\s+/g, " ").replace(/[.。!！?？]+$/, "");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function firstSentence(s: string): string {
  const m = s.trim().match(/^[^.!?]+[.!?]/);
  const out = m ? m[0] : s.trim();
  return /[.!?]$/.test(out) ? out : out + ".";
}

function keywords(text: string): string[] {
  const stop = new Set([
    "the", "and", "our", "are", "for", "with", "this", "that", "from", "you", "your",
    "will", "have", "has", "was", "were", "not", "but", "all", "can", "get", "new",
    "com", "http", "https", "www", "example",
  ]);
  return [...new Set(
    text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/)
      .filter((w) => w.length > 3 && !stop.has(w)),
  )].slice(0, 4);
}

function fallbackBody(original: string, tone: Tone, samples: string[]): string {
  const lead = titleCaseLead(original);
  const kw = keywords(original);

  // Borrow a closing line from the workspace's own history when we have one.
  const prior = samples[Math.floor(Math.random() * Math.max(samples.length, 1))];
  const priorTail = prior ? prior.split(/[.!?]\s/).filter(Boolean).pop() ?? "" : "";

  if (tone === "conversational") {
    const invite = kw[0] ? `Come see what's up with ${kw[0]}, or ask us anything.` : "Swing by and see for yourself.";
    const echo = priorTail ? `\n\n${titleCaseLead(priorTail)}.` : "";
    return `${lead} — we thought you'd want to know.\n\n${invite}${echo} What do you think?`;
  }
  if (tone === "informal") {
    const hook = kw[0] ? `it's about ${kw[0]}` : "you don't want to miss it";
    return `${lead}! 🎉\n\nQuick one — ${hook}. Pop in this week.`;
  }
  const detail = kw.length ? `This reflects our focus on ${kw.slice(0, 2).join(" and ")}.` : "We're pleased to share this with you.";
  return `${firstSentence(lead)} ${detail}\n\nVisit us or follow the link below to learn more.`;
}

function applySponsored(body: string, sponsored: boolean): string {
  if (!sponsored) return body;
  return /#ad\b/i.test(body) ? body : `${body} #ad`;
}

/** Draft from a brief. Prefers the LLM, falls back to the built-in composer. */
export async function draftFromBrief(
  brief: string,
  tone: Tone,
  platforms: Platform[],
  sponsored: boolean,
  samples: string[] = [],
): Promise<{ text: string; source: "llm" | "builtin" }> {
  const prompt = buildPrompt({ brief, tone, platforms, sponsored, samples });
  const llm = await callLlm(prompt);
  if (llm) return { text: trimToBudget(llm, budgetFor(platforms)), source: "llm" };
  const body = applySponsored(fallbackBody(brief, tone, samples), sponsored);
  return { text: trimToBudget(body, budgetFor(platforms)), source: "builtin" };
}

/** Rewrite an existing post in a new tone, using history as voice reference. */
export async function rewriteDraft(
  original: string,
  tone: Tone,
  samples: string[],
  platforms: Platform[],
  sponsored: boolean,
): Promise<string | null> {
  const prompt = buildPrompt({ original, tone, platforms, sponsored, samples });
  const llm = await callLlm(prompt);
  if (llm) return trimToBudget(llm, budgetFor(platforms));
  const body = applySponsored(fallbackBody(original, tone, samples), sponsored);
  return trimToBudget(body, budgetFor(platforms));
}
