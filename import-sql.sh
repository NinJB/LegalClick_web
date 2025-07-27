#!/bin/bash

# Variables
CONTAINER_NAME="legalclick-db"
DB_USER="postgres"
DB_NAME="legalclick"
SQL_FILE="./legalclick.sql"  # Adjust path if needed

# Check if the SQL file exists
if [ ! -f "$SQL_FILE" ]; then
  echo "SQL file '$SQL_FILE' not found!"
  exit 1
fi

# Import SQL file into the running Postgres container
echo "Importing '$SQL_FILE' into database '$DB_NAME' on container '$CONTAINER_NAME'..."

docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < $SQL_FILE

if [ $? -eq 0 ]; then
  echo "Import completed successfully."
else
  echo "Import failed."
fi
