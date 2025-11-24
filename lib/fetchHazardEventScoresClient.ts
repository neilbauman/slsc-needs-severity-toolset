'use client';

interface FetchHazardScoresParams {
  instanceId: string;
  hazardEventId?: string;
  hazardEventIds?: string[];
  adminPcodes?: string[];
  includeMagnitude?: boolean;
  signal?: AbortSignal;
}

interface HazardEventScoreRow {
  admin_pcode: string;
  hazard_event_id: string;
  score: number;
  magnitude_value?: number | null;
}

export async function fetchHazardEventScores({
  instanceId,
  hazardEventId,
  hazardEventIds,
  adminPcodes,
  includeMagnitude,
  signal,
}: FetchHazardScoresParams): Promise<HazardEventScoreRow[]> {
  if (!instanceId) throw new Error('instanceId is required');

  const params = new URLSearchParams();
  params.set('instanceId', instanceId);

  const idSet = new Set<string>();
  (hazardEventIds || []).forEach((id) => id && idSet.add(id));
  if (hazardEventId) idSet.add(hazardEventId);
  if (idSet.size > 0) {
    params.set('hazardEventIds', Array.from(idSet).join(','));
  }

  const adminSet = new Set<string>();
  (adminPcodes || []).forEach((code) => code && adminSet.add(code));
  if (adminSet.size > 0) {
    params.set('adminPcodes', Array.from(adminSet).join(','));
  }

  if (includeMagnitude) {
    params.set('includeMagnitude', 'true');
  }

  const response = await fetch(`/api/hazard-event-scores?${params.toString()}`, {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Failed to load hazard event scores (${response.status}): ${message}`
    );
  }

  const payload = await response.json();
  return payload.data ?? [];
}


