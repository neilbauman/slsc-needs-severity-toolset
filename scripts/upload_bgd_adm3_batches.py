#!/usr/bin/env python3
"""
Upload BGD ADM3 boundaries in batches via Supabase MCP.
This script splits the SQL file into batches and generates them for manual upload.
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

print(f"Total INSERT statements: {len(inserts)}")
print(f"Number of batches: {len(batches)}")
print(f"\nBatch sizes:")
for i, batch in enumerate(batches):
    print(f"  Batch {i+1}: {len(batch)} chars, {len(batch.split('INSERT'))-1} records")

# Save all batches to files
output_dir = Path(__file__).parent.parent / "data" / "upload_batches"
output_dir.mkdir(parents=True, exist_ok=True)

for i, batch in enumerate(batches):
    batch_file = output_dir / f"bgd_adm3_batch_{i+1}_of_{len(batches)}.sql"
    with open(batch_file, 'w') as f:
        f.write(f"-- BGD ADM3 Batch {i+1} of {len(batches)}\n")
        f.write(f"-- Records {i*batch_size + 1} to {min((i+1)*batch_size, len(inserts))}\n\n")
        f.write(batch)
    print(f"Saved: {batch_file}")

print(f"\nAll batches saved to: {output_dir}")
print("\nThese batches can be uploaded via Supabase MCP execute_sql")
