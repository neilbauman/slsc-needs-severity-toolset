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

export async function getPCodeAlignmentPreview(datasetId: string, matchingConfig?: any) {
  const { data, error } = await supabase
    .rpc('preview_pcode_alignment', {
      dataset_id: datasetId,
      matching_config: matchingConfig || {},
    });

  if (error) {
    console.error('PCode alignment preview error:', error);
    throw error;
  }

  return data || [];
}

export async function computeDataHealth(datasetId: string) {
  const { data, error } = await supabase
    .rpc('compute_data_health', { dataset_id: datasetId });

  if (error) {
    console.error('Data health computation error:', error);
    throw error;
  }

  return data;
}
