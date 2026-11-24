export interface DisplayQueueEntry {
  id: string;
  token: string;
  status: 'waiting' | 'called' | 'in_service';
  assignedBarberName: string | null;
  serviceNames: string[];
  estimatedWaitMinutes: number | null;
}

export interface DisplayQueueData {
  queueOpen: boolean;
  nowServing: DisplayQueueEntry | null;
  active: DisplayQueueEntry[];
  upNext: DisplayQueueEntry[];
  waiting: DisplayQueueEntry[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export async function fetchDisplayQueue(
  signal?: AbortSignal,
): Promise<DisplayQueueData> {
  const response = await fetch('/api/queue/display', { signal });
  const result = (await response.json()) as ApiResponse<DisplayQueueData>;
  if (!response.ok || !result.success || !result.data) {
    throw new Error(
      result.message ?? `The request failed with HTTP ${response.status}.`,
    );
  }
  return result.data;
}
