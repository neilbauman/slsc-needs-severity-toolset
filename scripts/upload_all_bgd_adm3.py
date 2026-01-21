#!/usr/bin/env python3
"""
Upload all BGD ADM3 batches via Supabase MCP.
This script reads the SQL file, splits it into batches, and uploads them.
"""

import re
from pathlib import Path

# Read BGD ADM3 SQL
sql_file = Path(__file__).parent.parent / "supabase" / "migrations" / "42_upload_BGD_ADM3.sql"
with open(sql_file, 'r') as f:
    content = f.read()

# Split by INSERT statements
inserts = re.findall(r"INSERT INTO[^;]+;", content, re.DOTALL)

# Create batches of 50
batch_size = 50
batches = []
for i in range(0, len(inserts), batch_size):
    batch = '\n'.join(inserts[i:i+batch_size])
    batches.append(batch)

print(f"Total batches: {len(batches)}")
print(f"Total records: {len(inserts)}")
print("\nBatch information:")
for i, batch in enumerate(batches):
    record_count = len(batch.split('INSERT')) - 1
    print(f"  Batch {i+1}: {len(batch)} chars, {record_count} records")

print("\n" + "="*60)
print("Batches are ready. Upload batch 1 manually, then batches 2-11.")
print("="*60)
