CREATE OR REPLACE FUNCTION clean_numeric_dataset_v5(
  in_dataset_id uuid,
  in_offset integer DEFAULT 0,
  in_limit integer DEFAULT 5000
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  cleaned_count integer := 0;
BEGIN
  DROP TABLE IF EXISTS tmp_cleaned;

  -- ✅ Create batch only from records that don’t already exist in the cleaned table
  CREATE TEMP TABLE tmp_cleaned AS
  SELECT
    r.dataset_id,
    a.admin_pcode,
    a.name AS admin_name,
    r.value_raw::numeric AS value
  FROM dataset_values_numeric_raw r
  JOIN admin_boundaries a
    ON LOWER(TRIM(r.admin_name_raw)) = LOWER(TRIM(a.name))
   AND LENGTH(a.admin_pcode) = (
     SELECT LENGTH(admin_pcode)
     FROM admin_boundaries
     WHERE admin_level = (
       SELECT admin_level
       FROM datasets
       WHERE id = in_dataset_id
     )
     LIMIT 1
   )
  WHERE r.dataset_id = in_dataset_id
    AND NOT EXISTS (
      SELECT 1 FROM dataset_values_numeric c
      WHERE c.dataset_id = r.dataset_id
        AND c.admin_pcode = a.admin_pcode
    )
  OFFSET in_offset LIMIT in_limit;

  INSERT INTO dataset_values_numeric (dataset_id, admin_pcode, admin_name, value)
  SELECT dataset_id, admin_pcode, admin_name, value
  FROM tmp_cleaned;

  GET DIAGNOSTICS cleaned_count = ROW_COUNT;

  DROP TABLE IF EXISTS tmp_cleaned;

  RETURN cleaned_count;
END;
$$;
