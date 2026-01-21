-- Upload MOZ ADM0 boundaries
-- 1 records

INSERT INTO public.admin_boundaries (admin_pcode, admin_level, name, parent_pcode, country_id, geometry, metadata) VALUES ('MZ', 'ADM0', 'Mozambique', NULL, 'f2c9e932-1ab3-41fd-b455-35a0fcb7c518'::uuid, ST_GeomFromText('POINT (34.68163159799997 -18.66979807799993)', 4326)::geography, '{"source": "HDX"}'::jsonb) ON CONFLICT (admin_pcode) DO UPDATE SET admin_level=EXCLUDED.admin_level, name=EXCLUDED.name, parent_pcode=EXCLUDED.parent_pcode, country_id=EXCLUDED.country_id, geometry=EXCLUDED.geometry, metadata=EXCLUDED.metadata;