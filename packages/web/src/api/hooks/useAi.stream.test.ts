// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, beforeEach } from 'vitest';
import { streamStatementProgress, type StatementProgressSnapshot } from './useAi';

// Build a fetch impl that returns an SSE response of the given frames. Injected
// per-call (no global stubbing) so tests can't race on a shared global fetch.
function fakeFetch(frames: string[], status = 200): typeof fetch {
  return (async () => {
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const f of frames) controller.enqueue(enc.encode(f));
        controller.close();
      },
    });
    return new Response(status === 200 ? body : 'err', { status });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  localStorage.setItem('accessToken', 'test-token');
});

describe('streamStatementProgress', () => {
  it('parses staged snapshots and the terminal result, ignoring heartbeats', async () => {
    const frames = [
      ': heartbeat\n\n',
      'data: {"status":"processing","stage":"ocr","confidence":null,"error":null,"result":null}\n\n',
      'data: {"status":"processing","stage":"extracting","confidence":null,"error":null,"result":null}\n\n',
      'data: {"status":"complete","stage":"done","confidence":0.9,"error":null,"result":{"transactions":[{"date":"2026-01-01","description":"X","amount":"1.00","type":"debit"}]}}\n\n',
    ];
    const snaps: StatementProgressSnapshot[] = [];
    await streamStatementProgress('job1', (s) => snaps.push(s), undefined, fakeFetch(frames));
    expect(snaps.map((s) => s.stage)).toEqual(['ocr', 'extracting', 'done']);
    expect(snaps.at(-1)!.status).toBe('complete');
    expect(snaps.at(-1)!.result!.transactions).toHaveLength(1);
  });

  it('reassembles a frame split across chunks', async () => {
    const frames = [
      'data: {"status":"processing","stage":"oc',
      'r","confidence":null,"error":null,"result":null}\n\n',
    ];
    const snaps: StatementProgressSnapshot[] = [];
    await streamStatementProgress('job1', (s) => snaps.push(s), undefined, fakeFetch(frames));
    expect(snaps).toHaveLength(1);
    expect(snaps[0]!.stage).toBe('ocr');
  });

  it('throws on an event: error frame', async () => {
    let msg = '';
    try {
      await streamStatementProgress('job1', () => {}, undefined, fakeFetch(['event: error\ndata: {"message":"boom"}\n\n']));
    } catch (e) {
      msg = e instanceof Error ? e.message : String(e);
    }
    expect(msg).toBe('boom');
  });

  it('throws when the response is not ok', async () => {
    let msg = '';
    try {
      await streamStatementProgress('job1', () => {}, undefined, fakeFetch([], 404));
    } catch (e) {
      msg = e instanceof Error ? e.message : String(e);
    }
    expect(msg).toMatch(/404/);
  });

  it('sends the bearer token', async () => {
    let calledUrl = '';
    let calledInit: RequestInit | undefined;
    const spyFetch = (async (url: string, init?: RequestInit) => {
      calledUrl = url;
      calledInit = init;
      return fakeFetch([])(url as never, init as never);
    }) as unknown as typeof fetch;
    await streamStatementProgress('job42', () => {}, undefined, spyFetch);
    expect(calledUrl).toBe('/api/v1/ai/parse/statement/job42/progress');
    expect((calledInit?.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
  });
});
