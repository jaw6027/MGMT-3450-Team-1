# Additional phase — Drone SHM usability

Status: isolated review phase, prepared November 16, 2026. Not merged or deployed.

## Relationship to the websites

The reviewed university page is https://cs.csub.edu/~bdarghali/drone-shm/ (Project 1 structural-health telemetry). It runs a PHP sensor dashboard. The shared GitHub main branch currently contains the Flightpath company website and sales/marketing workspaces, not that PHP application. These are different applications; a deployment relationship could not be established from the inspected sources.

This phase adds only this directory. Existing company, marketing, sales, API, database, and university deployments are untouched. The `preview` directory contains the university's publicly served HTML/CSS/JS captured for review, plus a clearly labeled local fixture adapter. Original asset logic is retained there; preview HTML adds the optional files. No university sensor endpoints are called by the preview. No new dependency is needed.

## Review findings and improvements

| Observed issue | Addition in this phase | Benefit |
| --- | --- | --- |
| Technical units and component names assume prior knowledge | Expandable sensor explanations and searchable help | New visitors can understand measurements without leaving the page |
| Canvas chart has no exact-value table or download | Selected-metric UTC table, availability counts, min/max, CSV | Supports comparison, keyboard access, and review |
| Existing chart converts null to zero and compresses missing samples | Optional chart renderer keeps gaps and original sample spacing | Missing readings are not shown as measured zero |
| Updates and illustrative motion can distract during review | Independent table pause, reduced-motion control | Inspect a frozen table/export while notices continue refreshing |
| Small supporting text and long navigation | Larger-text option, focus rings, skip link, wrapping mobile links | Easier reading and navigation |
| Demo/live meaning requires context | Plain-language source explanation beside tools and in exports | Reinforces the existing source distinction |

Data is still a prototype. No added safety limits, aircraft-health classification, hardware connection, authentication, or AWS integration is claimed. The existing Data source selector, cards, visualization, notices, and architecture remain. No contact or customer information is collected by this phase. Preferences alone are saved locally in the browser when storage is available.

## Preview

From this directory run `node preview.cjs`, then open http://127.0.0.1:8767/ . The gold banner identifies the local review fixture. Demo has 40 simulated readings, including one missing strain sample for validation. Live intentionally returns no data. This is not a connection to the university backend. Stop with Ctrl+C.

## Merge later

1. Review this phase on its branch. Do not upload the preview folder as a production replacement.
2. Obtain the actual university PHP source repository and compare its current IDs/API against this captured snapshot.
3. Copy only `usability.css`, `usability.js`, and `trend-chart.js` to that site's assets folders. Preserve its existing files and PHP endpoints.
4. In the PHP page head, load `usability.css` after the existing stylesheet. After `api.js` and `charts.js`, load `trend-chart.js` and `usability.js`, before `dashboard.js`. Keep `drone-visual.js` in its existing position. If scripts are deferred, preserve this execution order.
5. Verify both real PHP source modes in staging, timestamps, stale/error behavior, keyboard use, phone layout, and exports. The table observes existing API requests, adding no polling. It clears even when paused on a source change, disconnected snapshot, or request failure. A paused table is explicitly historical, not a frozen monitoring dashboard.
6. Deploy only after team review. Roll back by removing the three optional includes. No database migration is involved.

Example script order (adjust paths to the actual server):

```html
<script src="assets/js/api.js"></script>
<script src="assets/js/charts.js"></script>
<script src="assets/js/trend-chart.js"></script>
<script src="assets/js/drone-visual.js"></script>
<script src="assets/js/usability.js"></script>
<script src="assets/js/dashboard.js"></script>
```

## Later priorities beyond this phase

1. Add data-age and sensor-offline labels using the real backend's timestamp/quality contract, rather than inferring freshness from screen updates.
2. Validate calibration, sensor mounting, and measurement units with the hardware team; publish a plain-language field guide.
3. Add persistent timestamped history and user-selectable time ranges once real storage exists.
4. Conduct keyboard and screen-reader testing with users and a full accessibility audit; this phase does not claim conformance certification.
5. Confirm ownership and hosting of the university and Flightpath sites before adding cross-site navigation or shared access.

## Validation record

Record final automated and browser validation in `VALIDATION.md` before merge. Local fixtures cannot establish PHP backend, sensor, or AWS correctness.
