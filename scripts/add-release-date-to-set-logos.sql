-- Adds a release_date column to set_logos so the Catalog page can order
-- sets by release date (most recent first), sourced from pokemontcg.io's
-- `releaseDate` field on the set object.
alter table set_logos add column if not exists release_date date;
