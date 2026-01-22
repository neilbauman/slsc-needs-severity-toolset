
    DO $$
    DECLARE
        v_dataset_id UUID;
        v_dataset_name TEXT;
        v_count INTEGER;
        v_density_data RECORD;
    BEGIN
        -- Check if dataset already exists
        v_dataset_name := 'Madagascar Population Density - ADM4';
        
        SELECT id INTO v_dataset_id
        FROM datasets
        WHERE country_id = '4e086398-4c54-486d-b4d0-c0aa23bd7d19'
          AND name = v_dataset_name;
        
        -- Create dataset if it doesn't exist
        IF v_dataset_id IS NULL THEN
            INSERT INTO datasets (
                name,
                description,
                type,
                admin_level,
                country_id,
                is_baseline,
                source,
                metadata
            ) VALUES (
                v_dataset_name,
                'Population density (persons per km²) by ADM4 administrative units for Madagascar. Calculated from population and boundary area data.',
                'numeric',
                'ADM4',
                '4e086398-4c54-486d-b4d0-c0aa23bd7d19',
                true,
                'Calculated from population and boundary data',
                jsonb_build_object(
                    'calculated_from_population_dataset', '41492063-2dac-4132-93eb-f5ceedbead0b',
                    'calculation_method', 'population / area_km2',
                    'unit', 'persons per km²'
                )
            ) RETURNING id INTO v_dataset_id;
            
            RAISE NOTICE 'Created dataset: % (ID: %)', v_dataset_name, v_dataset_id;
        ELSE
            -- Delete existing values
            DELETE FROM dataset_values_numeric WHERE dataset_id = v_dataset_id;
            RAISE NOTICE 'Using existing dataset: % (ID: %)', v_dataset_name, v_dataset_id;
        END IF;
        
        -- Calculate and insert density values
        INSERT INTO dataset_values_numeric (dataset_id, admin_pcode, value)
        WITH population_data AS (
            SELECT 
                admin_pcode,
                value AS population
            FROM dataset_values_numeric
            WHERE dataset_id = '41492063-2dac-4132-93eb-f5ceedbead0b'
        ),
        boundary_areas AS (
            SELECT 
                admin_pcode,
                ST_Area(geometry::geography) / 1000000.0 AS area_km2
            FROM admin_boundaries
            WHERE country_id = '4e086398-4c54-486d-b4d0-c0aa23bd7d19'
              AND admin_level = 'ADM4'
              AND geometry IS NOT NULL
              AND ST_IsValid(geometry::geometry)
        ),
        density_calc AS (
            SELECT 
                p.admin_pcode,
                p.population,
                COALESCE(b.area_km2, 0) AS area_km2,
                CASE 
                    WHEN COALESCE(b.area_km2, 0) > 0 
                    THEN p.population / b.area_km2 
                    ELSE NULL 
                END AS density_per_km2
            FROM population_data p
            INNER JOIN boundary_areas b ON p.admin_pcode = b.admin_pcode
            WHERE b.area_km2 > 0
        )
        SELECT 
            v_dataset_id,
            admin_pcode,
            density_per_km2
        FROM density_calc
        WHERE density_per_km2 IS NOT NULL
          AND density_per_km2 > 0;
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Inserted % density values', v_count;
    END $$;
    