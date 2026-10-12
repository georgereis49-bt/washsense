-- Read-only assertions after an approved migration, not a production data test.
BEGIN READ ONLY;
DO $verify$
DECLARE
  table_name text;
  role_name text;
  rel oid;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'organizations', 'organization_members', 'units', 'machines',
    'reservoirs', 'devices', 'sensors', 'machine_readings',
    'reservoir_readings', 'payments', 'subscriptions', 'alerts', 'maintenance',
    'audit_logs', 'consumption_records', 'machine_cycles', 'plans', 'profiles',
    'reservoir_refills'
  ] LOOP
    rel := to_regclass(format('public.%I', table_name));
    IF rel IS NULL OR NOT EXISTS (
      SELECT 1 FROM pg_class WHERE oid = rel AND relkind = 'r'
        AND pg_get_userbyid(relowner) = 'postgres' AND relrowsecurity
        AND NOT relforcerowsecurity
    ) THEN
      RAISE EXCEPTION 'Missing/drifted table, owner or RLS: %', table_name;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF has_table_privilege(role_name, rel, 'TRUNCATE')
        OR has_table_privilege(role_name, rel, 'TRIGGER')
        OR has_table_privilege(role_name, rel, 'REFERENCES')
        OR has_table_privilege(role_name, rel, 'MAINTAIN')
        OR has_any_column_privilege(role_name, rel, 'REFERENCES') THEN
        RAISE EXCEPTION 'Unexpected structural privilege: %.%', table_name, role_name;
      END IF;
    END LOOP;
  END LOOP;
END;
$verify$;
ROLLBACK;
