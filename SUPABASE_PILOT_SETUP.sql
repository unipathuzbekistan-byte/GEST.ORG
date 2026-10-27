-- Supabase private Storage bucket for the short supervised GEST pilot.
-- These statements do not modify your 29 gest_private PostgreSQL tables.
INSERT INTO storage.buckets (id,name,public,file_size_limit)
VALUES ('gest-pilot-private','gest-pilot-private',false,52428800)
ON CONFLICT (id) DO NOTHING;
SELECT id,name,public,file_size_limit FROM storage.buckets WHERE id='gest-pilot-private';
-- Check that public = false. STOP if public is true.
