#!/usr/bin/env python3
"""New test only: checkpoint before COMMIT, restore into a separate disposable DB."""
import ast
import json
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
fixture = ROOT / 'supabase/tests/rls/test_isolated.py'
tree = ast.parse(fixture.read_text())
main = next(i for i, node in enumerate(tree.body) if isinstance(node, ast.Try))
namespace = {'__file__': str(fixture), '__name__': 'fixture_definitions_only'}
exec(compile(ast.Module(body=tree.body[:main], type_ignores=[]), str(fixture), 'exec'), namespace)
# Reuse reviewed fixture definitions, never the previously passed test runner.
docker, sql, setup = (namespace[k] for k in ('docker', 'sql', 'setup'))
NAME, IMAGE = (namespace[k] for k in ('NAME', 'IMAGE'))

SNAPSHOT = """
SELECT jsonb_build_object(
 'schemas',(SELECT jsonb_agg(jsonb_build_array(n.nspname,n.nspowner::regrole::text,n.nspacl::text) ORDER BY n.nspname) FROM pg_namespace n WHERE n.nspname IN ('auth','public')),
 'column_acls',(SELECT jsonb_agg(jsonb_build_array(c.relname,a.attname,a.attacl::text) ORDER BY c.relname,a.attnum) FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid WHERE c.relnamespace='public'::regnamespace AND a.attnum>0 AND NOT a.attisdropped),
 'policies',(SELECT jsonb_agg(jsonb_build_array(c.relname,p.polname,p.polcmd,
   p.polpermissive,p.polroles,pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid))
   ORDER BY c.relname,p.polname) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
   WHERE c.relnamespace='public'::regnamespace),
 'acls',(SELECT jsonb_agg(jsonb_build_array(c.relname,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity)
   ORDER BY c.relname) FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'),
 'defaults',(SELECT jsonb_agg(jsonb_build_array(d.defaclrole::regrole::text,
   n.nspname,d.defaclobjtype,d.defaclacl::text) ORDER BY d.defaclrole,n.nspname,d.defaclobjtype)
   FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace),
 'functions',(SELECT jsonb_agg(jsonb_build_array(p.oid::regprocedure::text,
   pg_get_userbyid(p.proowner),p.proacl::text,pg_get_functiondef(p.oid)) ORDER BY p.oid::regprocedure::text)
   FROM pg_proc p WHERE p.pronamespace IN ('public'::regnamespace,'auth'::regnamespace)),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.relname,k.conname,pg_get_constraintdef(k.oid))
   ORDER BY c.relname,k.conname) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
   WHERE c.relnamespace='public'::regnamespace));
"""

def snapshot(db):
    meta = json.loads(sql(SNAPSHOT, db))
    tables = sql("SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY relname;", db).splitlines()
    data = {table: json.loads(sql(f"SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]') FROM {table} r;", db)) for table in tables}
    return meta, data

try:
    run = docker('run','--pull=never','--network=none','--rm','-d','--name',NAME,
                 '--label','washsense.synthetic-recovery-test=true',
                 '-e','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE)
    assert run.returncode == 0, 'Disposable PostgreSQL unavailable'
    for _ in range(60):
        if docker('exec',NAME,'pg_isready','-h','127.0.0.1','-U','postgres').returncode == 0: break
        time.sleep(0.2)
    else: raise AssertionError('Final PostgreSQL not ready')
    sql('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE supabase_admin;')
    setup('checkpoint')
    sql('GRANT UPDATE(label) ON machines TO anon;', 'checkpoint')
    inventory=json.loads(sql((ROOT/'supabase/security/remote_metadata_sanitized.sql').read_text(),'checkpoint'))
    assert len(inventory['tables'])==19 and len(inventory['helpers'])==6
    print('PASS: single sanitized metadata SELECT validated locally; no remote execution')
    before = snapshot('checkpoint')
    backup = docker('exec',NAME,'pg_dump','-U','postgres','-d','checkpoint','--format=custom','--file=/tmp/synthetic-checkpoint.dump')
    assert backup.returncode == 0, 'Local checkpoint failed'
    sql(namespace['STRUCTURAL'], 'checkpoint')
    sql(namespace['DEFAULTS'], 'checkpoint')
    namespace['apply']('checkpoint')
    assert snapshot('checkpoint') != before, 'Security proposals did not commit'
    print('PASS: three proposals committed after a pre-change synthetic checkpoint')
    sql('CREATE DATABASE recovered;')
    restored = docker('exec',NAME,'pg_restore','-U','postgres','--dbname=recovered','--exit-on-error','/tmp/synthetic-checkpoint.dump')
    assert restored.returncode == 0, 'Isolated restore failed'
    assert snapshot('recovered') == before, 'Recovered metadata/data differ from checkpoint'
    print('PASS: post-COMMIT recovery preserves policies, table ACLs, RLS, defaults, functions, constraints and every synthetic row')
    assert snapshot('checkpoint') != before, 'Recovery unexpectedly changed the hardened source'
    print('PASS: recovery uses a separate database; hardened source stays unchanged')
    namespace['attempt']('recovered',1003,namespace['update']('machines',101),1)
    assert sql("SELECT has_table_privilege('anon','machines','TRUNCATE');",'recovered') == 't'
    print('PASS: original behavior/privileges restored exactly; old permissions must never be reopened automatically in production')
    print('PostgreSQL:', sql('SHOW server_version;'))
finally:
    docker('rm','-f','-v',NAME)
