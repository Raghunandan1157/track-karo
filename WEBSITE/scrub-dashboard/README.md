# HCCS Scrub Analysis Dashboard

Dashboard for the HCCS credit-bureau scrub analysis report (CRIF Highmark).

- **Where:** on the website at `/scrub-dashboard/index.html`, linked from the sidebar as **Scrub Analysis** (admin only).
- **Data:** the figures live in the Neon database, table `scrub_reports` (one row per report date, figures in the `data` JSON column). The page loads the latest row through `GET /api/scrub-report`, which needs an admin sign-in.
- **New report:** insert a new row with a later `report_date`; the page always shows the latest one.

It summarises a loan "scrub" - checking a borrower list against the credit bureau before
disbursement: records scrubbed, match rate, credit scores, DPD buckets, branch split, account
status, MFI over-indebtedness, top lenders, KYC completeness and product mix.

The filter bar is still a visual placeholder.
