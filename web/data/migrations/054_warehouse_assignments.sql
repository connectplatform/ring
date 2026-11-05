-- Ring users who operate a Ring inventory warehouse.
-- Not Nova Post carrier branches.

CREATE TABLE IF NOT EXISTS public.warehouse_assignments (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT warehouse_assignments_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.warehouse_assignments IS 'Ring users assigned to operate a Ring inventory warehouse. Not Nova Post branches.';

CREATE INDEX IF NOT EXISTS idx_warehouse_assignments_user_id
  ON public.warehouse_assignments USING btree (((data ->> 'userId'::text)));

CREATE INDEX IF NOT EXISTS idx_warehouse_assignments_warehouse_id
  ON public.warehouse_assignments USING btree (((data ->> 'warehouseId'::text)));

CREATE INDEX IF NOT EXISTS idx_warehouse_assignments_data_gin
  ON public.warehouse_assignments USING gin (data);

INSERT INTO schema_versions (version, description)
SELECT '054', 'warehouse_assignments: users who operate a Ring inventory warehouse'
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '054'
);
