#!/usr/bin/env python3
"""Execute reviewed proposals against supplied public definitions in isolated PG17."""
import ast,json,time
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"snapshot"))
from reconstruct import reconstruct,seed,group,presented
from contracts import DML,READS,finance_seed,energy_fixture,energy_apply
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
    seed(sql,db,uid)
    finance_seed(sql,db,uid)
    def acl():
        return sql("SELECT jsonb_agg(jsonb_build_array(oid,relacl::text) ORDER BY oid) FROM pg_class WHERE relnamespace='public'::regnamespace;",db)
    before=acl();sql(DML,db);assert acl()==before
    print('PASS: pending DML proposal is ACL-idempotent against real snapshot; no broadening')
    sql('CREATE POLICY dml_drift_fixture ON organizations FOR SELECT TO authenticated USING(true);',db)
    sql(DML,db,error='Unverified SELECT policy/tenant contract')
    assert acl()==before
    sql('DROP POLICY dml_drift_fixture ON organizations;',db)
    print('PASS: extra permissive read policy blocks grant preparation without ACL drift')
    for table in READS:
        sql(f'REVOKE SELECT ON {table} FROM authenticated;',db)
    sql(DML,db)
    for table,columns in READS.items():
        assert sql(f"SELECT has_table_privilege('authenticated','{table}','SELECT');",db)=='f'
        for column in columns.split(','):
            assert sql(f"SELECT has_column_privilege('authenticated','{table}','{column}','SELECT');",db)=='t'
    assert sql("SELECT has_column_privilege('authenticated','subscriptions','asaas_customer_id','SELECT');",db)=='f'
    print('PASS: missing reads restored with only evidenced column SELECT, not table SELECT or unused financial fields')
    for org in [1,2]:
        actor=uid(1000+org)
        sql(f"INSERT INTO auth.users VALUES ('{actor}'); INSERT INTO profiles(id) VALUES ('{actor}'); INSERT INTO organization_members(user_id,organization_id,role) VALUES ('{actor}','{uid(org)}','operator');",db)
        for table in ['organizations','subscriptions','payments']:
            predicate='id' if table=='organizations' else 'organization_id'
            r=sql(f"BEGIN; SET ROLE authenticated; SET LOCAL request.jwt.claim.sub='{actor}'; SELECT count(*) FROM {table} WHERE {predicate}='{uid(3-org)}'; ROLLBACK;",db)
            assert r.splitlines()[-1]=='0'
    print('PASS: actual PostgreSQL RLS SELECT with synthetic claims hides foreign organizations/subscriptions/payments')
    for table in READS:
        for statement in [f'DELETE FROM {table}',f'UPDATE {table} SET id=id' if table!='organization_members' else 'UPDATE organization_members SET role=role',f'INSERT INTO {table} DEFAULT VALUES']:
            sql('BEGIN; SET ROLE authenticated; '+statement+'; ROLLBACK;',db,error='permission denied')
        sql('BEGIN; SET ROLE anon; SELECT '+READS[table]+' FROM '+table+'; ROLLBACK;',db,error='permission denied')
    print('PASS: financial INSERT/UPDATE/DELETE and anonymous SELECT denied')
    sql(ns['STRUCTURAL'],db)
    r=docker('exec','-i',NAME,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d',db,input=ns['DEFAULTS'])
    assert r.returncode==0,r.stderr
    ns['apply'](db)
    print('PASS: DML proposal composes with all three unchanged security proposals')
    sql(f"INSERT INTO sensors(device_id,reservoir_id,machine_id,sensor_type) VALUES ('{uid(301)}','{uid(402)}','{uid(102)}','synthetic'); INSERT INTO maintenance(unit_id,device_id,machine_id,maintenance_type) VALUES ('{uid(11)}','{uid(302)}','{uid(102)}','synthetic');",db)
    for table,n in [('machines',101),('devices',301),('reservoirs',401)]:
        sql(f"UPDATE {table} SET unit_id='{uid(12)}' WHERE id='{uid(n)}';",db)
        sql(f"UPDATE {table} SET unit_id='{uid(21)}' WHERE id='{uid(n)}';",db,error='organization')
    sql(f"UPDATE units SET organization_id='{uid(2)}' WHERE id='{uid(11)}';",db,error='organization')
    sql(f"UPDATE sensors SET reservoir_id='{uid(421)}';",db,error='organization')
    sql(f"UPDATE maintenance SET device_id='{uid(321)}';",db,error='organization')
    print('PASS: owner BYPASSRLS multiunit links/transfers allowed within organization; cross-organization changes denied')
    for role in ['authenticated','service_role']:
        sql(f'BEGIN; SET ROLE {role}; UPDATE machines SET unit_id=unit_id; ROLLBACK;',db,error='permission denied')
    print('PASS: no operational DML grant introduced to bypass permissions or organization guards')
    energy_fixture(sql,db)
    sql("SET washsense.energy_dml_approved='on'; "+DML,db,error='Missing/drifted reviewed energy baseline')
    sql('RESET washsense.energy_dml_approved;',db)
    print('PASS: conditional energy grants fail closed without reviewed baseline')
    energy_apply(sql,db)
    for privilege in ['SELECT','INSERT','UPDATE']:
        assert sql(f"SELECT has_table_privilege('service_role','energy_tariffs','{privilege}');",db)=='t'
    for privilege in ['DELETE','TRUNCATE','TRIGGER','REFERENCES','MAINTAIN']:
        assert sql(f"SELECT has_table_privilege('service_role','energy_tariffs','{privilege}');",db)=='f'
    print('PASS: isolated versioned energy contract grants exactly service SELECT/INSERT/UPDATE')
    print('BLOCKED: remote energy table/schema and Asaas/IoT backend contracts not supplied; no production approval')
    print('PostgreSQL:',sql('SHOW server_version;'))
finally:docker('rm','-f','-v',NAME)
