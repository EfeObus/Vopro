import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import type { AgentConfig, EventKind } from './types';
import type { Capture } from './capture';

const ALLOWED_KINDS = new Set<EventKind>([
  'click',
  'input',
  'navigation',
  'focus',
  'blur',
  'form_submit',
  'shortcut',
  'copy',
  'paste',
  'open',
  'close',
]);

const MAX_BODY_BYTES = 256 * 1024;
const MAX_EVENTS_PER_REQUEST = 200;

interface IncomingEvent {
  kind?: string;
  application?: string;
  url?: string;
  target?: string;
  payload?: Record<string, unknown>;
}

interface IncomingBody {
  events?: IncomingEvent[];
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Vopro-Token');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('Payload too large'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}'));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  setCorsHeaders(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export class Receiver {
  private server: http.Server | null = null;

  constructor(private config: AgentConfig, private capture: Capture) {}

  start(): void {
    if (this.server || !this.config.receiver.enabled) return;
    this.server = http.createServer((req, res) => this.handle(req, res));
    this.server.listen(this.config.receiver.port, '127.0.0.1', () => {
      console.log(`[vopro] receiver listening on 127.0.0.1:${this.config.receiver.port}`);
    });
    this.server.on('error', (err) => console.error('[vopro] receiver error', err));
  }

  stop(): void {
    if (!this.server) return;
    this.server.close();
    this.server = null;
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method === 'OPTIONS') {
      setCorsHeaders(res);
      res.statusCode = 204;
      res.end();
      return;
    }

    const url = req.url || '/';

    if (req.method === 'GET' && url === '/healthz') {
      send(res, 200, { status: 'ok', deviceId: this.config.deviceId });
      return;
    }

    // Every other endpoint requires the shared secret.
    const presented = (req.headers['x-vopro-token'] as string | undefined) ?? '';
    if (!presented || !safeEqual(presented, this.config.receiver.sharedSecret)) {
      send(res, 401, { error: 'unauthorized' });
      return;
    }

    if (req.method === 'GET' && url === '/pair') {
      send(res, 200, {
        deviceId: this.config.deviceId,
        apiBaseUrl: this.config.apiBaseUrl,
        captureEnabled: this.config.capture.enabled,
        optedInApps: this.config.capture.optedInApps,
      });
      return;
    }

    if (req.method === 'POST' && url === '/events') {
      let body: unknown;
      try {
        body = await readJson(req);
      } catch (err) {
        send(res, 400, { error: 'invalid_json', detail: (err as Error).message });
        return;
      }
      const events = Array.isArray((body as IncomingBody).events) ? (body as IncomingBody).events! : [];
      if (events.length === 0) {
        send(res, 400, { error: 'no_events' });
        return;
      }
      if (events.length > MAX_EVENTS_PER_REQUEST) {
        send(res, 413, { error: 'too_many_events', max: MAX_EVENTS_PER_REQUEST });
        return;
      }

      let accepted = 0;
      let rejected = 0;
      for (const e of events) {
        if (!e || typeof e !== 'object') {
          rejected += 1;
          continue;
        }
        const kind = e.kind as EventKind | undefined;
        if (!kind || !ALLOWED_KINDS.has(kind)) {
          rejected += 1;
          continue;
        }
        const recorded = await this.capture.record({
          kind,
          application: e.application,
          url: e.url,
          target: e.target,
          payload: e.payload,
        });
        if (recorded) accepted += 1;
        else rejected += 1;
      }
      send(res, 202, { accepted, rejected });
      return;
    }

    send(res, 404, { error: 'not_found' });
  }
}
