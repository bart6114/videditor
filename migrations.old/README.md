# D1 Database Migrations

This directory contains SQL migrations for the Cloudflare D1 database.

## Setup

1. **Create the D1 database:**
   ```bash
   wrangler d1 create videditor-db
   ```

   This will output a database ID. Copy it and update `wrangler.toml`:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "videditor-db"
   database_id = "your-database-id-here"
   ```

2. **Apply migrations locally:**
   ```bash
   wrangler d1 migrations apply videditor-db --local
   ```

3. **Apply migrations to production:**
   ```bash
   wrangler d1 migrations apply videditor-db --remote
   ```

## Migration Files

- `0001_initial_schema.sql` - Creates all tables and indexes

## Query the database

**Local:**
```bash
wrangler d1 execute videditor-db --local --command="SELECT * FROM projects"
```

**Production:**
```bash
wrangler d1 execute videditor-db --remote --command="SELECT * FROM projects"
```

## Notes

- D1 uses SQLite, not PostgreSQL
- No RLS (Row Level Security) - implement security in Workers
- JSON fields stored as TEXT (use `JSON.parse()` in code)
- UUIDs stored as TEXT
- Timestamps stored as ISO 8601 TEXT format
- Updated_at must be handled in application code (no triggers)
