#!/usr/bin/env python3
"""Execute reviewed proposals against supplied public definitions in isolated PG17."""
import ast,json,time
from pathlib import Path
from reconstruct import reconstruct,seed,group,presented
ROOT=Path(__file__).resolve().parents[3]
f=ROOT/'supabase/tests/rls/test_isolated.py';tree=ast.parse(f.read_text());i=next(i for i,n in enumerate(tree.body) if isinstance(n,ast.Try))
ns={'__file__':str(f),'__name__':'definitions_only'}
exec(compile(ast.Module(body=tree.body[:i],type_ignores=[]),str(f),'exec'),ns)
docker,sql,uid=(ns[k] for k in ('docker','sql','uid'));NAME=ns['NAME'];db='real_schema'
try:
    assert docker('run','--pull=never','--network=none','-d','--name',NAME,'--label','washsense.real-metadata-test=true','-e','POSTGRES_USER=lab_root','-e','POSTGRES_HOST_AUTH_METHOD=trust',ns['IMAGE']).returncode==0
    for _ in range(100):
        if docker('exec',NAME,'pg_isready','-h','127.0.0.1','-U','postgres').returncode==0:break
        time.sleep(.2)
    else:raise AssertionError('readiness')
    r=docker('exec',NAME,'psql','-X','-v','ON_ERROR_STOP=1','-U','lab_root','-c','CREATE ROLE postgres LOGIN CREATEDB CREATEROLE BYPASSRLS; CREATE ROLE supabase_admin LOGIN SUPERUSER BYPASSRLS; GRANT supabase_admin TO lab_root;')
    assert r.returncode==0,r.stderr
    r=docker('exec',NAME,'psql','-X','-v','ON_ERROR_STOP=1','-U','lab_root','-c','CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE authenticator NOINHERIT; CREATE ROLE supabase_privileged_role; CREATE ROLE supabase_realtime_admin;')
    assert r.returncode==0,r.stderr
    sql('CREATE DATABASE real_schema;')
    for m in group('10_role_memberships'):
        d=m['details'];r=docker('exec',NAME,'psql','-X','-v','ON_ERROR_STOP=1','-U','lab_root','-c',f'GRANT "{d["role"]}" TO "{m["name"]}"'+(' WITH ADMIN OPTION' if d['admin_option'] else '')+';');assert r.returncode==0,r.stderr
    sql("CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'))::uuid $$; GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role; GRANT USAGE,CREATE ON SCHEMA public TO supabase_admin;",db)
    def bootstrap_sql(body,target):
        r=docker('exec','-i',NAME,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','lab_root','-d',target,input='SET ROLE postgres;\n'+body.replace('ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin"','RESET ROLE; ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin"'))
        assert r.returncode==0,r.stderr
    reconstruct(bootstrap_sql,db)
    for section,query in [('tables',"SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'"),('policies',"SELECT count(*) FROM pg_policy WHERE polrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)"),('constraints',"SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace"),('indexes',"SELECT count(*) FROM pg_indexes WHERE schemaname='public'")]:print('PASS: reconstructed',section,sql(query,db))
    actual=json.loads(sql("SELECT jsonb_agg(jsonb_build_array(c.relname,pg_get_userbyid(a.grantee),pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) ORDER BY c.relname,a.grantee,a.privilege_type) FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE c.relnamespace='public'::regnamespace AND c.relkind='r';",db))
    expected=[[g['name'],g['details']['grantee'],g['details']['grantor'],g['details']['privilege'],g['details']['grant_option']] for g in group('07_table_grants')]
    assert sorted(actual)==sorted(expected)
    print('PASS: all 393 direct table grants match snapshot exactly; no added DML')
    policies=json.loads(sql("SELECT jsonb_agg(jsonb_build_object('name',c.relname||'.'||p.polname,'details',jsonb_build_object('roles',(SELECT jsonb_agg(rolname ORDER BY rolname) FROM pg_roles WHERE oid=ANY(p.polroles)),'using',pg_get_expr(p.polqual,p.polrelid),'with_check',pg_get_expr(p.polwithcheck,p.polrelid),'command',p.polcmd,'permissive',p.polpermissive)) ORDER BY c.relname,p.polname) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace;",db))
    expected_p=[]
    for p in group('03_policies'):
        d=dict(p['details'])
        for key in ['using','with_check']:
            if d[key]:d[key]=presented(d[key])
        expected_p.append({'name':p['name'],'details':d})
    assert policies==expected_p
    defaults=json.loads(sql("SELECT jsonb_agg(jsonb_build_array(pg_get_userbyid(d.defaclrole),d.defaclobjtype,pg_get_userbyid(a.grantee),pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)) FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a WHERE d.defaclnamespace='public'::regnamespace;",db))
    expected_d=[[g['name'].split('.')[1],g['details']['object_type'],g['details']['grantee'],g['details']['grantor'],g['details']['privilege'],g['details']['grant_option']] for g in group('08_default_grants')]
    assert sorted(defaults)==sorted(expected_d)
    for f in group('06_helpers'):
        signature=f['name'].split('(')[0]+'('+('uuid,text[]' if f['name'].startswith('has_org_role') else 'uuid')+')'
        actual_def=sql(f"SELECT pg_get_functiondef('public.{signature}'::regprocedure);",db)
        assert actual_def.replace('\r\n','\n').strip()==presented(f['details']['definition']).replace('\r\n','\n').strip()
    print('PASS: all 41 policy expressions, six helper definitions and 72 public default grants match')
    seed(sql,db,uid)
    recovery_tree=ast.parse((ROOT/'supabase/tests/recovery/test_postcommit.py').read_text())
    snapshot_sql=next(ast.literal_eval(n.value) for n in recovery_tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SNAPSHOT' for t in n.targets))
    def checkpoint(target):
        meta=json.loads(sql(snapshot_sql,target))
        data={t['name']:json.loads(sql(f"SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]') FROM {t['name']} r;",target)) for t in group('01_tables')}
        return meta,data
    before=checkpoint(db)
    assert docker('exec',NAME,'pg_dump','-U','lab_root','-d',db,'--format=custom','--file=/tmp/checkpoint.dump').returncode==0
    # Preserve actual postgres NOSUPERUSER; privileged-role attributes absent are not fabricated.
    assert sql("SELECT rolsuper FROM pg_roles WHERE rolname='postgres';")=='f'
    sql(ns['STRUCTURAL'],db);print('PASS: structural proposal COMMIT with real table grants and postgres NOSUPERUSER')
    defaults_before=sql("SELECT jsonb_agg(to_jsonb(d) ORDER BY oid) FROM pg_default_acl d;",db)
    r=docker('exec','-i',NAME,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',db,input=ns['DEFAULTS'])
    if r.returncode:print('BLOCKED: default proposal with postgres NOSUPERUSER:',r.stderr.strip())
    else:print('PASS: default proposal COMMIT')
    assert sql("SELECT jsonb_agg(to_jsonb(d) ORDER BY oid) FROM pg_default_acl d;",db)==defaults_before
    r=docker('exec','-i',NAME,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d',db,input=ns['DEFAULTS'])
    assert r.returncode==0,r.stderr
    print('PASS: default proposal commits as local supabase_admin; postgres rejection rolls back atomically')
    for creator in ['postgres','supabase_admin']:
        r=docker('exec','-i',NAME,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',creator,'-d',db,input='CREATE TABLE public.future_probe(id integer);')
        assert r.returncode==0,r.stderr
        for role in ['anon','authenticated']:
            for privilege in ['TRUNCATE','TRIGGER','REFERENCES','MAINTAIN']:
                assert sql(f"SELECT has_table_privilege('{role}','future_probe','{privilege}');",db)=='f'
            for privilege in ['SELECT','INSERT','UPDATE','DELETE']:
                expected=any(g['name']=='public.'+creator and g['details']['object_type']=='r' and g['details']['grantee']==role and g['details']['privilege']==privilege for g in group('08_default_grants'))
                assert sql(f"SELECT has_table_privilege('{role}','future_probe','{privilege}');",db)==('t' if expected else 'f')
        assert docker('exec',NAME,'psql','-X','-v','ON_ERROR_STOP=1','-U',creator,'-d',db,'-c','DROP TABLE public.future_probe;').returncode==0
    print('PASS: future objects from both creators lose structural defaults while original DML defaults remain')
    ns['apply'](db);print('PASS: operational RLS proposal COMMIT against all real policies/constraints/helpers')
    for table in ['machines','sensors','maintenance']:
        assert sql(f"SELECT has_table_privilege('authenticated','{table}','SELECT,INSERT,UPDATE,DELETE');",db)=='f'
    print('PASS: original DML absence preserved; role-based writes BLOCKED, not RLS exploits')
    for role in ['anon','authenticated','service_role']:
        sql(f'BEGIN; SET ROLE {role}; UPDATE machines SET name=name; ROLLBACK;',db,error='permission denied')
    print('PASS: three API roles receive SQL permission denied on machine writes')
    sql(f"INSERT INTO sensors(id,device_id,reservoir_id,machine_id,sensor_type) VALUES ('{uid(501)}','{uid(301)}','{uid(402)}','{uid(102)}','synthetic'); INSERT INTO maintenance(id,unit_id,device_id,machine_id,maintenance_type) VALUES ('{uid(601)}','{uid(11)}','{uid(302)}','{uid(102)}','synthetic');",db)
    for table,n in [('machines',101),('devices',301),('reservoirs',401)]:
        sql(f"UPDATE {table} SET unit_id='{uid(12)}' WHERE id='{uid(n)}';",db)
        sql(f"UPDATE {table} SET unit_id='{uid(21)}' WHERE id='{uid(n)}';",db,error='23514' if False else 'organization')
    print('PASS: owner writes same-org multiunit allowed; cross-org parent transfers denied')
    sql(f"UPDATE units SET organization_id='{uid(2)}' WHERE id='{uid(11)}';",db,error='organization')
    sql(f"UPDATE sensors SET reservoir_id='{uid(421)}' WHERE id='{uid(501)}';",db,error='organization')
    sql(f"UPDATE maintenance SET device_id='{uid(321)}' WHERE id='{uid(601)}';",db,error='organization')
    print('PASS: parent organizational identity and sensor/maintenance cross-org links guarded')
    sql('CREATE DATABASE recovered OWNER postgres;')
    restored=docker('exec',NAME,'pg_restore','-U','lab_root','--dbname=recovered','--exit-on-error','/tmp/checkpoint.dump')
    assert restored.returncode==0,restored.stderr
    assert checkpoint('recovered')==before
    print('PASS: reused post-COMMIT recovery assertions preserve original metadata, policies, grants and fake data')
    print('PostgreSQL:',sql('SHOW server_version;'))
finally:docker('rm','-f','-v',NAME)
