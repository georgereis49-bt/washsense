#!/usr/bin/env python3
"""Policy/association proposal tests; synthetic claims, not remote Auth or schema."""
import json
import subprocess
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DRAFT = (ROOT / 'supabase/security/20261012_harden_operational_rls.sql.pending').read_text()
PREFLIGHT = (ROOT / 'supabase/security/20261012_rls_preflight.sql').read_text()
IMAGE = 'postgres:17@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3'
NAME = 'washsense-rls-test-' + uuid.uuid4().hex[:12]
ACTORS = ['admin','manager','technician','operator']

def uid(n):
    return str(uuid.UUID(int=n))

def docker(*args, **kw):
    return subprocess.run(['docker',*args],capture_output=True,text=True,timeout=120,**kw)

def sql(body, db='postgres', error=None):
    r=docker('exec','-i',NAME,'psql','-X','-qAt','-v','ON_ERROR_STOP=1',
             '-U','postgres','-d',db,input=body)
    if error:
        assert r.returncode and error in r.stderr, r.stderr or r.stdout
    else:
        assert r.returncode==0, r.stderr
    return r.stdout.strip()

def setup(db):
    sql(f'CREATE DATABASE {db};')
    sql("""
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE TABLE public.organization_members(user_id uuid, organization_id uuid, role text);
      CREATE TABLE public.units(id uuid PRIMARY KEY, organization_id uuid NOT NULL);
      CREATE TABLE public.unit_blocks(user_id uuid, unit_id uuid REFERENCES units(id));
      CREATE TABLE public.machines(id uuid PRIMARY KEY, unit_id uuid REFERENCES units(id), label text);
      CREATE TABLE public.maintenance(id uuid PRIMARY KEY, unit_id uuid REFERENCES units(id), label text);
      CREATE TABLE public.devices(id uuid PRIMARY KEY, unit_id uuid REFERENCES units(id));
      CREATE TABLE public.reservoirs(id uuid PRIMARY KEY, unit_id uuid REFERENCES units(id));
      CREATE TABLE public.sensors(id uuid PRIMARY KEY, device_id uuid REFERENCES devices(id),
        reservoir_id uuid REFERENCES reservoirs(id), machine_id uuid REFERENCES machines(id), label text);
      CREATE FUNCTION public.has_org_role(org uuid, roles text[]) RETURNS boolean LANGUAGE sql
        STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT EXISTS
        (SELECT 1 FROM public.organization_members WHERE user_id=auth.uid()
          AND organization_id=org AND role=ANY(roles)) $$;
      CREATE FUNCTION public.has_org_access(org uuid) RETURNS boolean LANGUAGE sql
        STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT EXISTS
        (SELECT 1 FROM public.organization_members WHERE user_id=auth.uid()
          AND organization_id=org) $$;
      CREATE FUNCTION public.has_unit_access(unit uuid) RETURNS boolean LANGUAGE sql
        STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT public.has_org_access
        ((SELECT organization_id FROM public.units WHERE id=unit)) AND NOT EXISTS
        (SELECT 1 FROM public.unit_blocks WHERE user_id=auth.uid() AND unit_id=unit) $$;
    """,db)
    for resource,table in [('machine','machines'),('device','devices'),('reservoir','reservoirs')]:
        sql(f"CREATE FUNCTION public.has_{resource}_access(resource uuid) RETURNS boolean "
            f"LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ "
            f"SELECT public.has_unit_access((SELECT unit_id FROM public.{table} WHERE id=resource)) $$;",db)
    read_rules={
        'units':'has_unit_access(id)', 'machines':'has_machine_access(id)',
        'maintenance':'has_unit_access(unit_id)', 'devices':'has_device_access(id)',
        'reservoirs':'has_reservoir_access(id)',
        'sensors':'has_device_access(device_id) OR has_reservoir_access(reservoir_id) OR has_machine_access(machine_id)',
    }
    for table,rule in read_rules.items():
        sql(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY; '
            f'CREATE POLICY fixture_read ON {table} FOR SELECT TO authenticated USING ({rule});',db)
    sql("""
      CREATE POLICY machines_update_managers ON machines FOR UPDATE TO authenticated
        USING (has_machine_access(id)) WITH CHECK (has_unit_access(unit_id));
      CREATE POLICY maintenance_update_technicians ON maintenance FOR UPDATE TO authenticated
        USING (has_unit_access(unit_id)) WITH CHECK (has_unit_access(unit_id));
      CREATE POLICY sensors_insert_technicians ON sensors FOR INSERT TO authenticated WITH CHECK
        (has_device_access(device_id) OR has_reservoir_access(reservoir_id) OR has_machine_access(machine_id));
      CREATE POLICY sensors_update_technicians ON sensors FOR UPDATE TO authenticated USING
        (has_device_access(device_id) OR has_reservoir_access(reservoir_id) OR has_machine_access(machine_id))
        WITH CHECK (has_device_access(device_id) OR has_reservoir_access(reservoir_id) OR has_machine_access(machine_id));
      GRANT USAGE ON SCHEMA public,auth TO authenticated,service_role;
      GRANT SELECT,INSERT,UPDATE ON machines,maintenance,sensors TO authenticated;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    """,db)
    for unit,org in [(11,1),(12,1),(21,2)]:
        sql(f"INSERT INTO units VALUES ('{uid(unit)}','{uid(org)}');",db)
    for table,entries in [('machines',[(101,11),(102,12),(121,21)]),
                          ('maintenance',[(601,11),(621,21)]),
                          ('devices',[(301,11),(302,12),(321,21)]),
                          ('reservoirs',[(401,11),(402,12),(421,21)])]:
        for id,unit in entries:
            cols='id,unit_id'
            sql(f"INSERT INTO {table} ({cols}) VALUES ('{uid(id)}','{uid(unit)}');",db)
    for id,dev,tank,machine in [(501,301,401,101),(521,321,421,121)]:
        sql(f"INSERT INTO sensors VALUES ('{uid(id)}','{uid(dev)}','{uid(tank)}','{uid(machine)}','original');",db)
    for org in [1,2]:
        for i,role in enumerate(ACTORS):
            sql(f"INSERT INTO organization_members VALUES ('{uid(org*1000+i)}','{uid(org)}','{role}');",db)
    for actor,org,role in [(3333,1,'admin'),(3333,2,'admin'),(4444,1,'technician'),(4444,2,'operator'),
                           (5555,1,'admin'),(5555,2,'operator')]:
        sql(f"INSERT INTO organization_members VALUES ('{uid(actor)}','{uid(org)}','{role}');",db)
    sql(f"INSERT INTO unit_blocks VALUES ('{uid(1002)}','{uid(12)}');",db)

def baseline(db):
    return json.loads(sql(PREFLIGHT,db).splitlines()[0])

def apply(db, before=None, approved=True, error=None):
    settings=f"SET washsense.rls_contract_approved = '{'on' if approved else 'off'}';\n"
    settings += "SET washsense.rls_policy_baseline = '"+json.dumps(before or baseline(db)).replace("'","''")+"';\n"
    return sql(settings+DRAFT,db,error)

def attempt(db, actor, statement, expected=None, error=None, role='authenticated'):
    out=sql(f"BEGIN; SET ROLE {role}; SET request.jwt.claim.sub='{uid(actor)}';\n"
            +statement+'\nROLLBACK;',db,error)
    if expected is not None:
        assert out==str(expected), out

def update(table,id,expr="label='edited'"):
    return f"WITH changed AS (UPDATE {table} SET {expr} WHERE id='{uid(id)}' RETURNING id) SELECT count(*) FROM changed;"

def insert_sensor(dev,tank=None,machine=None):
    values=[f"'{uid(v)}'" if v else 'NULL' for v in [900,dev,tank,machine]]
    return 'INSERT INTO sensors(id,device_id,reservoir_id,machine_id) VALUES ('+','.join(values)+');'

try:
    result=docker('run','--rm','-d','--name',NAME,'--label','washsense.synthetic-rls-test=true',
                  '-e','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE)
    assert result.returncode==0,result.stderr
    for _ in range(60):
        if docker('exec',NAME,'pg_isready','-U','postgres').returncode==0: break
        time.sleep(1)
    else: raise AssertionError('PostgreSQL not ready')
    sql('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;')
    setup('positive')
    old=baseline('positive')
    data_sql="SELECT jsonb_agg(x ORDER BY x::text) FROM (" + " UNION ALL ".join(
        f"SELECT jsonb_build_object('table','{t}','row',to_jsonb(r)) AS x FROM {t} r"
        for t in ['machines','maintenance','sensors','devices','reservoirs','units']) + ") rows;"
    original_data=sql(data_sql,'positive')
    grants=sql("SELECT relname,relacl::text FROM pg_class WHERE relnamespace='public'::regnamespace ORDER BY relname;",'positive')
    attempt('positive',1003,update('machines',101),1)  # Reproduce operator weakness in synthetic model.
    attempt('positive',1002,insert_sensor(301,421),error=None)  # OR permits mixed organizations before proposal.
    apply('positive',old)
    assert sql("SELECT relname,relacl::text FROM pg_class WHERE relnamespace='public'::regnamespace ORDER BY relname;",'positive')==grants
    new=baseline('positive')
    assert [p for p in old if p['name']=='fixture_read']==[p for p in new if p['name']=='fixture_read']
    for org in [1,2]:
        for i,role in enumerate(ACTORS):
            actor=org*1000+i
            own_machine,other_machine=(101,121) if org==1 else (121,101)
            own_maintenance=601 if org==1 else 621
            own_sensor=501 if org==1 else 521
            dev=301 if org==1 else 321
            attempt('positive',actor,update('machines',own_machine),int(role in ['admin','manager']))
            attempt('positive',actor,update('machines',other_machine),0)
            attempt('positive',actor,f"SELECT count(*) FROM machines WHERE id='{uid(other_machine)}';",0)
            foreign_sensor=521 if org==1 else 501
            attempt('positive',actor,f"SELECT count(*) FROM sensors WHERE id='{uid(foreign_sensor)}';",0)
            attempt('positive',actor,update('maintenance',own_maintenance),int(role!='operator'))
            attempt('positive',actor,update('sensors',own_sensor),int(role!='operator'))
            attempt('positive',actor,insert_sensor(dev),error='row-level security' if role=='operator' else None)
    print('PASS: both organizations × four roles; machines/maintenance/sensors authorization')
    for statement in [update('machines',101,f"unit_id='{uid(21)}'"),
                      update('maintenance',601,f"unit_id='{uid(21)}'"),
                      update('sensors',501,f"device_id='{uid(321)}',reservoir_id='{uid(421)}',machine_id='{uid(121)}'"),
                      insert_sensor(301,421),insert_sensor(None)]:
        attempt('positive',3333,statement,error='Invalid association or cross-organization transfer')
    attempt('positive',3333,update('machines',101,f"unit_id='{uid(12)}'"),1)
    attempt('positive',1000,insert_sensor(301,402,102))
    attempt('positive',1002,insert_sensor(301,402),error='row-level security')
    # Isolate WITH CHECK from the independent transfer trigger in this fixture only.
    sql('ALTER TABLE machines DISABLE TRIGGER washsense_rls_org_guard;','positive')
    attempt('positive',5555,update('machines',101,f"unit_id='{uid(21)}'"),error='row-level security')
    sql('ALTER TABLE machines ENABLE TRIGGER washsense_rls_org_guard;','positive')
    attempt('positive',4444,update('sensors',521),0)
    attempt('positive',0,insert_sensor(301),role='service_role')
    attempt('positive',0,insert_sensor(301,421),role='service_role',error='Invalid association')
    attempt('positive',1000,f"SELECT public.washsense_rls_sensor_org('{uid(301)}',NULL,NULL);",error='permission denied')
    print('PASS: dual memberships, cross-tenant transfers, coherent multiple links, private resolver and service integrity')
    print('PASS: destination role WITH CHECK and every populated link/unit checked independently')
    sql('REVOKE UPDATE ON machines FROM authenticated; REVOKE INSERT ON sensors FROM authenticated;','positive')
    attempt('positive',1000,update('machines',101),error='permission denied')
    attempt('positive',1000,insert_sensor(301),error='permission denied')
    print('PASS: RLS never supplies missing INSERT/UPDATE grants')
    # Deliberately document the remaining parent-move hole; not a passing isolation claim.
    assert sql(f"BEGIN; UPDATE devices SET unit_id='{uid(21)}' WHERE id='{uid(301)}'; "
        f"SELECT public.washsense_rls_sensor_org(device_id,reservoir_id,machine_id) IS NULL "
        f"FROM sensors WHERE id='{uid(501)}'; ROLLBACK;",'positive')=='t'
    assert sql(data_sql,'positive')==original_data
    print('KNOWN GAP: parent moves can invalidate associations; requires schema-wide constraints/guards before approval')
    for db,change,reason in [
        ('extra',"CREATE POLICY unexpected_write ON machines FOR UPDATE TO authenticated USING(true);",'Additional permissive'),
        ('shape','ALTER TABLE reservoirs RENAME COLUMN unit_id TO unverified_unit;','Unverified UUID/schema'),
        ('drift','ALTER POLICY machines_update_managers ON machines USING(true);','Missing/drifted full policy baseline')]:
        setup(db); before=baseline(db); sql(change,db)
        if db=='extra': before=baseline(db)
        apply(db,before,error=reason)
        assert sql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'washsense_rls_%';",db)=='0'
        print('PASS: proposal refusal/rollback:',db)
    setup('unapproved');apply('unapproved',approved=False,error='Unapproved schema/business')
    print('PASS: unapproved contract refused; PostgreSQL',sql('SHOW server_version;'))
finally:
    docker('rm','-f','-v',NAME)
