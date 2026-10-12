-- Metadata only; no application records or function bodies.
BEGIN READ ONLY;
SELECT jsonb_agg(jsonb_build_object('table', c.relname, 'name', p.polname,
  'command', p.polcmd, 'permissive', p.polpermissive, 'roles', p.polroles,
  'using', pg_get_expr(p.polqual, p.polrelid),
  'check', pg_get_expr(p.polwithcheck, p.polrelid)) ORDER BY c.relname, p.polname)
  AS policy_baseline
FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
WHERE c.relnamespace='public'::regnamespace
  AND c.relname IN ('machines','maintenance','sensors');

SELECT c.relname, a.attname, format_type(a.atttypid,a.atttypmod) AS type,
  a.attnotnull, a.attacl, c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) AS owner
FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
WHERE c.relnamespace='public'::regnamespace
  AND c.relname IN ('units','machines','maintenance','sensors','devices','reservoirs')
  AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum;

SELECT c.relname, r.rolname, p.privilege,
  has_table_privilege(r.oid,c.oid,p.privilege) AS effective
FROM pg_class c CROSS JOIN pg_roles r
CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE')) p(privilege)
WHERE c.relnamespace='public'::regnamespace
  AND c.relname IN ('machines','maintenance','sensors','units','devices','reservoirs')
  AND r.rolname IN ('anon','authenticated','service_role')
ORDER BY c.relname,r.rolname,p.privilege;

SELECT c.relname, con.conname, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
WHERE c.relnamespace='public'::regnamespace
  AND c.relname IN ('units','machines','maintenance','sensors','devices','reservoirs');
SELECT p.oid::regprocedure AS signature, pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef, p.proacl
FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
  AND p.proname IN ('has_org_role','has_unit_access','has_device_access',
    'has_machine_access','has_reservoir_access');
-- Existing triggers must be reviewed, including final NEW transformations and bypasses.
SELECT c.relname,t.tgname,t.tgenabled,t.tgisinternal,pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
WHERE c.relnamespace='public'::regnamespace
AND c.relname IN ('units','devices','machines','reservoirs','sensors','maintenance')
ORDER BY c.relname,t.tgname;
SELECT c.relname,i.indexrelid::regclass,pg_get_indexdef(i.indexrelid)
FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid
WHERE c.relnamespace='public'::regnamespace
AND c.relname IN ('units','devices','machines','reservoirs','sensors','maintenance');
SELECT rolname,rolsuper,rolbypassrls,rolinherit FROM pg_roles
WHERE rolname IN ('anon','authenticated','service_role','postgres');
SELECT p.oid::regprocedure,p.proconfig,p.provolatile,p.prosecdef,p.proacl
FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
AND (p.proname LIKE 'washsense_rls_%' OR p.proname LIKE 'has_%access' OR p.proname='has_org_role');
SELECT defaclrole::regrole,defaclnamespace::regnamespace,defaclobjtype,defaclacl
FROM pg_default_acl WHERE defaclobjtype='f';
ROLLBACK;
