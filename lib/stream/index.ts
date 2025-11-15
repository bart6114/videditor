// Cloudflare Stream API Utilities

export interface StreamVideo {
  uid: string;
  thumbnail?: string;
  playback?: {
    hls: string;
    dash: string;
  };
  status: {
    state: 'queued' | 'inprogress' | 'ready' | 'error';
    errorReasonCode?: string;
    errorReasonText?: string;
  };
  meta?: Record<string, string>;
  duration?: number;
}

export interface StreamClip {
  uid: string;
  clippedFromVideoUID: string;
  startTime: number;
  endTime: number;
  playback?: {
    hls: string;
    dash: string;
  };
}

/**
 * Upload video to Cloudflare Stream from R2
 */
export async function uploadToStream(
  accountId: string,
  apiKey: string,
  videoUrl: string,
  metadata?: Record<string, string>
): Promise<StreamVideo> {
  const formData = new FormData();
  formData.append('url', videoUrl);
  if (metadata) {
    formData.append('meta', JSON.stringify(metadata));
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/copy`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Stream upload failed: ${error}`);
  }

  const data = await response.json() as { result: StreamVideo };
  return data.result;
}

/**
 * Get video details from Cloudflare Stream
 */
export async function getStreamVideo(
  accountId: string,
  apiKey: string,
  videoId: string
): Promise<StreamVideo> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoId}`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get video: ${await response.text()}`);
  }

  const data = await response.json() as { result: StreamVideo };
  return data.result;
}

/**
 * Create a clip from a Cloudflare Stream video
 */
export async function createStreamClip(
  accountId: string,
  apiKey: string,
  videoId: string,
  startTime: number,
  endTime: number,
  metadata?: Record<string, string>
): Promise<StreamClip> {
  const body = {
    clippedFromVideoUID: videoId,
    startTimeSeconds: Math.floor(startTime),
    endTimeSeconds: Math.floor(endTime),
    ...(metadata && { meta: metadata }),
  };

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/clip`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Stream clip creation failed: ${error}`);
  }

  const data = await response.json() as { result: StreamClip };
  return data.result;
}

/**
 * Delete video from Cloudflare Stream
 */
export async function deleteStreamVideo(
  accountId: string,
  apiKey: string,
  videoId: string
): Promise<void> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to delete video: ${await response.text()}`);
  }
}

/**
 * Get download URL for Stream video (for transcription processing)
 */
export function getStreamDownloadUrl(accountId: string, videoId: string, apiKey: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoId}/downloads`;
}
