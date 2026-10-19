# Database Migrations & Rollback Guide — TIMELESS TRENDS

## Architecture
- **Source Database**: SQLite (`data/timeless.db`, read-only fallback and data backup)
- **Production Database**: Supabase PostgreSQL (`DATABASE_URL`)

## Migration Files
1. `001_initial_schema.sql`: Contains full DDL for all 20 business and operational tables, foreign key constraints with cascade behaviors, checks, and performance indexes.
2. `002_row_level_security.sql`: Enables PostgreSQL Row Level Security (RLS) on all tables and provides public storefront access policies and service_role administrative policies.

## Running Migrations and Sync
To synchronize latest records from SQLite to Supabase PostgreSQL safely:
```bash
node scripts/sync-sqlite-to-pg.cjs
```
This script:
- Verifies column structure between SQLite and PostgreSQL.
- Inserts any missing records transactionally.
- Updates all identity sequences to ensure new IDs increment cleanly.
- Verifies record counts across every table.
- Does NOT delete or alter the original SQLite database.

## Rollback / Recovery Procedure
1. The SQLite database at `data/timeless.db` is maintained intact as an authoritative backup.
2. In case of database rollback, data can be restored from `data/timeless.db` or `data/timeless-backup.db`.
3. If PostgreSQL transactions fail during runtime operations, all changes are wrapped inside atomic transactions (`withTransaction` / `BEGIN ... ROLLBACK`) to prevent partial writes.
