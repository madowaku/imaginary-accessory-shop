# MIRAGE MARKET Build Log

This is a concise record of the decisions that materially shaped the hackathon
MVP. It is not a conversation transcript. Prompts, API keys, environment values,
personal photos, and local machine paths are intentionally excluded.

## 1. Product direction

- Defined MIRAGE MARKET as a fictional accessory market where people create,
  collect, and virtually wear objects that cannot exist physically.
- Chose the central demo moment: the purchased imaginary accessory appearing on
  the buyer's own photo.
- Positioned the project for the OpenAI Build Week **Apps for your life** track.

## 2. MVP reduction

- Limited each generated shop to exactly three products.
- Limited the product taxonomy to earrings, necklaces, and headpieces so each
  item has a clear placement target for virtual try-on.
- Prioritized the create → publish → purchase → try-on path over shop layout
  customization, social features, and full account management.

## 3. Cloudflare architecture

- Adopted one Cloudflare project containing the React SPA and Hono Worker API.
- Replaced the earlier Firebase and Cloud Run plan with D1 for relational state,
  R2 for images, and same-origin Worker routes for API and media access.
- Kept OpenAI credentials entirely in the Worker environment.

## 4. D1 purchase flow

- Added users, sessions, shops, accessories, purchases, and try-ons in the
  initial migration.
- Used D1 `batch()` for the purchase insert, balance deduction, and sales counter
  update.
- Added a unique buyer/accessory constraint and conditional balance check to
  prevent duplicate or unaffordable purchases.

## 5. Private R2 photo design

- Kept product images readable through a controlled Worker media route.
- Stored source photos under private, user-scoped keys with no public bucket URL.
- Restricted try-on results to the owning anonymous session and deleted the
  source photo after a successful edit.

## 6. Recoverable generation and judging fallback

- Sent one product-image request per accessory so one failure does not discard
  the other completed products.
- Persisted generation states and exposed an individual retry action.
- Added deterministic concepts and SVG product artifacts for local judging when
  the OpenAI API is unavailable, rate-limited, or at its billing limit.
- Kept production moderation fail-closed while allowing an explicit development
  fallback for demo continuity.

## 7. Verification

- Passed TypeScript type checking, focused Vitest prompt-contract tests, and the
  production Vite/Worker build.
- Applied the initial migration to local D1 and verified all statements.
- Used a real browser to verify concept creation, three independent product-image
  results, R2 delivery, shop publishing, purchase, and the balance change from
  1,000 to 700 Mirage.
- Visually reviewed the full public shop page at desktop size.

## 8. P0 checkpoint

- Created the initial P0 commit with the complete vertical slice and submission
  documentation.
- Tagged the checkpoint as `v0.1.0-p0`.
- Published `main` and the tag to the public GitHub repository.

## 9. Dreamy Boutique redesign

The original dark luxury interface was redesigned into a brighter pearl, rose,
and lilac boutique. The new direction preserves the imaginary-market concept
through impossible product imagery, fictional-currency language, impossibility
tags, and a persistent notice that no physical products are sold.
