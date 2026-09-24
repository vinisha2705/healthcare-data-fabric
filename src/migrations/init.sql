CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users who can access the API (doctors/admins/agents)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    email VARCHAR(160) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'clinician',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Simulated upstream EHR / source systems the data fabric ingests from
CREATE TABLE IF NOT EXISTS sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL UNIQUE,
    system_type VARCHAR(60) NOT NULL, -- e.g. 'HL7', 'FHIR', 'CSV_UPLOAD'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Normalized patient records, regardless of which source they came from
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
    external_ref VARCHAR(120), -- the ID the record had in its source system
    full_name VARCHAR(160) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(20),
    condition VARCHAR(160),
    blood_group VARCHAR(10),
    raw_payload JSONB, -- original unnormalized payload, kept for traceability
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log of every ingestion run performed by the ingestion "agent"
CREATE TABLE IF NOT EXISTS ingestion_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
    records_received INT NOT NULL DEFAULT 0,
    records_inserted INT NOT NULL DEFAULT 0,
    records_updated INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patients_full_name ON patients (full_name);
CREATE INDEX IF NOT EXISTS idx_patients_source ON patients (source_id);
