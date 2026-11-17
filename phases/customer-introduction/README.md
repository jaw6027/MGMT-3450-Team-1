# Separate phase — customer introduction to Drone SHM

This customer-facing website introduces the structural-health-monitoring concept described at https://cs.csub.edu/~bdarghali/drone-shm/ . It is an additional phase in the MGMT-3450-Team-1 repository, not a replacement for the existing Flightpath company website, sales workspace, or university telemetry dashboard.

Prepared November 16, 2026. The user clarified that the intended audience is prospective customers, rather than dashboard operators. This phase therefore focuses on the purpose, measurements, possible applications, evaluation process, common questions, and a useful next step. The earlier telemetry-usability branch remains separate.

## Included

- A responsive introduction with plain-language explanations of arm strain, vibration, and motor-mount temperature.
- Potential-use-case content for fleet/inspection teams, manufacturers/engineers, and research/program teams.
- Direct links to the existing university prototype. Links opening new tabs include accessible announcements.
- A local evaluation-brief download so a visitor can prepare for a discussion without a fabricated team email, unconnected contact form, or claim that a demo was booked.
- “Talk to our team” calls to action in the navigation and hero lead to the “Talk to our team to get started” section. A verified team email or booking/contact link is still needed for direct contact; until supplied, this section provides the local discussion-brief download and explains that nothing is sent.
- Keyboard focus indicators, skip link, responsive navigation with Escape-to-close, native FAQ disclosures, and reduced-motion support.

Content is grounded in the public university dashboard and deployment guide. It preserves the distinction between the simulated demo and real hardware integration. It does not invent validated benefits, detection performance, product availability, pricing, customer endorsements, universal compatibility, or safety certification. The quadcopter illustration is reused from the existing repository and is labeled conceptual; it is not claimed to be the actual instrumented aircraft.

## Preview

Run `node phases/customer-introduction/preview.cjs` from the repository root and open http://127.0.0.1:8768/ . No installation or account is needed. Stop with Ctrl+C.

The website itself consists of `index.html`, `styles.css`, `app.js`, and `drone.svg`. Relative asset paths allow it to be hosted under a subdirectory. It makes no API requests and stores no visitor information. The brief is generated in browser memory and downloaded as a plain-text file. Only following the university links navigates to the external site.

## Merge later

1. Review the `phase/customer-introduction` branch and preview with the team.
2. Agree on the product/organization name and the relationship between this concept and Flightpath before changing the main homepage. This phase uses descriptive “Drone SHM” branding.
3. Confirm the CSUB demo URL and obtain approval from its owner before changing that deployment. This repository phase does not establish access to the university host.
4. Merge this additive folder when ready. The existing Node server deliberately does not serve this phase; its preview server is separate.
5. For a public review, host the four website files as a separate subsite. Update the original server allowlist only if the team chooses to serve the subsite there.
6. Add a verified project contact or an authorized inquiry integration before changing the download-only action into a request form. Preserve clear submission and privacy behavior.

Future content requiring team input: verified product photos/specifications, pilot availability, approved pricing, measured validation results, team identity, and a real contact destination. None are fabricated here.

Validation results are recorded in `VALIDATION.md`.
