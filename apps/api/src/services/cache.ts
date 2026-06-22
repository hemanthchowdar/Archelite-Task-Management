import { config } from '../config';
import { Redis } from '@upstash/redis';

export interface CacheService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
}

class MemoryCacheService implements CacheService {
  private store = new Map<string, { value: string; expiresAt: number | null }>();
  private counters = new Map<string, { value: number; expiresAt: number | null }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
    this.counters.delete(key);
  }

  async incr(key: string): Promise<number> {
    const now = Date.now();
    const entry = this.counters.get(key);
    if (!entry || (entry.expiresAt && entry.expiresAt < now)) {
      const expiresAt = now + 600 * 1000; // 10 minutes default
      this.counters.set(key, { value: 1, expiresAt });
      return 1;
    }
    entry.value += 1;
    return entry.value;
  }
}

class UpstashCacheService implements CacheService {
  private client: Redis;

  constructor(url: string, token: string) {
    this.client = new Redis({ url, token });
  }

  async get(key: string): Promise<string | null> {
    return this.client.get<string>(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, { ex: ttlSeconds });
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    const val = await this.client.incr(key);
    if (val === 1) {
      await this.client.expire(key, 600); // 10 minutes expiry on new rate limiter window
    }
    return val;
  }
}

let cacheService: CacheService;

if (config.UPSTASH_REDIS_REST_URL && config.UPSTASH_REDIS_REST_TOKEN) {
  console.log('🔌 Connecting to Upstash Redis...');
  cacheService = new UpstashCacheService(config.UPSTASH_REDIS_REST_URL, config.UPSTASH_REDIS_REST_TOKEN);
} else {
  console.log('ℹ️ No Upstash Redis configuration found. Using in-memory fallback cache.');
  cacheService = new MemoryCacheService();
}

export { cacheService };
