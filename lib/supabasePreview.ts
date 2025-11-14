import { supabase } from './supabaseClient';

export async function getNumericCleaningPreview(datasetId: string) {
  const { data, error } = await supabase
    .rpc('preview_numeric_cleaning_v2', { _dataset_id: datasetId });

  if (error) {
    console.error('Preview RPC error:', error);
    throw error;
  }

  return data || [];
}
