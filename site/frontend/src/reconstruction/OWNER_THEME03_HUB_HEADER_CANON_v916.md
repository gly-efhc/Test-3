# OWNER — HUB / Header Theme03 visual canon (31.10.2026)

Status: **APPROVED OWNER reference**, migration target; NOT a declaration of React visual acceptance.

## Physical authority

- Frozen primary application: `FRONTEND_v866.html` and its exact CSS/DOM/variant decisions.
- New owner-supplied HUB + Header Theme03 screenshot: `1000072658.png`, SHA-256 `e51539b59635cf6b6cb01568f81dc4618ec1e2064974da8d934a4871f428c4c6` (880 × 1831 pixels).
- Screenshots remain owner-managed external references per `EXTERNAL_VISUAL_REFERENCE_POLICY_v900`; this document records provenance, not an unauthorized replacement image.
- The screenshot is approved as the ideal **Theme03** chroma/contrast/geometry. Do not select CT01 captures as evidence against it or recolor Theme03 to make React easier.

## Layout invariants

1. Header upper row: **two strictly equal-width regions** (avatar/name/level/Activ/VIP and balance); same height/vertical alignment within their shared grid.
2. Header lower row: **four strictly equal-width action buttons**, evenly spaced: FAQ, Wallet, + EFHC, HUB. No extra Admin shortcut in Header. Admin access remains through approved Profile.
3. HUB main area: **two equal-width button columns with unlimited rows**, one shared gap/width/height/radius family. No `slice(0,4)`, `maxItems=4`, or fixed total.
4. The four protected HUB identities precede other active Admin-managed links: Shop, EFHC VIP NFT, CEO EFHC, Admin. The protected HUB Admin link **is not** the forbidden Header Admin shortcut.
5. All other active Admin-managed HUB links continue in the same equal-column grid, with no blank placeholders.
6. Preserve existing approved footer/nav geometry and selection behavior; do not add an active-point decoration or remove the six footer destinations.
7. Preserve exact DOM/CSS/CT/variant provenance from DEMO v866, and do not impose new arbitrary pixel scaling, decorative colors, or monetary/API behavior to make a screenshot pass.

## Visual acceptance

- Compare actual React and frozen DEMO at equal CSS viewport, DPR, Theme03, language, all individual variants and equivalent data.
- Rendered JSX/import names/compile success are insufficient; verify DOM geometry, computed styles and a pair of screenshots.
- An earlier v915 Pages capture defaulted to CT01/English: it does **not** demonstrate Theme03 parity.
- Browser Shop React remains the functional page at `/browser-shop`. The OWNER-supplied `SHOP_v866.html` is a separate exact frozen source at `/SHOP_v866.html` for independent visual verification; never replace production checkout/financial code with its standalone simulation.

## Work status at creation

- Owner Header/HUB symmetry source tests and frozen Shop SHA check pass on GitHub branch.
- React Next build/export pass, but legacy tests fail and full visual equality is NOT certified.
- Main/default branch must not be merged until qualification, exact-HEAD CI and OWNER release decision.
