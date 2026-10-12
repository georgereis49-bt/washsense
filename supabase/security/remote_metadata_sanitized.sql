-- One catalog-only SELECT. No application/Auth rows, source bodies or literal defaults.
-- Expression fingerprints identify drift; they do NOT reconstruct sanitized DDL.
WITH targets AS (
 SELECT c.* FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname=ANY(ARRAY['organizations','organization_members',
 'units','machines','reservoirs','devices','sensors','machine_readings','reservoir_readings',
 'payments','subscriptions','alerts','maintenance','audit_logs','consumption_records',
 'machine_cycles','plans','profiles','reservoir_refills'])
), actors AS (
 SELECT oid,rolname FROM pg_catalog.pg_roles
 WHERE rolname IN ('anon','authenticated','service_role','postgres','supabase_admin')
), helpers AS (
 SELECT p.* FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND (p.proname IN ('has_org_access','has_org_role','has_unit_access',
 'has_machine_access','has_reservoir_access','has_device_access') OR p.proname LIKE 'washsense_rls_%')
)
SELECT pg_catalog.jsonb_build_object(
 'server_version',current_setting('server_version'),
 'tables',(SELECT jsonb_agg(jsonb_build_object('name',t.relname,'kind',t.relkind,
  'owner',COALESCE(a.rolname,'other'),'rls',t.relrowsecurity,'force_rls',t.relforcerowsecurity)
  ORDER BY t.relname) FROM targets t LEFT JOIN actors a ON a.oid=t.relowner),
 'columns',(SELECT jsonb_agg(jsonb_build_object('table',t.relname,'column',a.attname,
  'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
  'identity',a.attidentity,'generated',a.attgenerated,'has_default',d.oid IS NOT NULL,
  'default_fingerprint',md5(pg_get_expr(d.adbin,d.adrelid))) ORDER BY t.relname,a.attnum)
  FROM targets t JOIN pg_attribute a ON a.attrelid=t.oid LEFT JOIN pg_attrdef d
  ON d.adrelid=t.oid AND d.adnum=a.attnum WHERE a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('table',t.relname,'name',k.conname,
  'type',k.contype,'validated',k.convalidated,'deferrable',k.condeferrable,'deferred',k.condeferred,
  'columns',(SELECT jsonb_agg(a.attname ORDER BY x.ord) FROM unnest(k.conkey) WITH ORDINALITY x(num,ord)
   JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=x.num),
  'referenced_table',k.confrelid::regclass::text,'on_update',k.confupdtype,'on_delete',k.confdeltype,
  'definition_fingerprint',md5(pg_get_constraintdef(k.oid))) ORDER BY t.relname,k.conname)
  FROM targets t JOIN pg_constraint k ON k.conrelid=t.oid),
 'policies',(SELECT jsonb_agg(jsonb_build_object('table',t.relname,'name',p.polname,
  'command',p.polcmd,'permissive',p.polpermissive,'roles',p.polroles,
  'using_fingerprint',md5(pg_get_expr(p.polqual,p.polrelid)),
  'check_fingerprint',md5(pg_get_expr(p.polwithcheck,p.polrelid))) ORDER BY t.relname,p.polname)
  FROM targets t JOIN pg_policy p ON p.polrelid=t.oid),
 'table_grants',(SELECT jsonb_agg(jsonb_build_object('table',t.relname,
  'grantee',CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE COALESCE(a.rolname,'other') END,
  'grantor',COALESCE(g.rolname,'other'),'privilege',acl.privilege_type,'grant_option',acl.is_grantable)
  ORDER BY t.relname,acl.grantee,acl.privilege_type) FROM targets t,
  LATERAL aclexplode(COALESCE(t.relacl,acldefault('r',t.relowner))) acl
  LEFT JOIN actors a ON a.oid=acl.grantee LEFT JOIN actors g ON g.oid=acl.grantor),
 'column_grants',(SELECT jsonb_agg(jsonb_build_object('table',t.relname,'column',col.attname,
  'grantee',CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE COALESCE(a.rolname,'other') END,
  'privilege',acl.privilege_type,'grant_option',acl.is_grantable) ORDER BY t.relname,col.attnum,acl.grantee)
  FROM targets t JOIN pg_attribute col ON col.attrelid=t.oid CROSS JOIN LATERAL aclexplode(col.attacl) acl
  LEFT JOIN actors a ON a.oid=acl.grantee WHERE col.attnum>0 AND NOT col.attisdropped),
 'helpers',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
  'owner',COALESCE(a.rolname,'other'),'security_definer',p.prosecdef,'volatility',p.provolatile,
  'search_path_public',COALESCE('search_path=public'=ANY(p.proconfig),false),
  'search_path_catalog',COALESCE('search_path=pg_catalog'=ANY(p.proconfig),false),
  'definition_fingerprint',md5(pg_get_functiondef(p.oid))) ORDER BY p.oid::regprocedure::text)
  FROM helpers p LEFT JOIN actors a ON a.oid=p.proowner),
 'helper_execute',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
  'role',a.rolname,'effective',has_function_privilege(a.oid,p.oid,'EXECUTE')) ORDER BY p.proname,a.rolname)
  FROM helpers p CROSS JOIN actors a),
 'schema_access',(SELECT jsonb_agg(jsonb_build_object('role',a.rolname,
  'usage',has_schema_privilege(a.oid,'public','USAGE'),'create',has_schema_privilege(a.oid,'public','CREATE'))
  ORDER BY a.rolname) FROM actors a),
 'role_memberships',(SELECT jsonb_agg(jsonb_build_object('member',COALESCE(m.rolname,'other'),
  'parent',COALESCE(p.rolname,'other'),'inherit',x.inherit_option,'set',x.set_option,'admin',x.admin_option)
  ORDER BY x.member,x.roleid) FROM pg_auth_members x LEFT JOIN actors m ON m.oid=x.member
  LEFT JOIN actors p ON p.oid=x.roleid WHERE m.oid IS NOT NULL OR p.oid IS NOT NULL),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('table',t.relname,'name',g.tgname,
  'internal',g.tgisinternal,'enabled',g.tgenabled,'function',g.tgfoid::regprocedure::text,
  'definition_fingerprint',md5(pg_get_triggerdef(g.oid))) ORDER BY t.relname,g.tgname)
  FROM targets t JOIN pg_trigger g ON g.tgrelid=t.oid),
 'indexes',(SELECT jsonb_agg(jsonb_build_object('table',t.relname,'primary',i.indisprimary,
  'unique',i.indisunique,'valid',i.indisvalid,'definition_fingerprint',md5(pg_get_indexdef(i.indexrelid)))
  ORDER BY t.relname,i.indexrelid) FROM targets t JOIN pg_index i ON i.indrelid=t.oid),
 'defaults',(SELECT jsonb_agg(jsonb_build_object('creator',a.rolname,'schema',n.nspname,
  'object_type',d.defaclobjtype,'grantee',CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE COALESCE(g.rolname,'other') END,
  'privilege',acl.privilege_type,'grant_option',acl.is_grantable)
  ORDER BY a.rolname,n.nspname,d.defaclobjtype,acl.grantee,acl.privilege_type)
  FROM pg_default_acl d JOIN actors a ON a.oid=d.defaclrole LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
  CROSS JOIN LATERAL aclexplode(d.defaclacl) acl LEFT JOIN actors g ON g.oid=acl.grantee),
 'effective_table_privileges',(SELECT jsonb_agg(jsonb_build_object('table',t.relname,'role',a.rolname,
  'privilege',p.name,'effective',has_table_privilege(a.oid,t.oid,p.name)) ORDER BY t.relname,a.rolname,p.name)
  FROM targets t CROSS JOIN actors a CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
  ('TRUNCATE'),('TRIGGER'),('REFERENCES'),('MAINTAIN')) p(name)),
 'helper_dependencies',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
  'reference_catalog',d.refclassid::regclass::text,'reference_oid',d.refobjid,'reference_subid',d.refobjsubid,
  'dependency_type',d.deptype) ORDER BY p.proname,d.refclassid,d.refobjid)
  FROM helpers p JOIN pg_depend d ON d.classid='pg_proc'::regclass AND d.objid=p.oid),
 'extensions',(SELECT jsonb_agg(jsonb_build_object('name',extname,'version',extversion) ORDER BY extname) FROM pg_extension)
);
