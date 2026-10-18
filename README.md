# Coinsel Lowball Check — OpenClaw plugin

**Got a cash offer for a coin? Find out if it's fair, what to counter with, and where to get more — before you say yes.**

Tell your OpenClaw agent what a dealer, pawn shop, or coin-show buyer offered you. The plugin checks recent sold comps, the PCGS price guide and live melt value on [coinsel.io](https://www.coinsel.io) and gives you:

- 🚩 / ⚠️ / ✅ / 💰 a verdict: lowball, below fair, fair, or strong
- What the coin is actually worth, and where that number comes from
- Melt value for silver and gold coins
- A typical fair dealer-offer range, adjusted for raw vs. certified coins
- **A counter-offer and exactly what to say**
- **Nearby dealers and upcoming coin shows** when the offer is low (give a ZIP)
- How buyers in your area typically price, once enough local data exists

## Install

```bash
openclaw plugins install openclaw-coinsel-lowball
```

No API key or configuration needed.

## Example

> **You:** The pawn shop offered me $28 for an 1881-S Morgan dollar, PCGS MS63. I'm in 60025.
>
> **Agent:** 🚩 Lowball: $28 for 1881-S Morgan dollar (MS63)
> • Retail value: $110 (PCGS price guide, MS63)
> • Melt value: $44.22
> • Offer is 25% of retail
> • Typical fair dealer offer: $66–$88
>
> Counter at $85. What to say: "PCGS guide is $110 on this coin. I can do $85 today."
>
> Where to get a better offer:
> • Dealer: … (2.3 mi)
> • Coin show: …

Later, tell your agent what happened ("I got $80 at another dealer") and it logs the result.

## Tools

| Tool | What it does |
|---|---|
| `coin_lowball_check` | Prices the offer. Inputs: `coin`, `offer_usd` (required); `grade`, `certified`, `grading_service`, `zip`, `buyer_type`, `offer_channel`, `sale_reason` (optional) |
| `coin_offer_outcome` | Logs what you did afterwards: sold, countered, sold elsewhere, or kept it, and the final price |

## Privacy and data use

We store each check anonymously: the coin, grade, certification, offer amount, buyer type, how the offer was made, the reason for selling if you mention it, the first 3 digits of your ZIP code, and any outcome you report. We never collect names, contact details, full addresses, or which dealer made an offer.

This data powers the regional comparisons you see, and Coinsel may publish or license **aggregated** statistics built from it (for example, "dealers in the Chicago area pay about 72% of retail on Morgan dollars"). Aggregates are never based on fewer than 5 offers, and individual checks are never sold. Full policy: https://www.coinsel.io/privacy

## Limits

Free, rate-limited per IP. Values are estimates from public sales and price-guide data, not appraisals or grades.

## License

MIT © Coinsel
