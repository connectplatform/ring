-- Verification procedures SSOT (KYC, entity identity, vendor store)

CREATE TABLE IF NOT EXISTS verification_procedures (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_procedures_procedure_number
    ON verification_procedures ((data->>'procedureNumber'));
CREATE INDEX IF NOT EXISTS idx_verification_procedures_subject_type
    ON verification_procedures ((data->>'subjectType'));
CREATE INDEX IF NOT EXISTS idx_verification_procedures_subject_id
    ON verification_procedures ((data->>'subjectId'));
CREATE INDEX IF NOT EXISTS idx_verification_procedures_status
    ON verification_procedures ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_verification_procedures_applicant
    ON verification_procedures ((data->>'applicantUserId'));
CREATE INDEX IF NOT EXISTS idx_verification_procedures_created_at
    ON verification_procedures (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_procedures_data_gin
    ON verification_procedures USING GIN (data);

COMMENT ON TABLE verification_procedures IS 'Unified verification procedure SSOT (user_kyc, entity_identity, vendor_store)';
COMMENT ON COLUMN verification_procedures.data IS 'procedureNumber, attemptNumber, subjectType, subjectId, applicantUserId, status, statusHistory, documents, forensics';

CREATE TABLE IF NOT EXISTS verification_counters (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE verification_counters IS 'Global procedure number sequence per year (id = YYYY)';

CREATE TABLE IF NOT EXISTS matcher_verification_events (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matcher_verification_procedure_number
    ON matcher_verification_events ((data->>'procedureNumber'));
CREATE INDEX IF NOT EXISTS idx_matcher_verification_subject_type
    ON matcher_verification_events ((data->>'subjectType'));
CREATE INDEX IF NOT EXISTS idx_matcher_verification_created_at
    ON matcher_verification_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matcher_verification_data_gin
    ON matcher_verification_events USING GIN (data);

COMMENT ON TABLE matcher_verification_events IS 'Matcher/admin verification queue fed by procedure submit and review actions';
