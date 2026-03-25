DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel
          ON rel.oid = con.conrelid
        JOIN pg_namespace nsp
          ON nsp.oid = rel.relnamespace
        JOIN pg_attribute attr
          ON attr.attrelid = rel.oid
         AND attr.attnum = ANY(con.conkey)
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'listening_activity'
          AND attr.attname = 'track_id'
          AND con.contype = 'f'
    LOOP
        EXECUTE format(
            'ALTER TABLE public.listening_activity DROP CONSTRAINT IF EXISTS %I',
            constraint_name
        );
    END LOOP;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'listening_activity'
          AND column_name = 'track_id'
          AND data_type <> 'text'
    ) THEN
        ALTER TABLE listening_activity
        ALTER COLUMN track_id TYPE TEXT USING track_id::TEXT;
    END IF;
END $$;
