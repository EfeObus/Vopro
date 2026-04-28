import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CapturedEvent } from './types';

// Append-only JSONL buffer on disk. Survives crashes; replayed on startup.
export class EventBuffer {
  readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async append(event: CapturedEvent): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.appendFile(this.filePath, JSON.stringify(event) + '\n', 'utf8');
  }

  async appendMany(events: CapturedEvent[]): Promise<void> {
    if (events.length === 0) return;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
    await fs.appendFile(this.filePath, lines, 'utf8');
  }

  async readAll(): Promise<CapturedEvent[]> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      return raw
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as CapturedEvent);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  async clear(): Promise<void> {
    try {
      await fs.unlink(this.filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  async replaceAll(events: CapturedEvent[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(
      this.filePath,
      events.map((e) => JSON.stringify(e)).join('\n') + (events.length ? '\n' : ''),
      'utf8',
    );
  }
}
