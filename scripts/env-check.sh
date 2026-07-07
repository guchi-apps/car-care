echo "OK: 1Password env injection works"
echo "DATABASE_URL=*** AUTH_URL=*** [assembled from DB_* / AUTH_URL_*]"

env | grep -E '^(DB_USER|DB_NAME|AUTH_URL_DEV|AUTH_SECRET|GOOGLE_CLIENT_ID)=' \
  | sed 's/=.*$/=***/'
