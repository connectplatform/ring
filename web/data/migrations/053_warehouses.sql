-- Ring inventory locations for the platform warehouse directory.
-- These rows are not Nova Post carrier branches.

CREATE TABLE IF NOT EXISTS public.warehouses (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT warehouses_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.warehouses IS 'Ring inventory locations (platform warehouse directory). Not Nova Post carrier branches.';

CREATE INDEX IF NOT EXISTS idx_warehouses_code
  ON public.warehouses USING btree (((data ->> 'code'::text)));

CREATE INDEX IF NOT EXISTS idx_warehouses_data_gin
  ON public.warehouses USING gin (data);

INSERT INTO schema_versions (version, description)
SELECT '053', 'warehouses: Ring inventory locations, not Nova Post branches'
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '053'
);
