-- PostGIS for points, distances and spatial indexes.
-- Installed in the "extensions" schema (Supabase convention) so its tables,
-- such as spatial_ref_sys, are not exposed through the public Data API.
create extension if not exists postgis with schema extensions;
