-- Drone company B2B/B2G marketing and sales dashboard.
-- Apply once to an empty PostgreSQL database. All timestamps use UTC-aware types.
BEGIN;

CREATE SCHEMA drone_crm;

CREATE TYPE drone_crm.organization_sector AS ENUM (
    'Air Force', 'Navy', 'Civilian Commercial'
);
CREATE TYPE drone_crm.procurement_stage AS ENUM (
    'research', 'qualification', 'budget_planning', 'market_research_rfi',
    'solicitation_rfp', 'proposal_submitted', 'evaluation', 'negotiation',
    'awarded', 'delivery', 'renewal', 'lost', 'cancelled'
);
CREATE TYPE drone_crm.lead_stage AS ENUM (
    'new', 'marketing_qualified', 'sales_qualified', 'nurture',
    'disqualified', 'converted'
);
CREATE TYPE drone_crm.campaign_status AS ENUM (
    'draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'
);
CREATE TYPE drone_crm.engagement_type AS ENUM (
    'email_sent', 'email_open', 'email_click', 'website_visit',
    'form_submission', 'webinar', 'trade_show', 'call', 'meeting',
    'demo', 'site_visit', 'rfi_response', 'proposal', 'other'
);

CREATE TABLE drone_crm.organizations (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL CHECK (btrim(name) <> ''),
    sector drone_crm.organization_sector NOT NULL,
    parent_organization_id bigint REFERENCES drone_crm.organizations(id),
    website text,
    country_code varchar(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
    government_entity_identifier text, -- e.g. UEI, if applicable
    clearance_required boolean NOT NULL DEFAULT false,
    security_clearance_requirements text,
    -- Account-level planning stage and potential value, entered by account owner.
    -- These are NOT rollups of opportunity stages or values.
    procurement_cycle_stage drone_crm.procurement_stage NOT NULL DEFAULT 'research',
    contract_value numeric(18,2) CHECK (contract_value >= 0),
    currency_code varchar(3) NOT NULL DEFAULT 'USD'
        CHECK (currency_code ~ '^[A-Z]{3}$'),
    account_owner text,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    updated_at timestamptz NOT NULL DEFAULT current_timestamp,
    CHECK (parent_organization_id IS DISTINCT FROM id),
    CHECK (NOT clearance_required OR
           nullif(btrim(security_clearance_requirements), '') IS NOT NULL)
);

CREATE TABLE drone_crm.campaigns (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL CHECK (btrim(name) <> ''),
    channel text NOT NULL CHECK (btrim(channel) <> ''),
    status drone_crm.campaign_status NOT NULL DEFAULT 'draft',
    objective text,
    starts_at timestamptz,
    ends_at timestamptz,
    budget numeric(18,2) CHECK (budget >= 0),
    currency_code varchar(3) NOT NULL DEFAULT 'USD'
        CHECK (currency_code ~ '^[A-Z]{3}$'),
    campaign_owner text,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    updated_at timestamptz NOT NULL DEFAULT current_timestamp,
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);

-- A campaign may target multiple sectors.
CREATE TABLE drone_crm.campaign_sectors (
    campaign_id bigint NOT NULL REFERENCES drone_crm.campaigns(id),
    sector drone_crm.organization_sector NOT NULL,
    PRIMARY KEY (campaign_id, sector)
);

CREATE TABLE drone_crm.leads (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id bigint NOT NULL REFERENCES drone_crm.organizations(id),
    first_name text,
    last_name text,
    email text CHECK (email IS NULL OR btrim(email) <> ''),
    phone text,
    job_title text,
    buying_role text, -- e.g. technical evaluator, program manager, contracting officer
    stage drone_crm.lead_stage NOT NULL DEFAULT 'new',
    score smallint NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
    source text,
    lead_owner text,
    do_not_contact boolean NOT NULL DEFAULT false,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    updated_at timestamptz NOT NULL DEFAULT current_timestamp,
    UNIQUE (id, organization_id)
);
CREATE UNIQUE INDEX leads_organization_email_uq
    ON drone_crm.leads (organization_id, lower(btrim(email)))
    WHERE email IS NOT NULL;

-- Many-to-many membership supports long sales cycles and multiple touchpoints.
CREATE TABLE drone_crm.campaign_leads (
    campaign_id bigint NOT NULL REFERENCES drone_crm.campaigns(id),
    lead_id bigint NOT NULL REFERENCES drone_crm.leads(id),
    added_at timestamptz NOT NULL DEFAULT current_timestamp,
    PRIMARY KEY (campaign_id, lead_id)
);

-- Each solicitation, pilot, commercial deal, or renewal has its own cycle.
CREATE TABLE drone_crm.opportunities (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id bigint NOT NULL REFERENCES drone_crm.organizations(id),
    name text NOT NULL CHECK (btrim(name) <> ''),
    procurement_cycle_stage drone_crm.procurement_stage NOT NULL DEFAULT 'research',
    solicitation_number text,
    procurement_vehicle text,
    budget_fiscal_year integer CHECK (budget_fiscal_year BETWEEN 1900 AND 9999),
    rfi_due_at timestamptz,
    proposal_due_at timestamptz,
    expected_award_date date,
    closed_at timestamptz,
    expected_contract_value numeric(18,2) CHECK (expected_contract_value >= 0),
    awarded_contract_value numeric(18,2) CHECK (awarded_contract_value >= 0),
    currency_code varchar(3) NOT NULL DEFAULT 'USD'
        CHECK (currency_code ~ '^[A-Z]{3}$'),
    win_probability numeric(5,4) CHECK (win_probability BETWEEN 0 AND 1),
    clearance_required boolean NOT NULL DEFAULT false,
    security_clearance_requirements text,
    opportunity_owner text,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    updated_at timestamptz NOT NULL DEFAULT current_timestamp,
    UNIQUE (id, organization_id),
    CHECK (NOT clearance_required OR
           nullif(btrim(security_clearance_requirements), '') IS NOT NULL)
);

CREATE TABLE drone_crm.engagements (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id bigint NOT NULL REFERENCES drone_crm.organizations(id),
    lead_id bigint,
    opportunity_id bigint,
    campaign_id bigint REFERENCES drone_crm.campaigns(id),
    engagement_type drone_crm.engagement_type NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT current_timestamp,
    recorded_at timestamptz NOT NULL DEFAULT current_timestamp,
    summary text,
    outcome text,
    source_system text,
    external_event_id text,
    -- Use for provider event attributes; keep reporting dimensions in columns.
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(metadata) = 'object'),
    FOREIGN KEY (lead_id, organization_id)
        REFERENCES drone_crm.leads(id, organization_id),
    FOREIGN KEY (opportunity_id, organization_id)
        REFERENCES drone_crm.opportunities(id, organization_id),
    CHECK (external_event_id IS NULL OR
           (nullif(btrim(source_system), '') IS NOT NULL AND
            btrim(external_event_id) <> '')),
    UNIQUE (source_system, external_event_id)
);

CREATE INDEX organizations_sector_stage_idx
    ON drone_crm.organizations (sector, procurement_cycle_stage);
CREATE INDEX organizations_parent_idx ON drone_crm.organizations (parent_organization_id);
CREATE INDEX leads_organization_stage_idx ON drone_crm.leads (organization_id, stage);
CREATE INDEX campaign_leads_lead_idx ON drone_crm.campaign_leads (lead_id);
CREATE INDEX opportunities_organization_idx ON drone_crm.opportunities (organization_id);
CREATE INDEX opportunities_pipeline_idx
    ON drone_crm.opportunities (procurement_cycle_stage, expected_award_date)
    WHERE archived_at IS NULL AND closed_at IS NULL;
CREATE INDEX engagements_organization_time_idx
    ON drone_crm.engagements (organization_id, occurred_at DESC);
CREATE INDEX engagements_lead_time_idx ON drone_crm.engagements (lead_id, occurred_at DESC);
CREATE INDEX engagements_campaign_time_idx
    ON drone_crm.engagements (campaign_id, occurred_at DESC);
CREATE INDEX engagements_opportunity_time_idx
    ON drone_crm.engagements (opportunity_id, occurred_at DESC);

CREATE FUNCTION drone_crm.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = current_timestamp;
    RETURN NEW;
END;
$$;

CREATE TRIGGER organizations_updated BEFORE UPDATE ON drone_crm.organizations
    FOR EACH ROW EXECUTE FUNCTION drone_crm.touch_updated_at();
CREATE TRIGGER campaigns_updated BEFORE UPDATE ON drone_crm.campaigns
    FOR EACH ROW EXECUTE FUNCTION drone_crm.touch_updated_at();
CREATE TRIGGER leads_updated BEFORE UPDATE ON drone_crm.leads
    FOR EACH ROW EXECUTE FUNCTION drone_crm.touch_updated_at();
CREATE TRIGGER opportunities_updated BEFORE UPDATE ON drone_crm.opportunities
    FOR EACH ROW EXECUTE FUNCTION drone_crm.touch_updated_at();

-- Sum each currency separately. NULL amounts/probabilities remain unknown.
-- Organization contract_value is deliberately excluded to avoid double counting.
CREATE VIEW drone_crm.pipeline_summary AS
SELECT o.sector, p.procurement_cycle_stage, p.currency_code,
       count(*) AS opportunity_count,
       count(p.expected_contract_value) AS opportunities_with_value,
       sum(p.expected_contract_value) AS pipeline_value,
       count(*) FILTER (
           WHERE p.expected_contract_value IS NOT NULL AND p.win_probability IS NOT NULL
       ) AS opportunities_with_weighted_value,
       sum(p.expected_contract_value * p.win_probability) AS weighted_pipeline_value
FROM drone_crm.opportunities p
JOIN drone_crm.organizations o ON o.id = p.organization_id
WHERE p.archived_at IS NULL AND o.archived_at IS NULL
  AND p.closed_at IS NULL
  AND p.procurement_cycle_stage NOT IN ('awarded', 'delivery', 'lost', 'cancelled')
GROUP BY o.sector, p.procurement_cycle_stage, p.currency_code;

COMMIT;
