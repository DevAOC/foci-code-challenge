#!/usr/bin/env sh
# Idempotently creates the development and test databases on the local
# Postgres server. Safe to re-run. See DEVELOPMENT.md for the manual steps.
set -eu

for db in foci_dev foci_test; do
  if psql -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '$db'" | grep -q 1; then
    echo "database $db already exists"
  else
    createdb "$db"
    echo "created database $db"
  fi
done
