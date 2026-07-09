# Signal-poller precision study — 2026-07-09

- db: `/Users/chingcheung/Documents/Project/optitrade/apps/backend/data/optitrade.db`
- n_total: 0
- n_open: 0
- n_closed: 0

## Status: no closed paper trades yet

The SQLite `paper_trades` table is empty of closed trades. Either the poller has not yet been run since the SQLite migration, or no signals have hit the entry thresholds in this dataset. Re-run this script after the next cron cycle on the live droplet to populate the metrics.

This is an honest empty-state report — not a fabricated zero.
