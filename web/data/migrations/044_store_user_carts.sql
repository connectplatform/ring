-- Authenticated buyer cart mirror (session-bound agent commerce + StoreProvider hydrate).
-- Soft-holds remain inventory_reservations under orderId cart_${userId}.

CREATE TABLE IF NOT EXISTS public.store_user_carts (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT store_user_carts_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.store_user_carts IS 'Session cart mirror for authenticated buyers (agent tools + client hydrate)';

CREATE INDEX IF NOT EXISTS idx_store_user_carts_user_id
  ON public.store_user_carts USING btree (((data ->> 'userId'::text)));

CREATE INDEX IF NOT EXISTS idx_store_user_carts_data_gin
  ON public.store_user_carts USING gin (data);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_store_user_carts_updated_at ON public.store_user_carts;
CREATE TRIGGER update_store_user_carts_updated_at
  BEFORE UPDATE ON public.store_user_carts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO schema_versions (version, description, applied_by)
SELECT '044',
       'store_user_carts: authenticated buyer cart mirror for agent commerce',
       current_user
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '044'
);
