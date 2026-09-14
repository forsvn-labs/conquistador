import type { Adapter, AdapterManifest, Catalog } from "./contracts.ts";
import { deepFreeze } from "./canonical.ts";
import { invariant, validateAdapterManifest } from "./validate.ts";

export function defineAdapter(
  manifest: AdapterManifest,
  handlers: Adapter["handlers"],
  catalog: Catalog,
): Readonly<Adapter> {
  validateAdapterManifest(manifest, catalog);
  const declared = [...manifest.operationIds].sort();
  const implemented = Object.keys(handlers).sort();
  invariant(JSON.stringify(declared) === JSON.stringify(implemented), "adapter handlers must exactly match declared operations");
  return deepFreeze({ manifest: structuredClone(manifest), handlers: { ...handlers } });
}
