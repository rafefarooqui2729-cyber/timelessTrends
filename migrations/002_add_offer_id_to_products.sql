
-- Add products.offer_id safely for existing and fresh PostgreSQL databases.
-- This migration is designed to be safe to run more than once.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'offer_id'
  ) THEN
    ALTER TABLE public.products
      ADD COLUMN offer_id INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_offer_id_fkey'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_offer_id_fkey
      FOREIGN KEY (offer_id)
      REFERENCES public.offers(id)
      ON DELETE SET NULL;
  END IF;
END
$$;
