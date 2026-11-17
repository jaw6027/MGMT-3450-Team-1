# Customer introduction validation

Validated November 16, 2026 using the isolated local preview.

- Syntax checks passed for `app.js` and `preview.cjs`.
- Browser checks at 1440px desktop width and 390px phone width found no page-level horizontal overflow.
- Desktop menu button is hidden; phone menu opens, Escape closes it, and keyboard focus returns to the menu button.
- Manufacturer/engineer application selector updates the explanation, keeps exactly one pressed button, and preselects the matching interest when following Plan an evaluation.
- The required question rejects whitespace-only input and accepts a meaningful question after editing.
- Evaluation brief downloads successfully. Its text contains the entered organization and question, selected engineering interest, correct prototype URL, and an explicit not-sent statement.
- All three prototype links point to the supplied CSUB Drone SHM URL.
- Hero and header “Talk to our team” links target the getting-started section. That section does not claim submission or booking; direct team contact awaits a verified destination.
- No console errors were reported during browser checks.
- Hero screenshot inspected; the aircraft image is a repository SVG illustration and is described as conceptual.

Only the new `phases/customer-introduction/` folder is changed relative to the shared main branch. No university deployment, original site, customer database, or existing server is changed. Hosting the separate phase and choosing a direct contact destination are later integration steps.
