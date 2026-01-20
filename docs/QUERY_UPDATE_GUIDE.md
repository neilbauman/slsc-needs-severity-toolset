# Query Update Guide for Multi-Country Support

This guide shows how to update existing Supabase queries to include country filtering.

## Quick Reference

### Import the Hook

```typescript
import { useCountry } from '@/lib/countryContext';
```

### Get Current Country

```typescript
const { currentCountry, loading: countryLoading } = useCountry();

// Always check if country is available
if (countryLoading || !currentCountry) {
  return <div>Loading country...</div>;
}
```

## Common Query Patterns

### 1. Fetching Datasets

**Before:**
```typescript
const { data, error } = await supabase
  .from('datasets')
  .select('*');
```

**After:**
```typescript
const { currentCountry } = useCountry();
const { data, error } = await supabase
  .from('datasets')
  .select('*')
  .eq('country_id', currentCountry.id);
```

**Or use the helper:**
```typescript
import { getDatasets } from '@/lib/supabaseClient';
const { currentCountry } = useCountry();
const { data, error } = await getDatasets(currentCountry.id);
```

### 2. Fetching a Single Dataset

**Before:**
```typescript
const { data, error } = await supabase
  .from('datasets')
  .select('*')
  .eq('id', datasetId)
  .single();
```

**After:**
```typescript
const { currentCountry } = useCountry();
const { data, error } = await supabase
  .from('datasets')
  .select('*')
  .eq('id', datasetId)
  .eq('country_id', currentCountry.id)  // Add this
  .single();
```

**Security Note**: Always verify the dataset belongs to the current country to prevent unauthorized access.

### 3. Fetching Instances

**Before:**
```typescript
const { data, error } = await supabase
  .from('instances')
  .select('*');
```

**After:**
```typescript
const { currentCountry } = useCountry();
const { data, error } = await supabase
  .from('instances')
  .select('*')
  .eq('country_id', currentCountry.id);
```

**Or use the helper:**
```typescript
import { getInstances } from '@/lib/supabaseClient';
const { currentCountry } = useCountry();
const { data, error } = await getInstances(currentCountry.id);
```

### 4. Fetching Admin Boundaries

**Before:**
```typescript
const { data, error } = await supabase
  .from('admin_boundaries')
  .select('*')
  .eq('admin_level', 'ADM3');
```

**After:**
```typescript
const { currentCountry } = useCountry();
const { data, error } = await supabase
  .from('admin_boundaries')
  .select('*')
  .eq('country_id', currentCountry.id)  // Add this first
  .eq('admin_level', 'ADM3');
```

**Or use the helper:**
```typescript
import { getAdminBoundaries } from '@/lib/supabaseClient';
const { currentCountry } = useCountry();
const { data, error } = await getAdminBoundaries(
  currentCountry.id,
  (q) => q.eq('admin_level', 'ADM3')
);
```

### 5. Creating New Records

**Before:**
```typescript
const { data, error } = await supabase
  .from('datasets')
  .insert({
    name: 'New Dataset',
    type: 'numeric',
    admin_level: 'ADM3',
  });
```

**After:**
```typescript
const { currentCountry } = useCountry();
const { data, error } = await supabase
  .from('datasets')
  .insert({
    name: 'New Dataset',
    type: 'numeric',
    admin_level: 'ADM3',
    country_id: currentCountry.id,  // Add this
  });
```

### 6. RPC Calls

**Before:**
```typescript
const { data, error } = await supabase.rpc('score_numeric_auto', {
  in_instance_id: instanceId,
  in_dataset_id: datasetId,
  // ... other params
});
```

**After:**
```typescript
// Most RPCs inherit country via instance relationship
// But verify the instance belongs to current country first:
const { currentCountry } = useCountry();
const { data: instance } = await supabase
  .from('instances')
  .select('id, country_id')
  .eq('id', instanceId)
  .eq('country_id', currentCountry.id)
  .single();

if (!instance) {
  throw new Error('Instance not found or access denied');
}

// Then proceed with RPC call
const { data, error } = await supabase.rpc('score_numeric_auto', {
  in_instance_id: instanceId,
  in_dataset_id: datasetId,
  // ... other params
});
```

## Component Update Pattern

### Example: Dataset List Component

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useCountry } from '@/lib/countryContext';
import supabase from '@/lib/supabaseClient';

export default function DatasetList() {
  const { currentCountry, loading: countryLoading } = useCountry();
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (countryLoading || !currentCountry) {
      return; // Wait for country to load
    }

    async function loadDatasets() {
      setLoading(true);
      const { data, error } = await supabase
        .from('datasets')
        .select('*')
        .eq('country_id', currentCountry.id);
      
      if (error) {
        console.error('Error loading datasets:', error);
      } else {
        setDatasets(data || []);
      }
      setLoading(false);
    }

    loadDatasets();
  }, [currentCountry, countryLoading]);

  if (countryLoading) {
    return <div>Loading country...</div>;
  }

  if (!currentCountry) {
    return <div>No country selected</div>;
  }

  if (loading) {
    return <div>Loading datasets...</div>;
  }

  return (
    <div>
      {datasets.map(dataset => (
        <div key={dataset.id}>{dataset.name}</div>
      ))}
    </div>
  );
}
```

## Security Checklist

When updating queries, ensure:

- [ ] All `SELECT` queries include `.eq('country_id', currentCountry.id)`
- [ ] All `INSERT` queries include `country_id: currentCountry.id`
- [ ] All `UPDATE` queries include country filter in WHERE clause
- [ ] Single-record fetches verify country ownership
- [ ] RPC calls verify instance/dataset belongs to current country
- [ ] User cannot access data from other countries
- [ ] Site admins can access all countries (handled by CountryProvider)

## Common Pitfalls

1. **Forgetting to check if country is loaded**
   ```typescript
   // ❌ BAD
   const { currentCountry } = useCountry();
   const { data } = await supabase.from('datasets').eq('country_id', currentCountry.id);
   
   // ✅ GOOD
   const { currentCountry, loading } = useCountry();
   if (loading || !currentCountry) return <div>Loading...</div>;
   const { data } = await supabase.from('datasets').eq('country_id', currentCountry.id);
   ```

2. **Not verifying ownership on single-record fetches**
   ```typescript
   // ❌ BAD - User could access other country's dataset
   const { data } = await supabase
     .from('datasets')
     .select('*')
     .eq('id', datasetId)
     .single();
   
   // ✅ GOOD - Verify country ownership
   const { data } = await supabase
     .from('datasets')
     .select('*')
     .eq('id', datasetId)
     .eq('country_id', currentCountry.id)
     .single();
   ```

3. **Forgetting country_id on inserts**
   ```typescript
   // ❌ BAD
   await supabase.from('datasets').insert({ name: 'New', type: 'numeric' });
   
   // ✅ GOOD
   await supabase.from('datasets').insert({ 
     name: 'New', 
     type: 'numeric',
     country_id: currentCountry.id 
   });
   ```

## Files That Need Updates

See `MULTI_COUNTRY_IMPLEMENTATION.md` for a complete list of files that need query updates.
