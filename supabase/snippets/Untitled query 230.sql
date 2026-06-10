SELECT typname
FROM pg_type
WHERE typcategory = 'E'
ORDER BY typname;