#!/bin/bash

DB_NAME="legalclick"
DB_USER="postgres"
SQL_FILE="legalclick.sql"

# Safety check
if [ ! -f "$SQL_FILE" ]; then
    echo "❌ SQL file '$SQL_FILE' not found!"
    exit 1
fi

echo "⚠️ Dropping and recreating database: $DB_NAME"
psql -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;"
psql -U $DB_USER -c "CREATE DATABASE $DB_NAME;"

echo "🚀 Importing '$SQL_FILE' into $DB_NAME"
psql -U $DB_USER -d $DB_NAME -f "$SQL_FILE"

echo "✅ Done! Database '$DB_NAME' has been reset."
echo "Test."
