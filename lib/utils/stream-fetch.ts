/**
 * Utility for fetching JSON from an SSE stream that may contain keepalive heartbeats.
 * Specifically handles the format:
 *   : keepalive\n\n
 *   data: {"success": true, ...}\n\n
 */
export async function fetchStreamingJson<T>(
  url: string,
  options: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const { timeoutMs = 120000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Link external signal if provided
  if (fetchOptions.signal) {
    if (fetchOptions.signal.aborted) {
      clearTimeout(timeoutId);
      throw fetchOptions.signal.reason || new Error('Aborted');
    }
    fetchOptions.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      controller.abort();
    });
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Stream not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue; // Skip heartbeats/comments

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              return parsed as T;
            } catch (e) {
              if (e instanceof Error && e.message === 'No data received from stream') throw e;
              console.error('Error parsing streaming JSON:', e, 'Raw:', dataStr);
              throw new Error('Invalid JSON received from stream');
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    throw new Error('No data received from stream');
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      // Check if it was our timeout or external signal
      if (fetchOptions.signal?.aborted) {
        throw fetchOptions.signal.reason || new Error('Aborted');
      }
      throw new Error('Headers Timeout Error');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
