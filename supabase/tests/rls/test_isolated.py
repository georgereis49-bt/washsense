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
SECURITY = ROOT / 'supabase/security'
STRUCTURAL = (SECURITY / '20261012_harden_structural_privileges.sql.pending').read_text()
DEFAULTS = (SECURITY / '20261012_harden_default_privileges.sql.pending').read_text()
VERIFY = (SECURITY / '20261012_structural_privileges_verify.sql').read_text()
TARGETS = ['organizations','organization_members','units','machines','reservoirs',
           'devices','sensors','machine_readings','reservoir_readings','payments',
           'subscriptions','alerts','maintenance','audit_logs','consumption_records',
           'machine_cycles','plans','profiles','reservoir_refills']
NAME = 'washsense-rls-test-' + uuid.uuid4().hex[:12]
ACTORS = ['admin','manager','technician','operator']

def uid(n):
    return str(uuid.UUID(int=n))

# Refuse remote daemons before any daemon request. Context inspect is local metadata.
_context = subprocess.run(['docker','context','inspect','--format','{{json .Endpoints.docker.Host}}'],
                          capture_output=True,text=True,timeout=15)
assert _context.returncode == 0, 'Docker context metadata unavailable'
ENDPOINT = json.loads(_context.stdout)
assert ENDPOINT == 'unix:///var/run/docker.sock', 'Only the local Linux Docker socket is allowed'

def docker(*args, **kw):
    return subprocess.run(['docker','--host',ENDPOINT,*args],capture_output=True,text=True,timeout=120,**kw)

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
      CREATE TABLE public.organizations(id uuid PRIMARY KEY);
      CREATE TABLE public.units(id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE);
      CREATE TABLE public.unit_blocks(user_id uuid, unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE);
      CREATE TABLE public.machines(id uuid PRIMARY KEY, unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE, label text);

      CREATE TABLE public.devices(id uuid PRIMARY KEY, unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE);
      CREATE TABLE public.reservoirs(id uuid PRIMARY KEY, unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE);
      CREATE TABLE public.sensors(id uuid PRIMARY KEY, device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        reservoir_id uuid REFERENCES reservoirs(id) ON DELETE CASCADE, machine_id uuid REFERENCES machines(id) ON DELETE CASCADE, label text);
      CREATE TABLE public.maintenance(id uuid PRIMARY KEY, unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
        device_id uuid REFERENCES devices(id) ON DELETE CASCADE, machine_id uuid REFERENCES machines(id) ON DELETE CASCADE,label text);
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
    sql(f"INSERT INTO organizations VALUES ('{uid(1)}'),('{uid(2)}');",db)
    for unit,org in [(11,1),(12,1),(21,2),(22,2)]:
        sql(f"INSERT INTO units VALUES ('{uid(unit)}','{uid(org)}');",db)
    for table,entries in [('machines',[(101,11),(102,12),(121,21),(122,22)]),
                          ('maintenance',[(601,11),(621,21)]),
                          ('devices',[(301,11),(302,12),(321,21),(322,22)]),
                          ('reservoirs',[(401,11),(402,12),(421,21),(422,22)])]:
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
    commands=[]
    existing={'organizations','organization_members','units','machines','maintenance','devices','reservoirs','sensors'}
    for table in TARGETS:
        if table not in existing:
            commands.append(f'CREATE TABLE {table}(id uuid PRIMARY KEY);')
        commands.append(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;')
        commands.append(f'GRANT TRUNCATE,TRIGGER,REFERENCES,MAINTAIN ON {table} TO anon,authenticated;')
    commands.append('GRANT USAGE,CREATE ON SCHEMA public TO supabase_admin;')
    for creator in ['postgres','supabase_admin']:
        commands.append(f'ALTER DEFAULT PRIVILEGES FOR ROLE {creator} IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;')
    sql('\n'.join(commands),db)

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
    result=docker('run','--pull=never','--network=none','--rm','-d','--name',NAME,'--label','washsense.synthetic-rls-test=true',
                  '-e','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE)
    assert result.returncode==0,result.stderr
    isolation=docker('inspect','--format','{{json .HostConfig.NetworkMode}}|{{json .HostConfig.PortBindings}}',NAME)
    assert isolation.returncode == 0, 'Container isolation inspection failed'
    network, bindings=isolation.stdout.strip().split('|',1)
    assert json.loads(network) == 'none' and json.loads(bindings) in (None,{}), 'Unsafe container network/ports'
    print('PASS: local Docker endpoint; network=none; no published ports; cached pinned image')
    for _ in range(60):
        if docker('exec',NAME,'pg_isready','-h','127.0.0.1','-U','postgres').returncode==0: break
        time.sleep(1)
    else: raise AssertionError('PostgreSQL not ready')
    sql('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE supabase_admin;')
    setup('positive')
    old=baseline('positive')
    data_sql="SELECT jsonb_agg(x ORDER BY x::text) FROM (" + " UNION ALL ".join(
        f"SELECT jsonb_build_object('table','{t}','row',to_jsonb(r)) AS x FROM {t} r"
        for t in ['machines','maintenance','sensors','devices','reservoirs','units']) + ") rows;"
    original_data=sql(data_sql,'positive')
    sql(STRUCTURAL,'positive')
    sql(VERIFY,'positive')
    sql(DEFAULTS,'positive')
    print('PASS: structural + defaults proposals applied before RLS in the same 19-table fixture')
    grants=sql("SELECT relname,relacl::text FROM pg_class WHERE relnamespace='public'::regnamespace ORDER BY relname;",'positive')
    attempt('positive',1003,update('machines',101),1)  # Reproduce operator weakness in synthetic model.
    attempt('positive',1002,insert_sensor(301,421),error=None)  # OR permits mixed organizations before proposal.
    metadata_sql = "SELECT jsonb_agg(x ORDER BY x::text) FROM (" + " UNION ALL ".join([
        "SELECT jsonb_build_object('constraint',oid,'definition',pg_get_constraintdef(oid)) x FROM pg_constraint WHERE connamespace='public'::regnamespace",
        "SELECT jsonb_build_object('column',attrelid,'number',attnum,'acl',attacl) x FROM pg_attribute WHERE attrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace) AND attnum>0",
        "SELECT jsonb_build_object('helper',oid,'definition',pg_get_functiondef(oid),'acl',proacl) x FROM pg_proc WHERE pronamespace='public'::regnamespace"
    ]) + ") q;"
    original_metadata=sql(metadata_sql,'positive')
    apply('positive',old)
    assert sql(metadata_sql.replace("WHERE pronamespace='public'::regnamespace", "WHERE pronamespace='public'::regnamespace AND proname NOT LIKE 'washsense_rls_%'"),'positive')==original_metadata
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
                      update('sensors',501,f"device_id='{uid(321)}',reservoir_id='{uid(421)}',machine_id='{uid(121)}'")]:
        attempt('positive',3333,statement,error='Invalid association or cross-organization transfer')
    for statement in [insert_sensor(301,421),insert_sensor(None)]:
        attempt('positive',3333,statement,error='row-level security')
    attempt('positive',3333,update('machines',101,f"unit_id='{uid(12)}'"),1)
    attempt('positive',1000,insert_sensor(301,402,102))
    attempt('positive',2000,insert_sensor(321,422,122))
    attempt('positive',3333,update('sensors',501,f"device_id='{uid(302)}',reservoir_id='{uid(402)}',machine_id='{uid(102)}'"),1)
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
    for table,id,col,target in [('machines',101,'unit_id',21),('devices',301,'unit_id',21),('reservoirs',401,'unit_id',21),
                                 ('maintenance',601,'unit_id',21),
                                 ('units',11,'organization_id',2)]:
        attempt('positive',0,update(table,id,f"{col}='{uid(target)}'"),role='service_role',
                error='transfer')
    for table,id in [('machines',101),('devices',301),('reservoirs',401),('maintenance',601)]:
        attempt('positive',0,update(table,id,f"unit_id='{uid(12)}'"),role='service_role',expected=1)
    for statement in ["INSERT INTO maintenance(id,unit_id,device_id,machine_id) VALUES "
                      +f"('{uid(901)}','{uid(11)}','{uid(302)}','{uid(102)}');",
                      update('maintenance',601,f"device_id='{uid(302)}',machine_id='{uid(102)}'")]:
        attempt('positive',0,statement,role='service_role')
    for column,value in [('device_id',321),('machine_id',121)]:
        attempt('positive',0,update('maintenance',601,f"{column}='{uid(value)}'"),role='service_role',error='Invalid association')
    attempt('positive',0,f"INSERT INTO maintenance(id,unit_id,device_id) VALUES ('{uid(901)}','{uid(11)}','{uid(321)}');",role='service_role',error='Invalid association')
    attempt('positive',0,insert_sensor(99999),role='service_role',error='foreign key constraint')
    attempt('positive',0,f"WITH d AS (INSERT INTO devices(id,unit_id) VALUES ('{uid(999)}','{uid(11)}') RETURNING id) INSERT INTO sensors(id,device_id) SELECT '{uid(998)}',id FROM d;",role='service_role')
    # A BEFORE trigger may modify a protected field absent from the UPDATE target list.
    sql(f"CREATE FUNCTION fixture_move() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.unit_id := '{uid(21)}'; RETURN NEW; END; $$;" +
        'CREATE TRIGGER fixture_before BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION fixture_move();','positive')
    attempt('positive',0,update('devices',301,'id=id'),role='service_role',error='transfer')
    sql('DROP TRIGGER fixture_before ON devices; DROP FUNCTION fixture_move();','positive')
    attempt('positive',0,update('sensors',501,f"device_id='{uid(321)}',reservoir_id='{uid(421)}',machine_id='{uid(121)}'"),role='service_role',error='transfer')
    # Foreign-key cascades affect only the linked synthetic records; rollback restores them.
    assert sql(f"BEGIN; DELETE FROM devices WHERE id='{uid(301)}'; SELECT count(*) FROM sensors WHERE id='{uid(501)}'; ROLLBACK;",'positive')=='0'
    # Concurrent child creation while a parent is moving between units in its tenant.
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=2) as pool:
        first=pool.submit(sql,f"BEGIN; UPDATE devices SET unit_id='{uid(12)}' WHERE id='{uid(301)}'; SELECT pg_sleep(1); ROLLBACK;",'positive')
        time.sleep(0.2)
        second=pool.submit(attempt,'positive',0,insert_sensor(301,402,102),None,None,'service_role')
        first.result(); second.result()
    with ThreadPoolExecutor(max_workers=2) as pool:
        first=pool.submit(attempt,'positive',0,update('devices',301,f"unit_id='{uid(21)}'"),None,'transfer','service_role')
        second=pool.submit(attempt,'positive',0,insert_sensor(301,402,102),None,None,'service_role')
        first.result();second.result()
    for isolation in ['READ COMMITTED','REPEATABLE READ','SERIALIZABLE']:
        with ThreadPoolExecutor(max_workers=2) as pool:
            first=pool.submit(sql,f"BEGIN ISOLATION LEVEL {isolation}; UPDATE units SET organization_id='{uid(2)}' WHERE id='{uid(11)}'; ROLLBACK;",'positive','transfer')
            second=pool.submit(sql,f"BEGIN ISOLATION LEVEL {isolation}; {insert_sensor(301,402,102)} ROLLBACK;",'positive')
            first.result();second.result()
    # Confirm actual row-lock contention, not just thread scheduling.
    with ThreadPoolExecutor(max_workers=2) as pool:
        hold=pool.submit(sql,f"SET application_name='synthetic_hold'; BEGIN; UPDATE devices SET unit_id='{uid(12)}' WHERE id='{uid(301)}'; SELECT pg_sleep(5); ROLLBACK;",'positive')
        deadline=time.monotonic()+4
        while sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='synthetic_hold' AND wait_event='PgSleep';",'positive')!='1':
            assert time.monotonic()<deadline,'Holder did not reach barrier'
            time.sleep(0.05)
        wait=pool.submit(sql,f"SET application_name='synthetic_wait'; BEGIN; SET ROLE service_role; UPDATE devices SET unit_id='{uid(21)}' WHERE id='{uid(301)}'; ROLLBACK;",'positive','transfer')
        deadline=time.monotonic()+4
        while sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='synthetic_wait' AND wait_event_type='Lock';",'positive')!='1':
            assert time.monotonic()<deadline,'Actual lock contention not observed'
            time.sleep(0.05)
        hold.result();wait.result()
    print('PASS: pg_stat_activity confirmed concurrent row-lock contention; foreign transfer refused after release')
    sql(VERIFY,'positive')
    assert sql(data_sql,'positive')==original_data
    print('PASS: maintenance multiunit INSERT/UPDATE, parent guards, concurrent moves, data preserved')
    for db,change,reason in [
        ('extra',"CREATE POLICY unexpected_write ON machines FOR UPDATE TO authenticated USING(true);",'Additional permissive'),
        ('shape','ALTER TABLE reservoirs RENAME COLUMN unit_id TO unverified_unit;','Unverified UUID/schema'),
        ('nullable','ALTER TABLE sensors ALTER COLUMN device_id DROP NOT NULL;','Unverified nullability'),
        ('badfk','ALTER TABLE devices DROP CONSTRAINT devices_unit_id_fkey;','Unverified nullability'),
        ('dirty',f"UPDATE sensors SET reservoir_id='{uid(421)}' WHERE id='{uid(501)}';",'Existing incoherent'),
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
