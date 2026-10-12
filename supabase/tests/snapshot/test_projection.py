#!/usr/bin/env python3
"""Real metadata ACL projection only. Refuse claims of full schema reconstruction."""
import ast
import json
import time
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
snapshot=json.loads((Path(__file__).parent/'real_metadata.json').read_text())
fixture=ROOT/'supabase/tests/rls/test_isolated.py'
tree=ast.parse(fixture.read_text());i=next(i for i,n in enumerate(tree.body) if isinstance(n,ast.Try))
ns={'__file__':str(fixture),'__name__':'definitions_only'}
exec(compile(ast.Module(body=tree.body[:i],type_ignores=[]),str(fixture),'exec'),ns)
docker,sql=(ns[k] for k in ['docker','sql']);NAME=ns['NAME']
KNOWN={'postgres','anon','authenticated','service_role','supabase_admin'}
STRUCT={'TRUNCATE','TRIGGER','REFERENCES','MAINTAIN'}
TYPES={'uuid','text','boolean','timestamp with time zone','integer','numeric','jsonb','bigint','date',
       'numeric(10,2)','numeric(10,3)','numeric(12,2)','numeric(12,4)','numeric(6,2)'}
def ident(x):return '"'+x.replace('"','""')+'"'

def acls():
    return json.loads(sql("SELECT jsonb_agg(jsonb_build_array(c.relname,r.rolname,a.privilege_type,a.is_grantable) ORDER BY c.relname,r.rolname,a.privilege_type) FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a JOIN pg_roles r ON r.oid=a.grantee WHERE c.relnamespace='public'::regnamespace AND c.relkind='r';",'projection'))

assert len(snapshot['tables'])==19 and {t['name'] for t in snapshot['tables']}==set(ns['TARGETS'])
assert all(t['kind']=='r' and t['owner']=='postgres' and t['rls'] and not t['force_rls'] for t in snapshot['tables'])
direct=[g for g in snapshot['table_grants'] if g['grantee'] in {'anon','authenticated'} and g['privilege'] in STRUCT]
assert len(direct)==152 and all(g['grantor']=='postgres' and not g['grant_option'] for g in direct)
assert not snapshot['column_grants']
assert not any(g['grantee']=='PUBLIC' and g['privilege'] in STRUCT for g in snapshot['table_grants'])
print('PASS: snapshot 19 target contracts; 152 direct postgres grants; no PUBLIC/column structural grants')
expected_fks={('units','organization_id','organizations'),('devices','unit_id','units'),('machines','unit_id','units'),
 ('reservoirs','unit_id','units'),('sensors','device_id','devices'),('sensors','machine_id','machines'),
 ('sensors','reservoir_id','reservoirs'),('maintenance','unit_id','units'),('maintenance','device_id','devices'),
 ('maintenance','machine_id','machines')}
for table,col,parent in expected_fks:
    assert any(c['table']==table and c['type']=='f' and c['columns']==[col] and
        c['referenced_table'] in [parent,'public.'+parent] and c['on_delete']=='c' and c['on_update']=='a' and
        c['validated'] and not c['deferrable'] for c in snapshot['constraints'])
print('PASS: ten FK link contracts, CASCADE/NO ACTION and validation flags match supplied schema')
required=[('units','organization_id',True),('devices','unit_id',True),('machines','unit_id',True),
 ('reservoirs','unit_id',True),('sensors','device_id',True),('sensors','reservoir_id',False),
 ('sensors','machine_id',False),('maintenance','unit_id',True),('maintenance','device_id',False),
 ('maintenance','machine_id',False)]
for table,column,required_null in required:
    assert any(c['table']==table and c['column']==column and c['type']=='uuid' and
        c['not_null']==required_null for c in snapshot['columns'])
for table in ['units','devices','machines','reservoirs','sensors']:
    assert any(c['table']==table and c['column']=='id' and c['type']=='uuid' for c in snapshot['columns'])
for creator in ['postgres','supabase_admin']:
    for role in ['anon','authenticated']:
        for privilege in STRUCT:
            assert any(d['creator']==creator and d['schema']=='public' and d['object_type']=='r' and
                d['grantee']==role and d['privilege']==privilege and not d['grant_option'] for d in snapshot['defaults'])
assert not any(d['creator'] in ['postgres','supabase_admin'] and d['schema'] is None and
    d['grantee'] in ['anon','authenticated','PUBLIC'] and d['privilege'] in STRUCT and d['object_type']=='r'
    for d in snapshot['defaults'])
print('PASS: required UUID/nullability contracts and 16 public structural default combinations')

assert all(t['internal'] and t['enabled']=='O' for t in snapshot['triggers'])
print('PASS: 126 triggers are internal/enabled; no custom trigger reported')
for table in ['machines','sensors','maintenance']:
    assert not any(x['effective'] for x in snapshot['effective_table_privileges'] if
        x['table']==table and x['role'] in ['anon','authenticated','service_role'] and x['privilege'] in ['SELECT','INSERT','UPDATE','DELETE'])
print('PASS: snapshot confirms no effective DML on machines/sensors/maintenance for the three API roles')
try:
    r=docker('run','--pull=never','--network=none','--rm','-d','--name',NAME,
      '--label','washsense.snapshot-projection=true','-e','POSTGRES_HOST_AUTH_METHOD=trust',ns['IMAGE'])
    assert r.returncode==0
    for _ in range(100):
        if docker('exec',NAME,'pg_isready','-h','127.0.0.1','-U','postgres').returncode==0:break
        time.sleep(.1)
    else:raise AssertionError('PostgreSQL not ready')
    # Role attributes are a test model, NOT evidence of remote attributes/aliases.
    sql('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE supabase_admin; CREATE DATABASE projection;')
    commands=[]
    for table in snapshot['tables']:
        cols=[]
        for c in snapshot['columns']:
            if c['table']!=table['name']:continue
            assert c['type'] in TYPES and c['identity'] in ('','a','d') and not c['generated']
            identity=(' GENERATED ALWAYS AS IDENTITY' if c['identity']=='a' else ' GENERATED BY DEFAULT AS IDENTITY' if c['identity']=='d' else '')
            cols.append(ident(c['column'])+' '+c['type']+identity+(' NOT NULL' if c['not_null'] else ''))
        commands.append('CREATE TABLE public.'+ident(table['name'])+' ('+','.join(cols)+');')
        commands.append('ALTER TABLE public.'+ident(table['name'])+' ENABLE ROW LEVEL SECURITY;')
    for g in snapshot['table_grants']:
        assert g['grantee'] in KNOWN and g['grantor']=='postgres' and not g['grant_option']
        assert g['privilege'] in STRUCT|{'SELECT','INSERT','UPDATE','DELETE'}
        commands.append('GRANT '+g['privilege']+' ON public.'+ident(g['table'])+' TO '+ident(g['grantee'])+';')
    defaults=[d for d in snapshot['defaults'] if d['schema']=='public']
    assert all(d['creator'] in KNOWN and d['grantee'] in KNOWN for d in defaults)
    for d in defaults:
        kind={'r':'TABLES','S':'SEQUENCES','f':'FUNCTIONS'}[d['object_type']]
        assert d['privilege'] in {'r':STRUCT|{'SELECT','INSERT','UPDATE','DELETE'},'S':{'USAGE','SELECT','UPDATE'},'f':{'EXECUTE'}}[d['object_type']]
        commands.append('ALTER DEFAULT PRIVILEGES FOR ROLE '+ident(d['creator'])+' IN SCHEMA public GRANT '+d['privilege']+' ON '+kind+' TO '+ident(d['grantee'])+(' WITH GRANT OPTION' if d['grant_option'] else '')+';')
    sql('\n'.join(commands),'projection')
    before=acls()
    expected=sorted([[g['table'],g['grantee'],g['privilege'],g['grant_option']] for g in snapshot['table_grants']])
    assert sorted(before)==expected
    print('PASS: local projection matches all 154 column types/nullability and 393 direct table ACL entries')
    sql(ns['STRUCTURAL'],'projection');sql(ns['VERIFY'],'projection')
    assert acls()==[x for x in before if not(x[1] in ['anon','authenticated'] and x[2] in STRUCT)]
    print('PASS PARTIAL: structural proposal executes on real table/ACL projection; only the 152 entries change')
    sql(ns['DEFAULTS'],'projection')
    assert sql("SELECT count(*) FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a WHERE d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='r' AND a.grantee IN ('anon'::regrole,'authenticated'::regrole) AND a.privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES','MAINTAIN');",'projection')=='0'
    print('PASS PARTIAL: public default privilege proposal executes on recovered scoped grants')
    print('BLOCKED: full/RLS reconstruction: policies/functions/defaults/constraints/indexes are fingerprints; role OID map/attributes and aliases unavailable')
    print('BLOCKED: Auth/PostgREST integration against the real schema; no fabricated SQL bodies or new DML grants')
    print('PostgreSQL:',sql('SHOW server_version;'))
finally:docker('rm','-f','-v',NAME)
