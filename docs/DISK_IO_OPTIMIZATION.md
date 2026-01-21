# Disk IO Budget Optimization Guide

## What is Disk IO Budget?

Disk IO (Input/Output) Budget is a Supabase resource limit that measures the number of disk read/write operations your project performs. Each database operation (INSERT, UPDATE, DELETE, SELECT) consumes IO credits.

## Why Are We Hitting the Limit?

Recent boundary imports have been very IO-intensive:
- **Bangladesh**: 580 boundaries (507 ADM3)
- **Mozambique**: 582 boundaries (411 ADM3)  
- **Sri Lanka**: 14,366+ boundaries (14,022 ADM4)

The original import function used **row-by-row INSERTs**, which means:
- Each boundary = 1 INSERT operation
- 14,022 boundaries = 14,022+ IO operations
- Multiple re-imports due to bugs = even more IO

## Solutions

### 1. **Optimized Import Function** (Already Applied)
The new `import_admin_boundaries` function uses:
- Bulk operations where possible
- ON CONFLICT for efficient updates
- Single transaction per batch

### 2. **Increase Batch Sizes**
Instead of batches of 50, we could increase to 200-500 for countries with many boundaries.

### 3. **Schedule Imports During Off-Peak Hours**
Run large imports when the database is less active.

### 4. **Upgrade Supabase Plan**
If you frequently need large imports, consider upgrading to a plan with higher IO limits.

### 5. **Monitor IO Usage**
Check your Supabase dashboard → Settings → Usage to see current IO consumption.

## Best Practices Going Forward

1. **Batch Operations**: Always use batch inserts/updates when possible
2. **Avoid Re-imports**: Test import scripts thoroughly before running on production
3. **Use Transactions**: Group related operations in single transactions
4. **Index Optimization**: Ensure proper indexes exist to reduce read operations
5. **Cache Queries**: Use Supabase caching for frequently accessed data

## Current Status

- ✅ Import function optimized for bulk operations
- ✅ Batch deletion bug fixed (prevents unnecessary re-imports)
- ⚠️ Sri Lanka import pending (will use optimized function)
