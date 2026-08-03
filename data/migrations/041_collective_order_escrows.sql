-- ============================================================================
-- Collective-order slot escrow (+ task escrow if missing)
-- JSONB document tables for PaymentConductor domain ledgers
-- ============================================================================

CREATE TABLE IF NOT EXISTS collective_order_escrows (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collective_order_escrows_opportunity
    ON collective_order_escrows ((data->>'opportunityId'));

CREATE INDEX IF NOT EXISTS idx_collective_order_escrows_user
    ON collective_order_escrows ((data->>'userId'));

CREATE INDEX IF NOT EXISTS idx_collective_order_escrows_status
    ON collective_order_escrows ((data->>'paymentStatus'));

CREATE INDEX IF NOT EXISTS idx_collective_order_escrows_data_gin
    ON collective_order_escrows USING GIN (data);

COMMENT ON TABLE collective_order_escrows IS 'Groupon-style collective_order prepaid slot ledger (PaymentPurpose collective_order_slot)';

-- Task escrow was used in production paths without a committed DDL in some clones.
CREATE TABLE IF NOT EXISTS task_escrows (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_escrows_message
    ON task_escrows ((data->>'messageId'));

CREATE INDEX IF NOT EXISTS idx_task_escrows_status
    ON task_escrows ((data->>'paymentStatus'));

CREATE INDEX IF NOT EXISTS idx_task_escrows_data_gin
    ON task_escrows USING GIN (data);

COMMENT ON TABLE task_escrows IS 'Chat task escrow holds (PaymentPurpose task_escrow)';
