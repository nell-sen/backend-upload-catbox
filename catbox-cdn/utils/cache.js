const TTL_MS = 30 * 60 * 1000; // 30 minutes

class Cache {
  constructor() {
    this.store = new Map();
    // Auto-cleanup every 10 minutes
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  set(key, value) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + TTL_MS,
      hits: 0,
    });
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    entry.hits++;
    return entry.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    this.store.delete(key);
  }

  cleanup() {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      console.log(`[CACHE] Cleaned up ${removed} expired entries. Active: ${this.store.size}`);
    }
  }

  stats() {
    return {
      size: this.store.size,
      keys: [...this.store.keys()],
    };
  }
}

module.exports = new Cache();
