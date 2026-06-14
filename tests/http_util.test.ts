import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import type * as http from 'node:http';
import { readBody } from '../server/http_util';

// Minimal IncomingMessage stand-in: an emitter that records whether the
// request was destroyed so we can assert readBody stops reading the socket.
class FakeReq extends EventEmitter {
  destroyed = false;
  destroy(): void {
    this.destroyed = true;
  }
}

const fakeReq = () => new FakeReq() as unknown as http.IncomingMessage & FakeReq;

describe('readBody', () => {
  it('parses a small JSON body', async () => {
    const req = fakeReq();
    const promise = readBody(req);
    req.emit('data', JSON.stringify({ hello: 'world' }));
    req.emit('end');
    await expect(promise).resolves.toEqual({ hello: 'world' });
  });

  it('resolves to an empty object for an empty body', async () => {
    const req = fakeReq();
    const promise = readBody(req);
    req.emit('end');
    await expect(promise).resolves.toEqual({});
  });

  it('rejects malformed JSON', async () => {
    const req = fakeReq();
    const promise = readBody(req);
    req.emit('data', '{ not json');
    req.emit('end');
    await expect(promise).rejects.toThrow('bad json');
  });

  it('rejects and destroys the request when the body exceeds 64KB', async () => {
    const req = fakeReq();
    const promise = readBody(req);
    req.emit('data', 'x'.repeat(64 * 1024 + 1));
    await expect(promise).rejects.toThrow('body too large');
    expect(req.destroyed).toBe(true);
  });

  it('stops buffering after the limit is hit', async () => {
    const req = fakeReq();
    const promise = readBody(req);
    req.emit('data', 'x'.repeat(64 * 1024 + 1));
    await expect(promise).rejects.toThrow('body too large');
    // Late chunks arriving after the abort must not be appended or throw.
    expect(() => req.emit('data', 'y'.repeat(1024 * 1024))).not.toThrow();
  });
});
