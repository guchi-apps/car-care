echo "OK: .env.local env injection works"
echo "DATABASE_URL=*** [assembled from DB_*]"

env | grep -E '^(DB_USER|DB_NAME|NEXT_PUBLIC_SUPABASE_URL|ALLOWED_GOOGLE_EMAILS)=' \
  | sed 's/=.*$/=***/'
