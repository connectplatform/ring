-- One row per product in an authenticated cart.
-- store_user_carts stays the session document. This table is the demand index:
-- which carts hold a product, and which of those rows are waiting on stock.

CREATE TABLE IF NOT EXISTS public.store_cart_lines (
    user_id character varying(255) NOT NULL,
    product_id character varying(255) NOT NULL,
    qty integer NOT NULL DEFAULT 0,
    waiting boolean NOT NULL DEFAULT false,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT store_cart_lines_pkey PRIMARY KEY (user_id, product_id),
    CONSTRAINT store_cart_lines_qty_nonnegative CHECK (qty >= 0)
);

COMMENT ON TABLE public.store_cart_lines IS
  'Cart demand index. One row per buyer and product. waiting=true is a backorder held at qty 0 until a warehouse can ship.';

-- Index-only scans for "how many carts want this product" and the waiting split.
CREATE INDEX IF NOT EXISTS idx_store_cart_lines_product
  ON public.store_cart_lines (product_id)
  INCLUDE (qty, waiting);

INSERT INTO public.store_cart_lines (user_id, product_id, qty, waiting)
SELECT
  COALESCE(NULLIF(c.data->>'userId', ''), regexp_replace(c.id, '^cart_', '')),
  line->>'productId',
  GREATEST(COALESCE(NULLIF(line->>'qty', '')::integer, 0), 0),
  COALESCE(line->>'waiting' = 'true', false)
FROM public.store_user_carts c
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.data->'items', '[]'::jsonb)) AS line
WHERE NULLIF(line->>'productId', '') IS NOT NULL
  AND (
    COALESCE((line->>'waiting')::boolean, false)
    OR COALESCE((line->>'qty')::integer, 0) > 0
  )
ON CONFLICT (user_id, product_id) DO UPDATE
  SET qty = EXCLUDED.qty,
      waiting = EXCLUDED.waiting,
      updated_at = now();

INSERT INTO schema_versions (version, description, applied_by)
SELECT '055',
       'store_cart_lines: indexed cart demand for backorders and vendor interest',
       current_user
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '055'
);
