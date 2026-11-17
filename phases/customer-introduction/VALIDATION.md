# Customer introduction validation

Validated November 16, 2026 using the isolated local preview.

- Syntax checks passed for `app.js` and `preview.cjs`.
- Browser checks at 1440px desktop width and 390px phone width found no page-level horizontal overflow.
- Desktop menu button is hidden; phone menu opens, Escape closes it, and keyboard focus returns to the menu button.
- Manufacturer/engineer application selector updates the explanation, keeps exactly one pressed button, and preselects the matching interest when following Plan an evaluation.
- The screenshot-inspired inquiry form includes full name, business email, organization, interest, primary application, expected timeline, and an optional project overview. Required fields are marked; an unsure visitor can select Exploring the concept.
- Browser validation rejects malformed email and whitespace-only name. Correcting the name enables a successful download, including when the optional project overview is blank.
- Inquiry details download successfully with contact fields, interest, application, timeline, optional overview fallback, correct prototype URL, and an explicit not-sent statement.
- All three prototype links point to the supplied CSUB Drone SHM URL.
- Hero and header “Talk to our team” links target the getting-started section, with “Your next move starts here” and “Talk to our team to get started” headings. That section does not claim submission or booking; direct team contact awaits a verified destination.
- No console errors were reported during browser checks.
- Hero and contact-section screenshots inspected. The contact form uses two columns at 1440px and one at 390px, with no page-level overflow. The aircraft image is a repository SVG illustration and is described as conceptual.

Only the new `phases/customer-introduction/` folder is changed relative to the shared main branch. No university deployment, original site, customer database, or existing server is changed. Hosting the separate phase and choosing a direct contact destination are later integration steps.
