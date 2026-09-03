const store = new Map();

function getCached(key, ttlMs) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > ttlMs) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  store.set(key, { value, savedAt: Date.now() });
}

module.exports = { getCached, setCached };
