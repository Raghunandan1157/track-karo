# HCCS Scrub Analysis Dashboard

Static UI for the HCCS credit-bureau scrub analysis report (CRIF Highmark).

## What it is
A self-contained dashboard that summarises a loan "scrub" — the process of checking a
borrower list against the credit bureau before disbursement to assess over-indebtedness
and creditworthiness. It renders aggregate metrics from the bureau response:

- Records scrubbed, match rate, credit accounts, average credit score
- Credit score distribution, DPD (delinquency) buckets, branch-wise split
- Credit account status, MFI over-indebtedness, top credit grantors
- KYC field completeness and bureau reconciliation

## How to run
No server or database — just open `index.html` in any browser.

> The dashboard is a UI-only preview. The numbers shown are snapshot aggregates from a
> single scrub run (24-10-2026). Wiring this to live data (the CRIF scrub output CSVs or
> a database) is the next step; no backend is included here.
