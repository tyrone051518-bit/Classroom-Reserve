// This simulates localStorage in environments where it is missing (like Node/SSR)
if (typeof window === 'undefined') {
  global.localStorage = {
    _store: {},
    getItem(key) {
      return this._store[key] || null;
    },
    setItem(key, value) {
      this._store[key] = value.toString();
    },
    removeItem(key) {
      delete this._store[key];
    },
    clear() {
      this._store = {};
    }
  };
}