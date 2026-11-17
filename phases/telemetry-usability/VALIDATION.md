# Usability phase validation

Reviewed November 16, 2026 against the public university dashboard and a separate localhost fixture preview.

- JavaScript syntax checks for optional scripts and preview files.
- Renderer regression tests: missing samples retain gaps/positions; zero is valid; null, empty, boolean and nonfinite samples are unavailable.
- Browser: 40 demo history rows, 39 available strain-arm-1 readings, one explicitly unavailable sample. Vibration selection updates units and availability to 40/40.
- Browser: table pause shows its historical state; changing to Live clears the table, disables export, and preserves the original disconnected notice. Returning to Demo restores history.
- Browser: battery help search returns one relevant topic; clearing restores all topics.
- Browser: selected vibration CSV download succeeds. CSV has a header and 40 data rows, timestamps, units and simulated-source labels.
- Browser: 390px phone viewport with larger text and reduced motion enabled has no page-level horizontal overflow. Inspected tools/source layout visually. Default viewport also has no horizontal overflow.
- Browser: no console errors reported during these interactions.
- Existing application files are unchanged; only `phases/telemetry-usability/` is added.

Not established by these checks: actual PHP backend behavior after integration, real hardware connectivity/calibration, AWS integration, full screen-reader conformance, or all concurrent network failure combinations. Verify these in staging using the merge checklist. The local adapter intentionally generates simulated fixtures, not live data.
