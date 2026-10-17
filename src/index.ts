import { Type } from "typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

// Override for local testing: COINSEL_API_URL=http://localhost:3000/api/lowball-check
const API_URL = process.env.COINSEL_API_URL || "https://www.coinsel.io/api/lowball-check";
const TIMEOUT_MS = 15_000;

type Verdict = "lowball" | "below_fair" | "fair" | "strong";

interface LowballResult {
  coin: string;
  grade: string | null;
  offer_usd: number;
  retail_estimate_usd: number | null;
  melt_value_usd: number | null;
  offer_pct_of_retail: number | null;
  fair_offer_range_usd: [number, number] | null;
  verdict: Verdict | "unknown";
  comps_count: number;
  retail_basis?: "grade" | "adjacent_grade" | "price_guide" | null;
  retail_grade?: string | null;
  regional_note: string | null;
  summary: string;
  coin_url: string;
  signup_url: string;
}

const VERDICT_LABEL: Record<LowballResult["verdict"], string> = {
  lowball: "🚩 Lowball",
  below_fair: "⚠️ Below fair",
  fair: "✅ Fair offer",
  strong: "💰 Strong offer",
  unknown: "❓ Not enough data",
};

const usd = (n: number | null) =>
  n == null ? "n/a" : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

function retailLine(r: LowballResult): string {
  const v = usd(r.retail_estimate_usd);
  if (r.retail_estimate_usd == null) return "• Retail value: not enough data";
  switch (r.retail_basis) {
    case "price_guide":
      return `• Retail value: ${v} (PCGS price guide${r.retail_grade ? `, ${r.retail_grade}` : ""}; not enough recent sales)`;
    case "adjacent_grade":
      return `• Retail value: ${v} (from ${r.comps_count} recent ${r.retail_grade ?? "nearby-grade"} sales)`;
    default:
      return `• Retail value: ${v}${r.comps_count ? ` (median of ${r.comps_count} recent sales)` : ""}`;
  }
}

function format(r: LowballResult): string {
  const lines = [
    `${VERDICT_LABEL[r.verdict]}: ${usd(r.offer_usd)} for ${r.coin}${r.grade ? ` (${r.grade})` : ""}`,
    "",
    retailLine(r),
    `• Melt value: ${usd(r.melt_value_usd)}`,
    `• Offer is ${r.offer_pct_of_retail == null ? "n/a" : `${Math.round(r.offer_pct_of_retail)}%`} of retail`,
    `• Typical fair dealer offer: ${
      r.fair_offer_range_usd ? `${usd(r.fair_offer_range_usd[0])}–${usd(r.fair_offer_range_usd[1])}` : "n/a"
    }`,
  ];
  if (r.regional_note) lines.push(`• ${r.regional_note}`);
  lines.push("", r.summary, "", `Full comps & price history: ${r.coin_url}`);
  lines.push(`Track coins you own and get sell signals: ${r.signup_url}`);
  lines.push("", "Estimate only — not an appraisal or grade.");
  return lines.join("\n");
}

export default definePluginEntry({
  id: "coinsel-lowball",
  name: "Coinsel Lowball Check",
  description:
    "Tells you whether a dealer or pawn shop's cash offer for a coin is fair, using recent sold comps and melt value from coinsel.io.",
  register(api) {
    api.registerTool({
      name: "coin_lowball_check",
      label: "Coin Lowball Check",
      description:
        "Check whether a cash offer for a coin from a dealer, pawn shop, or buyer is fair. " +
        "Use when the user says something like 'a dealer offered me $X for my <coin>'. " +
        "Returns recent sold comps, melt value, the offer as a % of retail, a fair-offer range, and a verdict. " +
        "Pricing requires a grade. If the user hasn't given one, ask first whether the coin is in a PCGS/NGC holder " +
        "(and the grade on the label) or, if raw, its rough condition; translate that to a grade like 'VF20', 'AU50', 'MS60'. " +
        "If they can't say, call without a grade (melt-only check). Use only numbers from this tool's result; " +
        "if it reports not enough data, say so rather than estimating retail yourself.",
      parameters: Type.Object({
        coin: Type.String({
          description: "Coin as specifically as known: year, mint mark, denomination/type. e.g. '1881-S Morgan dollar'",
        }),
        offer_usd: Type.Number({ minimum: 0, description: "The cash amount offered, in US dollars" }),
        grade: Type.Optional(
          Type.String({ description: "Grade or condition if known, e.g. 'MS63', 'PCGS AU58', 'circulated'" }),
        ),
        zip: Type.Optional(
          Type.String({ description: "US ZIP code where the offer was made, for regional comparison" }),
        ),
        buyer_type: Type.Optional(
          Type.Union(
            [Type.Literal("dealer"), Type.Literal("pawn"), Type.Literal("coin_show"), Type.Literal("private"), Type.Literal("other")],
            { description: "Who made the offer" },
          ),
        ),
      }),
      async execute(_id, params) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
        try {
          const res = await fetch(API_URL, {
            method: "POST",
            headers: { "content-type": "application/json", "x-coinsel-client": "openclaw-plugin/1.0.0" },
            body: JSON.stringify(params),
            signal: ctrl.signal,
          });
          if (res.status === 429) {
            return {
              content: [{
                type: "text",
                text: "Daily free Lowball Checks used up. Run unlimited checks at https://www.coinsel.io/lowball-check?utm_source=openclaw",
              }],
              details: { error: "rate_limited" },
            };
          }
          if (!res.ok) throw new Error(`coinsel.io returned ${res.status}`);
          const data = (await res.json()) as LowballResult;
          return { content: [{ type: "text", text: format(data) }], details: data };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            content: [{
              type: "text",
              text: `Couldn't reach coinsel.io (${msg}). Try the web version: https://www.coinsel.io/lowball-check?utm_source=openclaw`,
            }],
            details: { error: msg },
          };
        } finally {
          clearTimeout(timer);
        }
      },
    });
  },
});
