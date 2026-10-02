# warehouse.read

Run read-only SQL against the data warehouse or database.

## Answers

- Funnel, cohort, and revenue questions that need joined data.
- Long-range trends that live in exported analytics tables.

## Find the tool

Search phrases: `run sql query`, `execute query warehouse`, `list tables schema`.

List the tables and columns first. Use `SELECT` only, with `LIMIT` and a date filter. Connect
Executor with a read-only role. Prefer warehouse tables over live provider APIs for recurring
reports.

## Providers

| Provider | Search for | Needs |
| --- | --- | --- |
| BigQuery | `jobs query` | Project ID, standard SQL; check bytes processed on large tables |
| Snowflake | `statements` (SQL API) | Warehouse, database, schema, role |
| Postgres | `query` on a Postgres MCP server | Read-only role |
| ClickHouse, Databricks SQL, Redshift | `query`, `statement execution` | Warehouse or cluster ID |
| Metabase | `card query`, `dataset` | Card or database ID |
