"""Evidence-backed DML proposal and conditional local energy baseline."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
DML=(ROOT/'supabase/security/20261012_minimal_application_dml.sql.pending').read_text()
READS={
 'organization_members':'organization_id,role,user_id',
 'organizations':'id,name',
 'payments':'id,organization_id,subscription_id,provider,provider_payment_id,amount,net_amount,payment_method,status,due_date,paid_at,receipt_url,invoice_url,description,external_reference,created_at',
 'plans':'id,name,description,price_monthly,max_units,max_machines,max_devices',
 'subscriptions':'id,organization_id,plan_id,status,provider,provider_subscription_id,billing_cycle,amount,next_due_date,started_at,cancelled_at',
}
# Exact expression used by proposal, not a remote baseline or production approval.
ENERGY_BASELINE=DML.split("  SELECT jsonb_build_object(",1)[1].split('  ) INTO actual;',1)[0]
ENERGY_BASELINE='SELECT jsonb_build_object('+ENERGY_BASELINE+');'
def energy_apply(sql,db):
    baseline=sql(ENERGY_BASELINE,db).replace("'","''")
    sql("SET washsense.energy_dml_approved='on'; SET washsense.energy_dml_baseline='"+baseline+"';\n"+DML+"\nRESET washsense.energy_dml_approved; RESET washsense.energy_dml_baseline;",db)

def finance_seed(sql,db,uid):
    sql(f"INSERT INTO plans(id,name) VALUES ('{uid(700)}','Synthetic plan');",db)
    for org in [1,2]:
        sql(f"INSERT INTO subscriptions(id,organization_id,plan_id,status) VALUES ('{uid(710+org)}','{uid(org)}','{uid(700)}','ACTIVE'); INSERT INTO payments(id,organization_id,subscription_id,provider_payment_id,amount,status) VALUES ('{uid(720+org)}','{uid(org)}','{uid(710+org)}','synthetic-{org}',1.00,'PENDING');",db)

def energy_fixture(sql,db):
    # Versioned schema, NOT a reconstruction of undocumented remote energy tables.
    sql((ROOT/'supabase-energy-tariffs.sql').read_text(),db)
    sql('REVOKE ALL ON energy_tariffs FROM PUBLIC,anon,authenticated,service_role;',db)
