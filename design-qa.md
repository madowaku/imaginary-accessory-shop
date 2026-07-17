# MIRAGE MARKET Design QA

**Source visual truth**

- Approved ImageGen mock from the Dreamy Boutique design session. The local
  generated-image path is intentionally excluded from this public record.

**Implementation evidence**

- Home: `output/design-qa/home-final-verified.png`
- Create flow: `output/design-qa/create-final.png`
- Combined comparison: `output/design-qa/comparison-final.png`
- Mobile capture: `output/design-qa/home-mobile-final.png`

**Viewport and state**

- Desktop app viewport: 1488 × 1056, anonymous session bootstrapped, home route.
- The browser capture surface exported 1441 × 1045 pixels; the app reported a 1488 × 1056 CSS viewport and 1473px document width with no horizontal overflow.
- Mobile app viewport: 390 × 844, anonymous session bootstrapped, home route. Document width was 375px with no horizontal overflow.

**Full-view comparison evidence**

- `comparison-final.png` places the selected mock and the rendered home screen in one comparison image.
- The implementation preserves the pearl/blush/lilac palette, editorial serif hierarchy, left-aligned hero, impossible hero object, three product cards, impossibility tags, Mirage currency, and the three-step structure.
- The independent production hero asset is intentionally framed more tightly than the mock while retaining the liquid sunset, crescent, mist, and unsupported gems.

**Focused region evidence**

- Header: the declaration, create link, and Mirage balance are present in the accessibility tree. Hit-testing at the right-side header coordinates returned `ショップをつくる` and `1,000 Mirage`; the in-app capture backend intermittently omitted those composited pixels, but DOM geometry showed both inside the viewport.
- Product cards: all four generated raster assets reported `complete: true` with non-zero natural widths. Card image geometry was 434 × 244px and no longer expanded from intrinsic image dimensions.
- Create flow: the primary home CTA uniquely resolved and navigated to `/create`. `create-final.png` confirms the progress rail, heading, three populated fields, category summary, and primary action in the new visual system.
- Focused crops beyond these regions were not needed because the remaining typography, copy, and card layout are legible in the combined full-view comparison.

**Required fidelity surfaces**

- Fonts and typography: Noto Serif JP provides the editorial display hierarchy; Noto Sans JP and DM Mono cover body copy and small labels. Weight, line-height, wrapping, and optical hierarchy are consistent with the target.
- Spacing and layout rhythm: the hero was reduced to 415px, cards use a fixed 1.78 image ratio, and the three-step strip begins at 964px in the 1056px desktop viewport. No desktop or mobile horizontal overflow remains.
- Colors and visual tokens: pearl, blush, lilac, plum, mauve, rose, lavender, gold, and border tokens match the approved direction with readable contrast.
- Image quality and asset fidelity: the hero and three product images are dedicated ImageGen raster assets. No placeholder, CSS drawing, handcrafted SVG, or generic stock image replaces a target asset.
- Copy and content: the imaginary-product declaration, `存在しない新着品`, impossibility tags, `◇ n Mirage`, `実物価格：存在しません`, `Mirageで迎える`, and nonphysical-delivery note are implemented consistently.

**Comparison history**

1. Initial pass: hero and section spacing pushed the product story too far below the fold. Fixed by reducing hero height and section gaps.
2. Second pass: product images used their intrinsic height instead of the intended card ratio. Fixed by absolutely fitting images inside the measured 1.78 slots.
3. Final pass: desktop geometry places the hero, product cards, and entry to the three-step strip in the first viewport; mobile geometry has no horizontal overflow; console errors and warnings are empty.

**Findings**

- No actionable P0, P1, or P2 differences remain.

**Open Questions**

- None.

**Implementation Checklist**

- [x] Selected visual target recreated with dedicated assets.
- [x] Core CTA and create route verified.
- [x] Desktop and mobile overflow checked.
- [x] Console checked.
- [x] Typecheck, tests, and production build passed.

**Follow-up Polish**

- P3: after deployment, re-check the header's right-side capture in the production browser to rule out the local in-app capture compositing anomaly.

final result: passed
