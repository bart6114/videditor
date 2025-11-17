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

export interface DirectUploadResponse {
  uid: string;
  uploadURL: string;
  watermark?: {
    uid: string;
  };
}

export interface StreamDownload {
  status: {
    state: 'ready' | 'inprogress' | 'error';
    pct?: string;
    errorReasonCode?: string;
    errorReasonText?: string;
  };
  default?: {
    url?: string;
    status?: string;
  };
  audio?: {
    url?: string;
    status?: string;
  };
}

/**
 * Create a Direct Creator Upload URL for TUS uploads
 */
export async function createDirectUploadUrl(
  accountId: string,
  apiKey: string,
  metadata?: Record<string, string>
): Promise<DirectUploadResponse> {
  const body: Record<string, unknown> = {
    requireSignedURLs: false,
  };

  if (metadata) {
    body.meta = metadata;
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
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
    throw new Error(`Failed to create direct upload URL: ${error}`);
  }

  const data = await response.json() as { result: DirectUploadResponse };
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
 * Create an audio download for a Stream video
 */
export async function createAudioDownload(
  accountId: string,
  apiKey: string,
  videoId: string
): Promise<void> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoId}/downloads/audio`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create audio download: ${error}`);
  }
}

/**
 * Get download status and URL for Stream video
 */
export async function getStreamDownloads(
  accountId: string,
  apiKey: string,
  videoId: string
): Promise<StreamDownload> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoId}/downloads`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get downloads: ${error}`);
  }

  const data = await response.json() as { result: StreamDownload };
  return data.result;
}

/**
 * Poll for audio download to be ready, then return the URL
 */
export async function pollAudioDownload(
  accountId: string,
  apiKey: string,
  videoId: string,
  maxAttempts: number = 30,
  delayMs: number = 2000
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const downloads = await getStreamDownloads(accountId, apiKey, videoId);

    if (downloads.audio?.status === 'ready' && downloads.audio.url) {
      return downloads.audio.url;
    }

    if (downloads.status.state === 'error') {
      throw new Error(
        `Audio download failed: ${downloads.status.errorReasonText || 'Unknown error'}`
      );
    }

    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  throw new Error('Audio download timeout: exceeded maximum attempts');
}

/**
 * Verify Stream webhook signature
 */
export function verifyStreamWebhook(
  body: string,
  signature: string,
  secret: string
): boolean {
  // Stream uses HMAC-SHA256 for webhook verification
  // The signature is in format: "sha256=<hash>"
  const crypto = globalThis.crypto;
  if (!crypto || !crypto.subtle) {
    throw new Error('WebCrypto API not available');
  }

  // Extract the hash from signature
  const expectedSignature = signature.replace('sha256=', '');

  // Create HMAC-SHA256 hash
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(body);

  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  ).then(key => {
    return crypto.subtle.sign('HMAC', key, messageData);
  }).then(signatureBuffer => {
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === expectedSignature;
  }).catch(() => {
    return false;
  });
}
