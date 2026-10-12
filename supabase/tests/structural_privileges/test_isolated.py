#!/usr/bin/env python3
"""Synthetic PostgreSQL 17 tests. No remote URL, credentials or exposed port."""
import json
import subprocess
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SECURITY = ROOT / "supabase/security"
TARGETS = [
    "organizations", "organization_members", "units", "machines",
    "reservoirs", "devices", "sensors", "machine_readings",
    "reservoir_readings", "payments", "subscriptions", "alerts", "maintenance",
]
NAME = "washsense-security-test-" + uuid.uuid4().hex[:12]
IMAGE = "postgres:17@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3"
MIGRATION = (SECURITY / "20261012_harden_structural_privileges.sql.pending").read_text()
PREFLIGHT = (SECURITY / "20261012_structural_privileges_preflight.sql").read_text()
VERIFY = (SECURITY / "20261012_structural_privileges_verify.sql").read_text()
DEFAULTS = (SECURITY / "20261012_harden_default_privileges.sql.pending").read_text()


def docker(*args, **kwargs):
    return subprocess.run(["docker", *args], capture_output=True, text=True,
                          timeout=120, **kwargs)


def sql(statement, database="postgres", succeeds=True):
    result = docker("exec", "-i", NAME, "psql", "-X", "-qAt",
                    "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database,
                    input=statement)
    if succeeds and result.returncode:
        raise AssertionError(result.stderr)
    if not succeeds and not result.returncode:
        raise AssertionError("Expected refusal, but draft succeeded")
    return result


def fixture(database):
    sql(f'CREATE DATABASE "{database}";')
    commands = [
        "GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;",
        "CREATE FUNCTION public.fixture_constant() RETURNS integer LANGUAGE sql "
        "AS 'SELECT 1';",
        "REVOKE EXECUTE ON FUNCTION public.fixture_constant() FROM PUBLIC;",
        "GRANT EXECUTE ON FUNCTION public.fixture_constant() TO authenticated, service_role;",
    ]
    for table in TARGETS + ["unlisted_table"]:
        commands += [
            f"CREATE TABLE public.{table} (id integer PRIMARY KEY, "
            "organization_id text NOT NULL, payload text CHECK (payload <> ''));",
            f"INSERT INTO public.{table} VALUES (1, 'synthetic-A', 'sample-A'), "
            "(2, 'synthetic-B', 'sample-B');",
            f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;",
            f"CREATE POLICY fixture_read ON public.{table} FOR SELECT "
            "TO authenticated USING "
            "(organization_id = current_setting('fixture.organization', true));",
            f"GRANT TRUNCATE, TRIGGER, REFERENCES ON public.{table} TO anon, authenticated;",
            f"GRANT ALL ON public.{table} TO service_role;",
        ]
    commands += [
        "GRANT SELECT ON organizations, subscriptions, payments TO authenticated;",
        "GRANT INSERT, UPDATE, DELETE ON alerts TO authenticated;",
        "GRANT UPDATE (payload) ON machines TO authenticated;",
    ]
    sql("\n".join(commands), database)


def rows(database):
    # Synthetic fixture rows only, read by the isolated test owner.
    return {t: sql(f"SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.{t} x;",
                   database).stdout for t in TARGETS + ["unlisted_table"]}


def invariant_metadata(database):
    statement = """
    SELECT jsonb_build_object(
      'columns', (SELECT jsonb_agg(to_jsonb(x) ORDER BY attrelid, attnum)
        FROM pg_attribute x WHERE attrelid IN
          (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)),
      'policies', (SELECT jsonb_agg(to_jsonb(x) ORDER BY oid) FROM pg_policy x),
      'constraints', (SELECT jsonb_agg(to_jsonb(x) ORDER BY oid)
        FROM pg_constraint x WHERE connamespace='public'::regnamespace),
      'triggers', (SELECT jsonb_agg(to_jsonb(x) ORDER BY oid) FROM pg_trigger x
        WHERE tgrelid IN (SELECT oid FROM pg_class
          WHERE relnamespace='public'::regnamespace)),
      'functions', (SELECT jsonb_agg(to_jsonb(x) ORDER BY oid) FROM pg_proc x
        WHERE pronamespace='public'::regnamespace),
      'preserved_acl', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x::text) FROM
        (SELECT c.relname, a.* FROM pg_class c,
          LATERAL aclexplode(c.relacl) a WHERE c.relnamespace='public'::regnamespace
          AND NOT (c.relname <> 'unlisted_table'
            AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole)
            AND a.privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES'))) x)
    );
    """
    return json.loads(sql(statement, database).stdout)


def readable_counts(database):
    statement = "SET ROLE authenticated; SET fixture.organization='synthetic-A';\n"
    statement += "\n".join(f"SELECT count(*) FROM public.{t};"
                           for t in ["organizations", "subscriptions", "payments"])
    return sql(statement, database).stdout.strip().splitlines()


try:
    result = docker("run", "--rm", "-d", "--name", NAME,
                    "--label", "washsense.synthetic-security-test=true",
                    "-e", "POSTGRES_HOST_AUTH_METHOD=trust", IMAGE)
    if result.returncode:
        raise RuntimeError(result.stderr)
    for attempt in range(60):
        if docker("exec", NAME, "pg_isready", "-U", "postgres").returncode == 0:
            break
        time.sleep(1)
    else:
        raise RuntimeError("Isolated PostgreSQL did not become ready")
    sql("CREATE ROLE anon; CREATE ROLE authenticated; "
        "CREATE ROLE service_role BYPASSRLS; CREATE ROLE inherited_reader; "
        "CREATE ROLE supabase_admin;")
    fixture("positive")
    # Current MAINTAIN is not yet approved for removal; prove it is preserved.
    sql("GRANT MAINTAIN ON machines TO anon, authenticated;", "positive")
    before_rows = rows("positive")
    before_metadata = invariant_metadata("positive")
    before_counts = readable_counts("positive")
    assert before_counts == ["1", "1", "1"], before_counts
    sql(PREFLIGHT, "positive")
    assert rows("positive") == before_rows, "Preflight changed fixture rows"
    assert "Unexpected structural privilege" in sql(VERIFY, "positive", succeeds=False).stderr
    sql(MIGRATION, "positive")
    sql(VERIFY, "positive")
    assert rows("positive") == before_rows, "Fixture rows changed"
    assert invariant_metadata("positive") == before_metadata, "Preserved metadata changed"
    assert readable_counts("positive") == before_counts, "Authorized reads changed"
    assert sql("SELECT has_table_privilege('authenticated','machines','UPDATE'), "
               "has_column_privilege('authenticated','machines','payload','UPDATE');",
               "positive").stdout.strip() == "f|t"
    assert "Expected direct postgres grant" in sql(MIGRATION, "positive", succeeds=False).stderr
    sql(VERIFY, "positive")
    print("PASS: 78 structural table checks + column REFERENCES assertions")
    print("PASS: RLS, policies, DML/column grants, other ACLs, functions, constraints, triggers unchanged")
    print("PASS: synthetic rows and authorized organization/subscription/payment reads unchanged")
    print("PASS: read-only preflight; repeat draft refused; unlisted table unchanged")

    cases = {
        "missing": "DROP TABLE maintenance;",
        "rls": "ALTER TABLE machines DISABLE ROW LEVEL SECURITY;",
        "owner": "ALTER TABLE machines OWNER TO inherited_reader;",
        "public_grant": "GRANT TRUNCATE ON machines TO PUBLIC;",
        "column_reference": "GRANT REFERENCES (payload) ON machines TO authenticated;",
        "grant_option": "GRANT TRUNCATE ON machines TO anon WITH GRANT OPTION;",
        "missing_direct": "REVOKE TRUNCATE ON machines FROM anon;",
        "inherited": "GRANT inherited_reader TO authenticated; "
                     "GRANT TRUNCATE ON machines TO inherited_reader;",
        "other_role": "GRANT authenticated TO inherited_reader;",
    }
    reasons = {
        "missing": "Missing/drifted target",
        "rls": "Missing/drifted target",
        "owner": "Missing/drifted target",
        "public_grant": "PUBLIC structural grant",
        "column_reference": "Column REFERENCES",
        "grant_option": "Expected direct postgres grant",
        "missing_direct": "Expected direct postgres grant",
        "inherited": "Residual effective privilege",
        "other_role": "other role privilege or RLS drift",
    }
    for database, change in cases.items():
        fixture(database)
        sql(change, database)
        before = sql(PREFLIGHT, database).stdout
        failure = sql(MIGRATION, database, succeeds=False)
        assert reasons[database] in failure.stderr, failure.stderr
        assert sql(PREFLIGHT, database).stdout == before, database + " did not roll back"
        print("PASS: refusal/rollback for", database)
        # Membership is cluster-wide; isolate subsequent cases too.
        sql("REVOKE inherited_reader FROM authenticated; "
            "REVOKE authenticated FROM inherited_reader;")

    def default_fixture(database):
        fixture(database)
        sql("CREATE SCHEMA outside_scope; "
            "GRANT CREATE ON SCHEMA public, outside_scope TO supabase_admin;", database)
        for creator in ["postgres", "supabase_admin"]:
            sql(f"ALTER DEFAULT PRIVILEGES FOR ROLE {creator} IN SCHEMA public "
                "GRANT ALL ON TABLES TO anon, authenticated, service_role; "
                f"ALTER DEFAULT PRIVILEGES FOR ROLE {creator} "
                "GRANT SELECT ON TABLES TO authenticated; "
                f"ALTER DEFAULT PRIVILEGES FOR ROLE {creator} IN SCHEMA public "
                "GRANT USAGE ON SEQUENCES TO authenticated; "
                f"ALTER DEFAULT PRIVILEGES FOR ROLE {creator} IN SCHEMA public "
                "GRANT EXECUTE ON FUNCTIONS TO service_role; "
                f"ALTER DEFAULT PRIVILEGES FOR ROLE {creator} IN SCHEMA outside_scope "
                "GRANT ALL ON TABLES TO anon, authenticated;", database)

    default_fixture("future_defaults")
    before_data = rows("future_defaults")
    before_meta = invariant_metadata("future_defaults")
    sql(DEFAULTS, "future_defaults")
    assert rows("future_defaults") == before_data
    assert invariant_metadata("future_defaults") == before_meta
    for creator in ["postgres", "supabase_admin"]:
        sql(f"SET ROLE {creator}; CREATE TABLE public.future_{creator} (id int); "
            f"CREATE TABLE outside_scope.future_{creator} (id int); "
            f"CREATE SEQUENCE public.future_seq_{creator}; "
            f"CREATE FUNCTION public.future_fn_{creator}() RETURNS int "
            "LANGUAGE sql AS 'SELECT 1';", "future_defaults")
        for role in ["anon", "authenticated"]:
            for priv in ["TRUNCATE", "TRIGGER", "REFERENCES", "MAINTAIN"]:
                assert sql(f"SELECT has_table_privilege('{role}', 'public.future_{creator}', '{priv}');",
                           "future_defaults").stdout.strip() == "f"
                assert sql(f"SELECT has_table_privilege('{role}', 'outside_scope.future_{creator}', '{priv}');",
                           "future_defaults").stdout.strip() == "t"
            for priv in ["SELECT", "INSERT", "UPDATE", "DELETE"]:
                assert sql(f"SELECT has_table_privilege('{role}', 'public.future_{creator}', '{priv}');",
                           "future_defaults").stdout.strip() == "t"
        assert sql(f"SELECT has_table_privilege('service_role', 'public.future_{creator}', 'MAINTAIN');",
                   "future_defaults").stdout.strip() == "t"
        assert sql(f"SELECT has_sequence_privilege('authenticated', 'public.future_seq_{creator}', 'USAGE'), "
                   f"has_function_privilege('service_role', 'public.future_fn_{creator}()', 'EXECUTE');",
                   "future_defaults").stdout.strip() == "t|t"
    print("PASS: 16 future structural privileges absent; DML/service grants and outside schema preserved")
    print("PASS: default draft preserves existing data, tables, RLS and ACLs")
    for database, change, reason in [
        ("global_defaults", "ALTER DEFAULT PRIVILEGES FOR ROLE postgres "
         "GRANT TRUNCATE ON TABLES TO anon;", "Global structural defaults"),
        ("missing_defaults", "ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public "
         "REVOKE MAINTAIN ON TABLES FROM anon;", "Missing/drifted direct default"),
        ("default_option", "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public "
         "GRANT TRIGGER ON TABLES TO authenticated WITH GRANT OPTION;", "Missing/drifted direct default"),
    ]:
        default_fixture(database)
        sql(change, database)
        before = sql(PREFLIGHT, database).stdout
        failure = sql(DEFAULTS, database, succeeds=False)
        assert reason in failure.stderr, failure.stderr
        assert sql(PREFLIGHT, database).stdout == before
        print("PASS: default draft refusal/rollback for", database)
    print("PostgreSQL:", sql("SHOW server_version;").stdout.strip())
finally:
    # Remove only the uniquely named container created by this test.
    docker("rm", "-f", "-v", NAME)
