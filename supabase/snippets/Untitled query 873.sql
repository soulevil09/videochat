select
  COUNT(*) as total_tabelas
from
  information_schema.tables
where
  table_schema = 'public'
  and table_type = 'BASE TABLE';