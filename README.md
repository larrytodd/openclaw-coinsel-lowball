# Coinsel Lowball Check — OpenClaw plugin

**Got a cash offer for a coin? Find out if it's fair before you say yes.**

Tell your OpenClaw agent what a dealer, pawn shop, or coin-show buyer offered you. The plugin checks recent sold comps and melt value on [coinsel.io](https://www.coinsel.io) and tells you:

- 🚩 / ⚠️ / ✅ / 💰 a verdict: lowball, below fair, fair, or strong
- What the coin has actually sold for recently
- Melt value (for silver and gold coins)
- The offer as a percentage of retail
- A typical fair dealer-offer range, plus a regional comparison when you give a ZIP

## Install

```bash
openclaw plugins install openclaw-coinsel-lowball
```

No API key or configuration needed.

## Example

> **You:** The pawn shop offered me $28 for an 1881-S Morgan dollar, looks MS63. I'm in 60025.
>
> **Agent:** 🚩 Lowball: $28 for 1881-S Morgan dollar (MS63)
> • Recent retail (sold comps): $105 from 41 sales
> • Melt value: $24.10
> • Offer is 27% of retail
> • Typical fair dealer offer: $65–$85
> …

## Tool

| Tool | Parameters |
|---|---|
| `coin_lowball_check` | `coin` (required), `offer_usd` (required), `grade`, `zip`, `buyer_type` |

## Privacy

Offers are stored anonymously (coin, grade, amount, buyer type, and the first 3 digits of the ZIP) to build regional averages. No names, dealer names, or account data are collected.

## Limits

Free, rate-limited per IP. Values are estimates from public sales data, not appraisals or grades.

## License

MIT © Coinsel
