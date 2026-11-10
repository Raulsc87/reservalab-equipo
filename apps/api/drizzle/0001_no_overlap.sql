-- Custom SQL migration file, put your code below! --
create extension if not exists btree_gist;

--> statement-breakpoint

alter table reservations
add constraint reservations_no_overlap
exclude using gist (
  space_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
)
where (status = 'confirmada');