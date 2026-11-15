# Credit Check UI

Front-end only prototype of the **Credit Check** module for the Track Karo
microfinance / NBFC lending desk.

Single self-contained file — `index.html` — with HTML, CSS and vanilla
JavaScript. No backend, no build step, no real bureau API calls.

## Run it

Double-click `index.html`, or serve the folder:

```bash
npx serve .
```

Designed for laptop screens (1366×768 and 1440×900, minimum width 1280px).

## Screens

| Screen | What it does |
| --- | --- |
| **Dashboard** | KPI cards (bureau checks today, approved, rejected, pending, average score) and the recent credit-check table |
| **New Credit Check** | Applicant capture with PAN masking (`ABCDE****F`), Aadhaar last-4 only, mandatory consent gate, 2-second bureau fetch state |
| **Credit Report** | Animated 300–900 score gauge, exposure summary, accounts table, 24-month DPD heatmap, red-flag panel |
| **Underwriting** | Live FOIR meter with a 50% policy cap, eligibility verdict with reasons, approve / refer / reject with a remarks modal |
| **Report History** | Searchable and filterable archive with print-to-PDF |

## Notes

- All dummy data lives in one `DB` object at the top of the `<script>` block.
  Replace it with an API response and nothing else needs to change.
- `window.print()` plus a print stylesheet drives the **Download PDF** button.
- Colours, type scale and component styles are defined as CSS custom
  properties in `:root`.
