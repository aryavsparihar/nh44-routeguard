-- Shared value lists used across tables.

create type public.hazard_type as enum (
  'landslide', 'rockfall', 'flash_flood', 'snow_ice', 'accident', 'other'
);

create type public.confidence_level as enum ('low', 'medium', 'high');

create type public.user_role as enum (
  'grower', 'trader', 'agent', 'driver', 'police', 'admin'
);

create type public.report_source as enum ('driver', 'police');

create type public.report_status as enum ('unconfirmed', 'confirmed', 'expired');

create type public.shipment_status as enum (
  'planned', 'holding', 'moving', 'stuck', 'on_rail', 'diverted', 'delivered'
);

create type public.truck_type as enum ('light', 'heavy');
