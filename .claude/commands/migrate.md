Apply a SQL migration to Supabase production.

The user will provide the SQL or a migration file path. Since we don't have direct SQL access, guide them to paste it in the Supabase SQL Editor at:
https://supabase.com/dashboard/project/glernwcsuwcyzwsnelad/sql/new

Important:
- Remove CONCURRENTLY from CREATE INDEX statements (SQL Editor runs in a transaction)
- Run each statement separately if multiple statements
- Verify the migration doesn't break RLS policies
- After applying, update the migration list in MEMORY.md if it's a numbered migration
