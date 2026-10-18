import { Type } from "typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const VERSION = "1.1.0";
// Override for local testing: COINSEL_API_BASE=http://localhost:3000
const API_BASE = process.env.COINSEL_API_BASE || "https://www.coinsel.io";
const CHECK_URL = `${API_BASE}/api/lowball-check`;
const OUTCOME_URL = `${API_BASE}/api/lowball-outcome`;
const WEB_URL = "https://www.coinsel.io/lowball-check?utm_source=openclaw";
const TIMEOUT_MS = 15_000;

type Verdict = "lowball" | "below_fair" | "fair" | "strong" | "unknown";

interface Dealer { name: string; city?: string; distance_mi?: number; url?: string }
interface Show { name: string; date?: string; city?: string; url?: string }

interface LowballResult {
  check_id?: string;
  coin: string;
  grade: string | null;
  offer_usd: number;
  retail_estimate_usd: number | null;
  melt_value_usd: number | null;
  offer_pct_of_retail: number | null;
  fair_offer_range_usd: [number, number] | null;
  verdict: Verdict;
  comps_count: number;
  retail_basis?: "grade" | "adjacent_grade" | "price_guide" | null;
  retail_grade?: string | null;
  raw_adjusted?: boolean;
  regional_note: string | null;
  counter_offer?: { amount_usd: number; script: string } | null;
  better_offer?: {
    regional_avg_pct?: number | null;
    dealers?: Dealer[];
    shows?: Show[];
    local_url?: string;
  } | null;
  summary: string;
  coin_url: string;
  signup_url: string;
}

const VERDICT_LABEL: Record<Verdict, string> = {
  lowball: "🚩 Lowball",
  below_fair: "⚠️ Below fair",
  fair: "✅ Fair offer",
  strong: "💰 Strong offer",
  unknown: "❓ Not enough data",
};

const usd = (n: number | null | undefined) =>
  n == null ? "n/a" : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

function retailLine(r: LowballResult): string {
  if (r.retail_estimate_usd == null) return "• Retail value: not enough data";
  const v = usd(r.retail_estimate_usd);
  const raw = r.raw_adjusted ? ", adjusted for an uncertified coin" : "";
  switch (r.retail_basis) {
    case "price_guide":
      return `• Retail value: ${v} (PCGS price guide${r.retail_grade ? `, ${r.retail_grade}` : ""}${raw}; not enough recent sales)`;
    case "adjacent_grade":
      return `• Retail value: ${v} (from ${r.comps_count} recent ${r.retail_grade ?? "nearby-grade"} sales${raw})`;
    default:
      return `• Retail value: ${v}${r.comps_count ? ` (median of ${r.comps_count} recent sales${raw})` : raw ? ` (${raw.slice(2)})` : ""}`;
  }
}

function betterOfferLines(r: LowballResult): string[] {
  const b = r.better_offer;
  if (!b) return [];
  const out: string[] = ["", "Where to get a better offer:"];
  if (b.regional_avg_pct != null) out.push(`• Buyers near you typically pay about ${Math.round(b.regional_avg_pct)}% of retail.`);
  for (const d of (b.dealers ?? []).slice(0, 3)) {
    const dist = d.distance_mi != null ? ` (${d.distance_mi.toFixed(1)} mi)` : "";
    out.push(`• Dealer: ${d.name}${d.city ? `, ${d.city}` : ""}${dist}${d.url ? ` — ${d.url}` : ""}`);
  }
  for (const s of (b.shows ?? []).slice(0, 2)) {
    out.push(`• Coin show: ${s.name}${s.date ? `, ${s.date}` : ""}${s.city ? `, ${s.city}` : ""}${s.url ? ` — ${s.url}` : ""}`);
  }
  if (b.local_url) out.push(`• More dealers and shows near you: ${b.local_url}`);
  return out.length > 2 ? out : [];
}

function format(r: LowballResult): string {
  const lines = [
    `${VERDICT_LABEL[r.verdict] ?? VERDICT_LABEL.unknown}: ${usd(r.offer_usd)} for ${r.coin}${r.grade ? ` (${r.grade})` : ""}`,
    "",
    retailLine(r),
    `• Melt value: ${usd(r.melt_value_usd)}`,
    `• Offer is ${r.offer_pct_of_retail == null ? "n/a" : `${Math.round(r.offer_pct_of_retail)}%`} of retail`,
    `• Typical fair dealer offer: ${
      r.fair_offer_range_usd ? `${usd(r.fair_offer_range_usd[0])}–${usd(r.fair_offer_range_usd[1])}` : "n/a"
    }`,
  ];
  if (r.regional_note) lines.push(`• ${r.regional_note}`);
  lines.push("", r.summary);
  if (r.counter_offer) {
    lines.push("", `Counter at ${usd(r.counter_offer.amount_usd)}. What to say: "${r.counter_offer.script}"`);
  }
  lines.push(...betterOfferLines(r));
  lines.push("", `Full comps & price history: ${r.coin_url}`);
  lines.push(`Track coins you own and get sell signals: ${r.signup_url}`);
  if (r.check_id) lines.push("", `Check ID: ${r.check_id} (tell me what you end up doing and I'll log the result)`);
  lines.push("Estimate only — not an appraisal or grade.");
  return lines.join("\n");
}

async function postJson(url: string, body: unknown): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-coinsel-client": `openclaw-plugin/${VERSION}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));

export default definePluginEntry({
  id: "coinsel-lowball",
  name: "Coinsel Lowball Check",
  description:
    "Tells you whether a dealer or pawn shop's cash offer for a coin is fair, using recent sold comps, the PCGS price guide and melt value from coinsel.io, and where to get a better offer nearby.",
  register(api) {
    api.registerTool({
      name: "coin_lowball_check",
      label: "Coin Lowball Check",
      description:
        "Check whether a cash offer for a coin from a dealer, pawn shop, coin show or private buyer is fair. " +
        "Use when the user says something like 'a dealer offered me $X for my <coin>'. " +
        "Returns retail value, melt value, the offer as a % of retail, a fair-offer range, a verdict, a suggested counter-offer, " +
        "and nearby dealers and coin shows when the offer is low. " +
        "Pricing requires a grade. If the user hasn't given one, first ask whether the coin is in a PCGS/NGC/ANACS/ICG holder " +
        "(and the grade on the label) or, if raw, its rough condition; translate that to a grade like 'VF20', 'AU50', 'MS60'. " +
        "Set certified=false for raw coins. If they can't say, call without a grade (melt-only check). " +
        "Ask for a ZIP code if they want local dealers and shows. " +
        "Use only numbers from this tool's result; if it reports not enough data, say so rather than estimating retail yourself. " +
        "Always include the counter-offer, the nearby dealers/shows if present, and both coinsel links in your reply. " +
        "Keep the Check ID: if the user later says whether they sold and for how much, call coin_offer_outcome with it.",
      parameters: Type.Object({
        coin: Type.String({
          description: "Coin as specifically as known: year, mint mark, denomination/type. e.g. '1881-S Morgan dollar'",
        }),
        offer_usd: Type.Number({ minimum: 0, description: "The cash amount offered, in US dollars" }),
        grade: Type.Optional(
          Type.String({ description: "Grade if known, e.g. 'MS63', 'AU58', 'VF20'. Omit if unknown." }),
        ),
        certified: Type.Optional(
          Type.Boolean({ description: "true if in a PCGS/NGC/ANACS/ICG holder, false if raw. Omit if unknown." }),
        ),
        grading_service: Type.Optional(
          Type.Union(
            [Type.Literal("PCGS"), Type.Literal("NGC"), Type.Literal("ANACS"), Type.Literal("ICG"), Type.Literal("other")],
            { description: "Grading service on the holder, if certified" },
          ),
        ),
        zip: Type.Optional(
          Type.String({ description: "US ZIP code where the offer was made, for regional comparison and nearby dealers" }),
        ),
        buyer_type: Type.Optional(
          Type.Union(
            [Type.Literal("dealer"), Type.Literal("pawn"), Type.Literal("coin_show"), Type.Literal("private"), Type.Literal("other")],
            { description: "Who made the offer" },
          ),
        ),
        offer_channel: Type.Optional(
          Type.Union(
            [Type.Literal("walk_in"), Type.Literal("mail_in"), Type.Literal("online"), Type.Literal("show"), Type.Literal("other")],
            { description: "How the offer was made, if mentioned" },
          ),
        ),
        sale_reason: Type.Optional(
          Type.Union(
            [Type.Literal("inherited"), Type.Literal("downsizing"), Type.Literal("investment"), Type.Literal("need_cash"), Type.Literal("other")],
            { description: "Why the user is selling, only if they mention it. Never ask just to fill this in." },
          ),
        ),
      }),
      async execute(_id, params) {
        try {
          const res = await postJson(CHECK_URL, params);
          if (res.status === 429) {
            return {
              content: [{ type: "text", text: `Daily free Lowball Checks used up. Run unlimited checks at ${WEB_URL}` }],
              details: { error: "rate_limited" },
            };
          }
          if (!res.ok) throw new Error(`coinsel.io returned ${res.status}`);
          const data = (await res.json()) as LowballResult;
          return { content: [{ type: "text", text: format(data) }], details: data };
        } catch (err) {
          const msg = errMsg(err);
          return {
            content: [{ type: "text", text: `Couldn't reach coinsel.io (${msg}). Try the web version: ${WEB_URL}` }],
            details: { error: msg },
          };
        }
      },
    });

    api.registerTool({
      name: "coin_offer_outcome",
      label: "Log Coin Sale Outcome",
      description:
        "Record what happened after a coin_lowball_check: whether the user sold, countered, or walked away, and the final price. " +
        "Call only when the user tells you the outcome, using the Check ID from the earlier check. " +
        "Returns how the final price compares with the fair range.",
      parameters: Type.Object({
        check_id: Type.String({ description: "The Check ID returned by coin_lowball_check" }),
        outcome: Type.Union(
          [
            Type.Literal("accepted_original"),
            Type.Literal("countered_and_sold"),
            Type.Literal("sold_elsewhere"),
            Type.Literal("declined_kept"),
            Type.Literal("still_deciding"),
          ],
          { description: "What the user did" },
        ),
        final_price_usd: Type.Optional(
          Type.Number({ minimum: 0, description: "Final sale price in USD, if they sold" }),
        ),
        final_buyer_type: Type.Optional(
          Type.Union(
            [Type.Literal("dealer"), Type.Literal("pawn"), Type.Literal("coin_show"), Type.Literal("private"), Type.Literal("online"), Type.Literal("other")],
            { description: "Who they sold to, if they sold" },
          ),
        ),
      }),
      async execute(_id, params) {
        try {
          const res = await postJson(OUTCOME_URL, params);
          if (res.status === 404) {
            return {
              content: [{ type: "text", text: "That Check ID wasn't found, so the result wasn't logged." }],
              details: { error: "not_found" },
            };
          }
          if (!res.ok) throw new Error(`coinsel.io returned ${res.status}`);
          const data = (await res.json()) as { message?: string };
          return {
            content: [{ type: "text", text: data.message ?? "Result logged. Thanks — it helps everyone get fairer offers." }],
            details: data,
          };
        } catch (err) {
          const msg = errMsg(err);
          return {
            content: [{ type: "text", text: `Couldn't log the result (${msg}).` }],
            details: { error: msg },
          };
        }
      },
    });
  },
});
