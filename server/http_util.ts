import * as http from 'node:http';

export function json(res: http.ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}

export function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    let aborted = false;
    req.on('data', (c) => {
      if (aborted) return;
      data += c;
      if (data.length > 64 * 1024) {
        // Rejecting the promise does not pause the socket, so without
        // destroying the request a client could keep streaming unbounded
        // data into `data`. Stop reading and ignore any further chunks.
        aborted = true;
        req.destroy();
        reject(new Error('body too large'));
      }
    });
    req.on('end', () => {
      if (aborted) return;
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('bad json'));
      }
    });
    req.on('error', reject);
  });
}
