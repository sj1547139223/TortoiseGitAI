import { createRuntime as createSharedRuntime } from '../droid/runtime.js';
import * as store from './store.js';

/** Codex runtime: the same Git policy as DSH/Factory, with Codex-owned state. */
export function createRuntime(options = {}) {
  return createSharedRuntime({ ...options, store });
}