-- Metadata only. Do not run the existing application schema SQL as a preflight.
BEGIN READ ONLY;

WITH targets(name) AS (
  VALUES ('organizations'), ('organization_members'), ('units'), ('machines'),
    ('reservoirs'), ('devices'), ('sensors'), ('machine_readings'),
    ('reservoir_readings'), ('payments'), ('subscriptions'), ('alerts'),
    ('maintenance')
), relations AS (
  SELECT t.name, c.*
  FROM targets t
  LEFT JOIN pg_namespace n ON n.nspname = 'public'
  LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = t.name
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
    ('TRUNCATE'), ('TRIGGER'), ('REFERENCES')) p(privilege)
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
)
SELECT section, metadata FROM report ORDER BY section, metadata::text;

ROLLBACK;
