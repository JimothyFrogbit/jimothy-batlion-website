// ── ECS Engine ──────────────────────────────────────────────────────
// Entity-Component-System engine for Pondemonium.
// Phase 1: Build alongside existing entity architecture (no swapping).
//
// Entity    → just an ID (components live in stores, not on the entity)
// Component → plain data bags in typed stores
// System    → queries entities by component composition, runs per tick
// World     → owns stores + systems, manages lifecycle
//
// import { nextId } from '../registry.js';

let _nextEntityId = 1;
export function nextEntityId() {
  return _nextEntityId++;
}

// ── Entity ──────────────────────────────────────────────────────────
// Just an ID. All data lives in component stores.
export class EcsEntity {
  constructor() {
    this.id = nextEntityId();
  }
}

// ── ComponentStore ──────────────────────────────────────────────────
// Typed data store. Each component type gets one.
// Stores a Map<entityId, dataObj>.
export class ComponentStore {
  constructor(name) {
    this.name = name;
    this._data = new Map();   // entityId → component data object
    this._entities = [];      // cached array of [entityId, data] for iteration
    this._dirty = false;
  }

  /** Add a component to an entity. entity can be an EcsEntity or numeric id. */
  add(entity, data) {
    const id = typeof entity === 'object' ? entity.id : entity;
    this._data.set(id, data);
    this._dirty = true;
    return data;
  }

  /** Get component data for an entity. */
  get(entity) {
    const id = typeof entity === 'object' ? entity.id : entity;
    return this._data.get(id);
  }

  /** Does entity have this component? */
  has(entity) {
    const id = typeof entity === 'object' ? entity.id : entity;
    return this._data.has(id);
  }

  /** Remove component from entity. */
  remove(entity) {
    const id = typeof entity === 'object' ? entity.id : entity;
    this._data.delete(id);
    this._dirty = true;
  }

  /** Update component data (merge). */
  update(entity, partialData) {
    const id = typeof entity === 'object' ? entity.id : entity;
    const existing = this._data.get(id);
    if (existing) {
      Object.assign(existing, partialData);
    }
    this._dirty = true;
  }

  /** Iterate all entities with this component: returns [entityId, data][] */
  getAll() {
    if (this._dirty || !this._entities) {
      this._entities = Array.from(this._data.entries());
      this._dirty = false;
    }
    return this._entities;
  }

  /** Number of entities with this component. */
  get size() { return this._data.size; }

  /** Clear all data. */
  clear() {
    this._data.clear();
    this._entities = [];
    this._dirty = false;
  }
}

// ── System Base ─────────────────────────────────────────────────────
// Override update(dt, world). Query components via world.getStore(name).
export class EcsSystem {
  constructor(name) {
    this.name = name;
    this.enabled = true;
  }

  /** Called once per tick. Override in subclasses. */
  update(dt, world) {
    // override
  }

  /** Called when system is registered. Override for init. */
  init(world) {
    // override
  }
}

// ── World ───────────────────────────────────────────────────────────
// Owns all component stores and systems. Manages lifecycle.
export class EcsWorld {
  constructor() {
    this._stores = new Map();   // storeName → ComponentStore
    this._systems = [];        // ordered list of systems
    this._entityComponents = new Map();  // entityId → Set<storeName>
    this._entityIndex = new Map();       // entityId → { alive, ... }
    this.totalSpawned = 0;
  }

  // ── Store Management ──

  /** Register (or get) a named component store. */
  registerStore(name) {
    if (!this._stores.has(name)) {
      this._stores.set(name, new ComponentStore(name));
    }
    return this._stores.get(name);
  }

  /** Get a component store by name. */
  getStore(name) {
    return this._stores.get(name);
  }

  /** Check if a store exists. */
  hasStore(name) {
    return this._stores.has(name);
  }

  /** Get multiple stores at once. */
  getStores(...names) {
    return names.map(n => this._stores.get(n));
  }

  // ── Entity Management ──

  /** Create a new entity, optionally with component map. */
  createEntity(initialComponents = {}) {
    const entity = new EcsEntity();
    this._entityComponents.set(entity.id, new Set());
    this._entityIndex.set(entity.id, { alive: true });
    this.totalSpawned++;

    // Add initial components
    for (const [name, data] of Object.entries(initialComponents)) {
      this.addComponent(entity.id, name, data);
    }

    return entity.id;
  }

  /** Remove an entity and all its components. */
  destroyEntity(entityId) {
    const stores = this._entityComponents.get(entityId);
    if (stores) {
      for (const storeName of stores) {
        const store = this._stores.get(storeName);
        if (store) store.remove(entityId);
      }
    }
    this._entityComponents.delete(entityId);
    this._entityIndex.delete(entityId);
  }

  /** Check if an entity exists. */
  hasEntity(entityId) {
    return this._entityIndex.has(entityId) && this._entityIndex.get(entityId).alive;
  }

  /** Mark entity as dead (keeps components for cleanup phase). */
  markDead(entityId) {
    const idx = this._entityIndex.get(entityId);
    if (idx) idx.alive = false;
  }

  // ── Component Operations ──

  /** Add a component to an entity. */
  addComponent(entityId, storeName, data) {
    const store = this.getStore(storeName);
    if (!store) return null;
    store.add(entityId, data);
    const comps = this._entityComponents.get(entityId);
    if (comps) comps.add(storeName);
    return data;
  }

  /** Get a component from an entity. */
  getComponent(entityId, storeName) {
    const store = this._stores.get(storeName);
    return store ? store.get(entityId) : undefined;
  }

  /** Check if entity has a component. */
  hasComponent(entityId, storeName) {
    const comps = this._entityComponents.get(entityId);
    return comps ? comps.has(storeName) : false;
  }

  /** Remove a component from an entity. */
  removeComponent(entityId, storeName) {
    const store = this._stores.get(storeName);
    if (store) store.remove(entityId);
    const comps = this._entityComponents.get(entityId);
    if (comps) comps.delete(storeName);
  }

  /** Update (merge) a component on an entity. */
  updateComponent(entityId, storeName, partialData) {
    const store = this._stores.get(storeName);
    if (store) store.update(entityId, partialData);
  }

  /** Get all entity IDs that have ALL of the specified components. */
  query(...storeNames) {
    const storeSet = new Set(storeNames);
    const results = [];

    // Use the smallest store as the candidate pool
    let smallestStore = null;
    let smallestSize = Infinity;
    for (const name of storeNames) {
      const store = this._stores.get(name);
      if (store && store.size < smallestSize) {
        smallestSize = store.size;
        smallestStore = store;
      }
    }

    if (!smallestStore) return results;

    for (const [entityId] of smallestStore.getAll()) {
      const comps = this._entityComponents.get(entityId);
      if (!comps) continue;
      let hasAll = true;
      for (const name of storeNames) {
        if (!comps.has(name)) { hasAll = false; break; }
      }
      if (hasAll) results.push(entityId);
    }
    return results;
  }

  /** Query entities with ALL of the specified components, returning data tuples. */
  queryData(...storeNames) {
    const ids = this.query(...storeNames);
    return ids.map(id => {
      const tuple = { entityId: id };
      for (const name of storeNames) {
        tuple[name] = this.getComponent(id, name);
      }
      return tuple;
    });
  }

  /** Count entities with a specific component. */
  count(storeName) {
    const store = this._stores.get(storeName);
    return store ? store.size : 0;
  }

  // ── System Management ──

  /** Register a system. Systems run in registration order. */
  addSystem(system) {
    this._systems.push(system);
    system.init(this);
    return system;
  }

  /** Get a registered system by name. */
  getSystem(name) {
    return this._systems.find(s => s.name === name);
  }

  // ── Lifecycle ──

  /** Main update loop — runs all enabled systems. */
  update(dt) {
    for (const system of this._systems) {
      if (system.enabled) {
        system.update(dt, this);
      }
    }
  }

  /** Clean up dead entities (call after death-check systems). */
  reapDead() {
    const toRemove = [];
    for (const [entityId, idx] of this._entityIndex) {
      if (!idx.alive) {
        toRemove.push(entityId);
      }
    }
    for (const id of toRemove) {
      this.destroyEntity(id);
    }
    return toRemove.length;
  }

  /** Reset everything. */
  clear() {
    for (const [, store] of this._stores) {
      store.clear();
    }
    this._entityComponents.clear();
    this._entityIndex.clear();
    this._systems = [];
    this.totalSpawned = 0;
  }

  /** Get total active entity count. */
  get activeEntityCount() {
    let count = 0;
    for (const [, idx] of this._entityIndex) {
      if (idx.alive) count++;
    }
    return count;
  }
}
