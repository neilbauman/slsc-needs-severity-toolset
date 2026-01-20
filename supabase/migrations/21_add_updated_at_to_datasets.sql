-- ==============================
-- ADD updated_at COLUMN TO datasets
-- ==============================
-- Adds the updated_at timestamp column to the datasets table
-- This column will be automatically updated when a dataset is modified

-- Create a trigger function to automatically update updated_at on row updates
CREATE OR REPLACE FUNCTION update_datasets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'datasets' 
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.datasets 
    ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
      
    COMMENT ON COLUMN public.datasets.updated_at IS 'Timestamp when the dataset was last updated';
  END IF;
END $$;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS trigger_update_datasets_updated_at ON public.datasets;

CREATE TRIGGER trigger_update_datasets_updated_at
  BEFORE UPDATE ON public.datasets
  FOR EACH ROW
  EXECUTE FUNCTION update_datasets_updated_at();
