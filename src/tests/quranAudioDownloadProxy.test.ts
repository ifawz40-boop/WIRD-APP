import handler from '../../api/quran-audio-download';

function createResponseRecorder() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body: unknown;
  const response = {
    setHeader(name: string, value: string) { headers[name.toLowerCase()] = value; return this; },
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { body = value; return this; },
    send(value: unknown) { body = value; return this; },
    end() { return this; }
  };
  return { response, headers, get statusCode() { return statusCode; }, get body() { return body; } };
}

export async function runQuranAudioDownloadProxyTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const test = async (name: string, run: () => Promise<void>) => {
    try { await run(); passed++; console.log('  ✅ [PASS]: ' + name); }
    catch (error) { failed++; console.error('  ❌ [FAIL]: ' + name + ' - ' + (error instanceof Error ? error.message : error)); }
  };
  const originalFetch = globalThis.fetch;

  await test('relays only allowlisted reciter ayah bytes from the canonical CDN URL', async () => {
    let requestedUrl = '';
    let requestedInit: RequestInit | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input);
      requestedInit = init;
      return new Response(new Uint8Array([0xff, 0xfb, 0x90, 0x64]), {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': '4' }
      });
    }) as typeof fetch;
    const recorder = createResponseRecorder();
    await handler({
      method: 'GET',
      query: { reciter: 'ar.alafasy', ayah: '100' },
      headers: { 'x-real-ip': 'audio-proxy-test-valid' }
    }, recorder.response);
    if (recorder.statusCode !== 200) throw new Error('Expected HTTP 200, received ' + recorder.statusCode);
    if (requestedUrl !== 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/100.mp3') {
      throw new Error('Unexpected upstream URL: ' + requestedUrl);
    }
    if (requestedInit?.redirect !== 'error') throw new Error('Upstream redirects must be rejected');
    if (!Buffer.isBuffer(recorder.body) || (recorder.body as Buffer).byteLength !== 4) {
      throw new Error('The proxy must return the verified audio bytes as a binary response');
    }
    if (recorder.headers['content-type'] !== 'audio/mpeg') throw new Error('The proxy must declare audio/mpeg');
  });

  await test('rejects unknown reciters and out-of-range ayah numbers before network access', async () => {
    let networkCalls = 0;
    globalThis.fetch = (async () => {
      networkCalls++;
      return new Response('unexpected');
    }) as typeof fetch;
    const recorder = createResponseRecorder();
    await handler({
      method: 'GET',
      query: { reciter: 'unreviewed-edition', ayah: '6237' },
      headers: { 'x-real-ip': 'audio-proxy-test-invalid' }
    }, recorder.response);
    if (recorder.statusCode !== 400 || networkCalls !== 0) {
      throw new Error('Invalid audio coordinates must be rejected before contacting the provider');
    }
  });

  await test('rejects HTML and non-audio upstream payloads without forwarding them', async () => {
    globalThis.fetch = (async () => new Response('<html>blocked</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html', 'Content-Length': '20' }
    })) as typeof fetch;
    const recorder = createResponseRecorder();
    await handler({
      method: 'GET',
      query: { reciter: 'ar.husary', ayah: '1' },
      headers: { 'x-real-ip': 'audio-proxy-test-html' }
    }, recorder.response);
    if (recorder.statusCode !== 502 || !recorder.body || typeof recorder.body !== 'object' ||
        (recorder.body as { error?: string }).error !== 'INVALID_AUDIO_SOURCE_RESPONSE') {
      throw new Error('HTML must never be returned as an audio file');
    }
  });

  globalThis.fetch = originalFetch;
  return { passed, failed };
}
