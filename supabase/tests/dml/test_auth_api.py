#!/usr/bin/env python3
"""Actual GoTrue + PostgREST HTTP tests; private disposable network and fake users."""
import ast
import base64
import hashlib
import hmac
import json
import ipaddress
import secrets
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
import sys
sys.path.insert(0,str(ROOT/"supabase/tests/snapshot"))
from reconstruct import reconstruct,seed
from contracts import DML,READS,finance_seed,energy_fixture,energy_apply
fixture=ROOT/'supabase/tests/rls/test_isolated.py'
tree=ast.parse(fixture.read_text())
main=next(i for i,n in enumerate(tree.body) if isinstance(n,ast.Try))
ns={'__file__':str(fixture),'__name__':'fixture_definitions_only'}
exec(compile(ast.Module(body=tree.body[:main],type_ignores=[]),str(fixture),'exec'),ns)
docker,sql,setup,uid=(ns[k] for k in ('docker','sql','setup','uid'))
DB=ns['NAME']; AUTH=DB+'-auth'; REST=DB+'-rest'; NETWORK=DB+'-private'
AUTH_IMAGE='supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b'
REST_IMAGE='postgrest/postgrest@sha256:d155c6718ed9a9f990d159a2ab7c0a3f16944dbb6d0a0344557421042acfe0df'
secret=secrets.token_urlsafe(48); dbpass=secrets.token_hex(24); userpass=secrets.token_urlsafe(24)
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):
        raise urllib.error.HTTPError(args[0].full_url,args[2],'Redirect refused',args[4],None)
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
ALLOWED_BASES=set()

# Fixed loopback URLs, never inherited SUPABASE_* bindings.
def http(base,path,method='GET',body=None,token=None,prefer='return=representation'):
    assert base in ALLOWED_BASES, 'Unverified API endpoint refused'
    headers={'Content-Type':'application/json','Prefer':prefer}
    if token: headers['Authorization']='Bearer '+token
    req=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
    try:
        with opener.open(req,timeout=5) as r: return r.status,json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e:
        return e.code,json.loads(e.read() or b'null')

def port(name,inner):
    r=docker('inspect','--format','{{json .}}',name)
    assert r.returncode==0, 'Container inspection failed'
    container=json.loads(r.stdout)
    assert not container['HostConfig']['PortBindings'], 'Public ports refused'
    assert list(container['NetworkSettings']['Networks'])==[NETWORK], 'Unexpected service network'
    address=container['NetworkSettings']['Networks'][NETWORK]['IPAddress']
    assert container['State']['Running'] and ipaddress.ip_address(address).is_private, 'Isolated API not running'
    base=f'http://{address}:{inner}'
    ALLOWED_BASES.add(base)
    return base

def run(name,image,*args):
    r=docker('run','--pull=never','-d','--name',name,'--network',NETWORK,
             '--label','washsense.synthetic-auth-api-test=true',*args,image)
    assert r.returncode==0, 'Disposable service could not start'

def ready(base,path):
    for _ in range(100):
        try:
            if http(base,path)[0]==200:return
        except (OSError,ValueError):pass
        time.sleep(.2)
    raise AssertionError('Local service readiness timeout')

def service_jwt():
    enc=lambda x:base64.urlsafe_b64encode(json.dumps(x,separators=(',',':')).encode()).rstrip(b'=')
    head=enc({'alg':'HS256','typ':'JWT'});payload=enc({'role':'service_role','aud':'authenticated','exp':int(time.time())+300})
    content=head+b'.'+payload
    return (content+b'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),content,hashlib.sha256).digest()).rstrip(b'=')).decode()

try:
    r=docker('network','create','--internal',NETWORK)
    assert r.returncode==0,'Internal network unavailable'
    assert json.loads(docker('network','inspect','--format','{{json .Internal}}',NETWORK).stdout) is True
    run(DB,ns['IMAGE'],'-e','POSTGRES_HOST_AUTH_METHOD=trust')
    for _ in range(100):
        if docker('exec',DB,'pg_isready','-h','127.0.0.1','-U','postgres').returncode==0:break
        time.sleep(.2)
    else:raise AssertionError('PostgreSQL readiness timeout')
    sql('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE supabase_admin;')
    sql('CREATE DATABASE api;')
    sql(f"CREATE ROLE supabase_auth_admin LOGIN PASSWORD '{dbpass}'; CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '{dbpass}'; GRANT anon,authenticated,service_role TO authenticator; CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin; CREATE EXTENSION IF NOT EXISTS pgcrypto; ALTER ROLE supabase_auth_admin SET search_path=auth,public; GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role; GRANT USAGE,CREATE ON SCHEMA public TO supabase_admin;",'api')
    run(AUTH,AUTH_IMAGE,'-e','GOTRUE_API_HOST=0.0.0.0','-e','GOTRUE_API_PORT=9999',
        '-e','API_EXTERNAL_URL=http://127.0.0.1:9999','-e','GOTRUE_SITE_URL=http://127.0.0.1:3000',
        '-e','GOTRUE_DB_DRIVER=postgres','-e',f'GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:{dbpass}@{DB}:5432/api',
        '-e','GOTRUE_DB_NAMESPACE=auth','-e',f'GOTRUE_JWT_SECRET={secret}','-e','GOTRUE_JWT_AUD=authenticated',
        '-e','GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated','-e','GOTRUE_EXTERNAL_EMAIL_ENABLED=true',
        '-e','GOTRUE_MAILER_AUTOCONFIRM=true','-e','GOTRUE_LOG_LEVEL=error')
    run(REST,REST_IMAGE,'-e',f'PGRST_DB_URI=postgres://authenticator:{dbpass}@{DB}:5432/api',
        '-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e',f'PGRST_JWT_SECRET={secret}',
        '-e','PGRST_JWT_AUD=authenticated','-e','PGRST_LOG_LEVEL=error')
    auth=port(AUTH,9999);rest=port(REST,3000)
    ready(auth,'/health')
    # Vanilla PostgreSQL needs the platform claim accessor; tokens are still verified by PostgREST.
    sql("CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;",'api')
    reconstruct(sql,'api');seed(sql,'api',uid)
    sql(ns['STRUCTURAL'],'api');sql(ns['DEFAULTS'],'api');ns['apply']('api')
    finance_seed(sql,'api',uid)
    for table in READS:sql(f'REVOKE SELECT ON {table} FROM authenticated;','api')
    sql(DML,'api')
    energy_fixture(sql,'api');energy_apply(sql,'api')
    sql("NOTIFY pgrst,'reload schema';",'api')
    # REST root may need DB connection/migrations to settle.
    ready(rest,'/')
    print('PASS: reconstructed metadata; local superuser bootstrap (not production executor); actual GoTrue/PostgREST ready on inspected internal Docker IPs; no published ports')
    tokens={}; actors={}
    for name,org,role in [('adminA',1,'admin'),('managerA',1,'manager'),('techA',1,'technician'),('operatorA',1,'operator'),('adminB',2,'admin'),('dual',1,'admin')]:
        email=name.lower()+'@example.test'
        status,data=http(auth,'/signup','POST',{'email':email,'password':userpass})
        assert status==200,'Local signup failed'
        status,login=http(auth,'/token?grant_type=password','POST',{'email':email,'password':userpass})
        assert status==200 and 'access_token' in login,'Local login failed'
        tokens[name]=login['access_token']; actor=login['user']['id'];uuid.UUID(actor);actors[name]=actor
        sql(f"INSERT INTO profiles(id,full_name) VALUES ('{actor}','Synthetic'); INSERT INTO organization_members(user_id,organization_id,role) VALUES ('{actor}','{uid(org)}','{role}');",'api')
        if name=='dual':sql(f"INSERT INTO organization_members(user_id,organization_id,role) VALUES ('{actor}','{uid(2)}','admin');",'api')
    assert http(auth,'/token?grant_type=password','POST',{'email':'admina@example.test','password':'synthetic-wrong'})[0]==400
    print('PASS: real Auth signup/password login/JWT; incorrect password rejected')
    for name,org in [('adminA',1),('techA',1),('operatorA',1),('adminB',2)]:
        status,data=http(rest,'/organizations?select=id',token=tokens[name])
        assert status==200 and [row['id'] for row in data]==[uid(org)],'Real organization SELECT/RLS mismatch'
    status,data=http(rest,'/organizations?select=id',token=tokens['dual'])
    assert status==200 and {row['id'] for row in data}=={uid(1),uid(2)}
    assert http(rest,'/organizations?select=id',token='invalid-synthetic-jwt')[0]==401
    assert http(rest,'/organizations?select=id')[0] in (401,403)
    print('PASS: real JWT/organization SELECT RLS; foreign rows hidden; dual membership sees exactly two orgs')
    for name in tokens:
        expected={uid(1),uid(2)} if name=='dual' else {uid(2)} if name=='adminB' else {uid(1)}
        for table in ['subscriptions','payments']:
            status,data=http(rest,f'/{table}?select={READS[table]}',token=tokens[name])
            assert status==200 and {row['organization_id'] for row in data}==expected
        status,data=http(rest,'/organization_members?select=organization_id,role,organizations(id,name)&user_id=eq.'+actors[name],token=tokens[name])
        assert status==200 and {row['organization_id'] for row in data}==expected and all(row['organizations']['id']==row['organization_id'] for row in data)
        assert http(rest,'/plans?select='+READS['plans'],token=tokens[name])[0]==200
        for table in READS:
            assert http(rest,f'/{table}?select={READS[table]}')[0] in (401,403)
            for method,body in [('POST',{}),('PATCH',{'id':uid(1)})] if table!='organization_members' else [('POST',{}),('PATCH',{'role':'admin'})]:
                status,data=http(rest,'/'+table,method,body,tokens[name])
                assert status==403 and data['code']=='42501'
            status,data=http(rest,'/'+table,'DELETE',token=tokens[name])
            assert status==403 and data['code']=='42501'
    print('PASS: actual financial queries/embedded organization join, four roles and dual membership; foreign rows hidden')
    print('PASS: SQL column-only grants support proven reads; financial writes/self-elevation/anonymous access denied')
    status,data=http(rest,'/subscriptions?select=asaas_customer_id',token=tokens['adminA'])
    assert status==403 and data['code']=='42501'
    print('PASS: unused financial column remains inaccessible when restoring only evidenced SELECT columns')
    tariff={'distributor_name':'Synthetic','agent_code':'SYNTHETIC','tariff_group':'B','subgroup':'B3','tariff_mode':'Conventional','tariff_class':'Commercial','tariff_subclass':'Synthetic','time_post':'Synthetic','valid_from':'2026-01-01','tusd':1,'te':2,'source':'ANEEL','source_resource_id':'synthetic-only'}
    path='/energy_tariffs?on_conflict=agent_code,tariff_group,subgroup,tariff_mode,tariff_class,tariff_subclass,time_post,valid_from'
    # Versioned sync uses default return=minimal. No ANEEL/financial request.
    for value in [2,3]:
        tariff['te']=value
        status,data=http(rest,path,'POST',tariff,service_jwt(),prefer='resolution=merge-duplicates,return=minimal')
        assert status in (200,201,204) and data is None
        status,data=http(rest,'/energy_tariffs?select=te',token=service_jwt())
        assert status==200 and len(data)==1 and float(data[0]['te'])==value
    sql('REVOKE SELECT ON energy_tariffs FROM service_role;','api')
    status,data=http(rest,path,'POST',tariff,service_jwt(),prefer='resolution=merge-duplicates,return=minimal')
    assert status==403 and data['code']=='42501'
    sql('GRANT SELECT ON energy_tariffs TO service_role;','api')
    print('PASS: SELECT needed for real ON CONFLICT UPSERT even with return=minimal; absence yields 403/42501')
    assert sql("SELECT count(*) FROM energy_tariffs;",'api')=='1'
    status,data=http(rest,'/energy_tariffs','DELETE',token=service_jwt())
    assert status==403 and data['code']=='42501'
    for name in ['adminA','operatorA']:
        status,data=http(rest,path,'POST',tariff,tokens[name])
        assert status==403 and data['code']=='42501'
    print('PASS: real service-role PostgREST energy UPSERT insert/update; DELETE and browser writes denied (versioned local schema only)')
    print('BLOCKED: remote energy/Asaas/IoT functionality remains unverified; no calls to providers')
    for name in tokens:
        for table in ['machines','sensors','maintenance']:
            status,data=http(rest,f'/{table}?select=id',token=tokens[name])
            assert status==403 and data['code']=='42501'
        status,data=http(rest,f'/machines?id=eq.{uid(101)}','PATCH',{'unit_id':uid(21)},tokens[name])
        assert status==403 and data['code']=='42501'
        status,data=http(rest,'/sensors','POST',{'device_id':uid(301),'sensor_type':'synthetic'},tokens[name])
        assert status==403 and data['code']=='42501'
    status,data=http(rest,f'/machines?id=eq.{uid(101)}','PATCH',{'unit_id':uid(21)},service_jwt())
    assert status==403 and data['code']=='42501'
    print('PASS: actual HTTP 403/42501 for operational SELECT/INSERT/UPDATE with preserved real grants')
    print('BLOCKED: business writes/role DML matrix/service trigger via HTTP lack real DML grants; no grants fabricated')
    status,session=http(auth,'/token?grant_type=password','POST',{'email':'admina@example.test','password':userpass})
    assert status==200
    assert http(auth,'/logout','POST',{},session['access_token'])[0]==204
    assert http(auth,'/token?grant_type=refresh_token','POST',{'refresh_token':session['refresh_token']})[0]==400
    print('PASS: real Auth logout revokes refresh session; access JWT expiry is a separate behavior')
    print('PostgreSQL:',sql('SHOW server_version;'))
finally:
    for name in (REST,AUTH,DB):docker('rm','-f','-v',name)
    docker('network','rm',NETWORK)
