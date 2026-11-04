import { promises as fs } from "node:fs";
import { dirname } from "node:path";

/**
 * Where the serialized ticket state lives.
 * The store keeps everything in one JSON document, so a backend only needs
 * to read and write a single string.
 */
export interface StorageBackend {
  read(): Promise<string | null>;
  write(data: string): Promise<void>;
}

/** Local JSON file. Good for long polling on a VPS or a home machine. */
export class FileBackend implements StorageBackend {
  constructor(private readonly filePath: string) {}

  async read(): Promise<string | null> {
    try {
      return await fs.readFile(this.filePath, "utf8");
    } catch {
      return null;
    }
  }

  async write(data: string): Promise<void> {
    await fs.mkdir(dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, data, "utf8");
  }
}

/**
 * Upstash Redis over its REST API. Survives serverless cold starts and
 * redeploys, unlike the ephemeral /tmp directory on Vercel.
 * Uses plain fetch, so no extra dependency is needed.
 */
export class UpstashBackend implements StorageBackend {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly key: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async command(args: string[]): Promise<unknown> {
    const res = await this.fetchImpl(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(5000),
    });
    const body = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
    if (!res.ok || body.error) {
      throw new Error(`Upstash ${args[0]} failed: ${body.error ?? `HTTP ${res.status}`}`);
    }
    return body.result;
  }

  async read(): Promise<string | null> {
    const result = await this.command(["GET", this.key]);
    return typeof result === "string" ? result : null;
  }

  async write(data: string): Promise<void> {
    await this.command(["SET", this.key, data]);
  }
}

/** In-memory backend for tests. */
export class MemoryBackend implements StorageBackend {
  constructor(public data: string | null = null) {}

  async read(): Promise<string | null> {
    return this.data;
  }

  async write(data: string): Promise<void> {
    this.data = data;
  }
}
