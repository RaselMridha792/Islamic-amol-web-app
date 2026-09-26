#!/bin/sh
# হাতে পুরো ব্যাকআপ নেওয়া → backups/manual-<সময়>.dump
#   ./backup.sh
# (রোজকার ব্যাকআপ backup সার্ভিস নিজেই নেয় → backups/auto/)
set -e
cd "$(dirname "$0")"
name="manual-$(date -u +%Y-%m-%d_%H%M).dump"
docker compose exec -T db pg_dump -U deen -d deen \
  --format=custom --compress=9 --no-owner --no-privileges --file="/backups/$name"
echo "ব্যাকআপ রাখা হলো: backups/$name"
