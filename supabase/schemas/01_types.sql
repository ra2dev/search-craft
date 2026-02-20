-- Dataset status: uploaded -> described -> vectorized
create type dataset_status as enum (
  'uploaded',
  'described',
  'vectorized'
);
