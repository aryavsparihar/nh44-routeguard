-- Read-only description of the public schema, used by scripts/db/gen-drizzle-schema.mjs
-- (npm run db:schema). pg_catalog is used for keys and identity because the
-- read-only role can't see information_schema.table_constraints.
select json_build_object(
  'columns', (select json_agg(json_build_object(
      'table', c.table_name, 'column', c.column_name, 'pos', c.ordinal_position,
      'type', c.data_type, 'udt', c.udt_name, 'nullable', c.is_nullable = 'YES',
      'default', c.column_default, 'generated', c.generation_expression,
      'precision', c.numeric_precision, 'scale', c.numeric_scale, 'kind', t.table_type)
      order by c.table_name, c.ordinal_position)
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'),
  'identity', (select json_agg(json_build_object('table', cl.relname, 'column', a.attname, 'kind', a.attidentity))
    from pg_attribute a join pg_class cl on cl.oid = a.attrelid join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname = 'public' and a.attidentity <> '' and not a.attisdropped),
  'pks', (select json_agg(json_build_object('table', cl.relname, 'column', a.attname, 'pos', k.ord))
    from pg_index i
    join pg_class cl on cl.oid = i.indrelid
    join pg_namespace n on n.oid = cl.relnamespace
    cross join lateral unnest(i.indkey) with ordinality as k(attnum, ord)
    join pg_attribute a on a.attrelid = cl.oid and a.attnum = k.attnum
    where n.nspname = 'public' and i.indisprimary),
  'enums', (select json_agg(json_build_object('name', t.typname, 'values',
      (select json_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid)) order by t.typname)
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e')
) as schema;
