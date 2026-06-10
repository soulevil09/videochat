SELECT COUNT(*) as total_enums
FROM pg_type
WHERE typcategory = 'E';