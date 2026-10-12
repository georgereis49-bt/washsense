-- Metadata only. Do not run the existing application schema SQL as a preflight.
BEGIN READ ONLY;

WITH RECURSIVE targets(name) AS (
  VALUES ('organizations'), ('organization_members'), ('units'), ('machines'),
    ('reservoirs'), ('devices'), ('sensors'), ('machine_readings'),
    ('reservoir_readings'), ('payments'), ('subscriptions'), ('alerts'),
    ('maintenance'), ('audit_logs'), ('consumption_records'), ('machine_cycles'),
    ('plans'), ('profiles'), ('reservoir_refills')
), relations AS (
  SELECT t.name, c.*
  FROM targets t
  LEFT JOIN pg_namespace n ON n.nspname = 'public'
  LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = t.name
), public_tables AS (
  SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
), role_paths(root, member, path, inherited, can_set) AS (
  SELECT r.oid, r.oid, ARRAY[r.oid], true, true
  FROM pg_roles r WHERE r.rolname IN ('anon', 'authenticated')
  UNION ALL
  SELECT p.root, m.roleid, p.path || m.roleid,
    p.inherited AND m.inherit_option, p.can_set AND m.set_option
  FROM role_paths p JOIN pg_auth_members m ON m.member = p.member
  WHERE NOT m.roleid = ANY(p.path)
), report AS (
  SELECT 'server' AS section,
    jsonb_build_object('version', current_setting('server_version'),
      'database', current_database(), 'executor', current_user) AS metadata
  UNION ALL
  SELECT 'target', jsonb_build_object('table', name, 'exists', oid IS NOT NULL,
    'kind', relkind, 'owner', pg_get_userbyid(relowner),
    'rls', relrowsecurity, 'force_rls', relforcerowsecurity)
  FROM relations
  UNION ALL
  SELECT 'effective', jsonb_build_object('table', c.name, 'role', r.rolname,
    'privilege', p.privilege, 'allowed',
    has_table_privilege(r.oid, c.oid, p.privilege))
  FROM relations c CROSS JOIN pg_roles r
  CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
    ('TRUNCATE'), ('TRIGGER'), ('REFERENCES'), ('MAINTAIN')) p(privilege)
  WHERE c.oid IS NOT NULL
    AND r.rolname IN ('anon', 'authenticated', 'service_role', 'postgres')
  UNION ALL
  SELECT 'table_acl', jsonb_build_object('table', c.name,
    'grantor', pg_get_userbyid(a.grantor),
    'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC'
      ELSE pg_get_userbyid(a.grantee) END,
    'privilege', a.privilege_type, 'grant_option', a.is_grantable)
  FROM relations c
  CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,
    acldefault('r', c.relowner))) a
  WHERE c.oid IS NOT NULL
  UNION ALL
  SELECT 'grant_provenance', jsonb_build_object('table', c.name,
    'role', r.rolname, 'privilege', p.privilege,
    'effective', has_table_privilege(r.oid, c.oid, p.privilege),
    'expected_direct_grant', a.expected_direct,
    'unexpected_direct_grant', a.unexpected_direct,
    'direct_grants', a.direct_grants)
  FROM relations c CROSS JOIN pg_roles r
  CROSS JOIN (VALUES ('TRUNCATE'), ('TRIGGER'), ('REFERENCES'), ('MAINTAIN')) p(privilege)
  CROSS JOIN LATERAL (
    SELECT COALESCE(bool_or(pg_get_userbyid(x.grantor) = 'postgres'
      AND NOT x.is_grantable), false) AS expected_direct,
      COALESCE(bool_or(pg_get_userbyid(x.grantor) <> 'postgres'
      OR x.is_grantable), false) AS unexpected_direct,
      jsonb_agg(jsonb_build_object('grantor', pg_get_userbyid(x.grantor),
        'grant_option', x.is_grantable) ORDER BY x.grantor) AS direct_grants
    FROM aclexplode(c.relacl) x
    WHERE x.grantee = r.oid AND x.privilege_type = p.privilege
  ) a
  WHERE c.oid IS NOT NULL AND r.rolname IN ('anon', 'authenticated')
  UNION ALL
  SELECT 'column_acl', jsonb_build_object('table', c.name,
    'column', col.attname, 'grantor', pg_get_userbyid(a.grantor),
    'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC'
      ELSE pg_get_userbyid(a.grantee) END,
    'privilege', a.privilege_type, 'grant_option', a.is_grantable)
  FROM relations c JOIN pg_attribute col ON col.attrelid = c.oid
  CROSS JOIN LATERAL aclexplode(col.attacl) a
  WHERE col.attnum > 0 AND NOT col.attisdropped
  UNION ALL
  SELECT 'role', jsonb_build_object('name', rolname, 'superuser', rolsuper,
    'bypass_rls', rolbypassrls, 'inherit', rolinherit, 'login', rolcanlogin)
  FROM pg_roles
  UNION ALL
  SELECT 'membership', jsonb_build_object(
    'role', pg_get_userbyid(roleid), 'member', pg_get_userbyid(member),
    'admin_option', admin_option, 'inherit_option', inherit_option,
    'set_option', set_option)
  FROM pg_auth_members
  UNION ALL
  SELECT 'default_acl', jsonb_build_object('creator', pg_get_userbyid(d.defaclrole),
    'schema', n.nspname, 'object_type', d.defaclobjtype,
    'grantor', pg_get_userbyid(a.grantor),
    'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC'
      ELSE pg_get_userbyid(a.grantee) END,
    'privilege', a.privilege_type, 'grant_option', a.is_grantable)
  FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
  CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  WHERE d.defaclnamespace = 0 OR n.nspname = 'public'
  UNION ALL
  SELECT 'public_table', jsonb_build_object('table', c.relname,
    'in_current_scope', c.relname IN (SELECT name FROM targets),
    'kind', c.relkind, 'owner', pg_get_userbyid(c.relowner),
    'rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity,
    'acl', c.relacl::text)
  FROM public_tables c
  UNION ALL
  SELECT 'public_effective', jsonb_build_object('table', c.relname,
    'role', r.rolname, 'privilege', p.privilege,
    'allowed', has_table_privilege(r.oid, c.oid, p.privilege))
  FROM public_tables c CROSS JOIN pg_roles r
  CROSS JOIN (VALUES ('TRUNCATE'), ('TRIGGER'), ('REFERENCES'), ('MAINTAIN')) p(privilege)
  WHERE r.rolname IN ('anon', 'authenticated', 'service_role', 'postgres')
  UNION ALL
  SELECT 'role_path', jsonb_build_object('root', pg_get_userbyid(root),
    'reachable_role', pg_get_userbyid(member), 'inherited', inherited,
    'can_set', can_set, 'path', (SELECT jsonb_agg(pg_get_userbyid(x))
      FROM unnest(path) x))
  FROM role_paths WHERE cardinality(path) > 1
  UNION ALL
  SELECT 'function', jsonb_build_object('signature', p.oid::regprocedure::text,
    'owner', pg_get_userbyid(p.proowner), 'security_definer', p.prosecdef,
    'search_path', (SELECT jsonb_agg(setting) FROM unnest(p.proconfig) setting
      WHERE setting LIKE 'search_path=%'), 'acl', p.proacl::text)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
  UNION ALL
  SELECT 'function_execute', jsonb_build_object('signature', p.oid::regprocedure::text,
    'role', r.rolname, 'allowed', has_function_privilege(r.oid, p.oid, 'EXECUTE'))
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN pg_roles r
  WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
    AND r.rolname IN ('anon', 'authenticated', 'service_role',
      'authenticator', 'supabase_auth_admin', 'supabase_realtime_admin')
  UNION ALL
  SELECT 'function_dependency', jsonb_build_object('function', p.oid::regprocedure::text,
    'table', c.relname, 'dependency_type', d.deptype)
  FROM pg_depend d JOIN pg_proc p ON p.oid = d.objid
  JOIN public_tables c ON c.oid = d.refobjid
  WHERE d.classid = 'pg_proc'::regclass AND d.refclassid = 'pg_class'::regclass
  UNION ALL
  SELECT 'trigger', jsonb_build_object('table', c.relname,
    'name', t.tgname, 'enabled', t.tgenabled, 'internal', t.tgisinternal,
    'function', t.tgfoid::regprocedure::text)
  FROM pg_trigger t JOIN public_tables c ON c.oid = t.tgrelid
)
SELECT section, metadata FROM report ORDER BY section, metadata::text;

ROLLBACK;
