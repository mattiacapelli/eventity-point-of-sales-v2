export const MODULE_DEPENDENCIES: Record<string, string[]> = {
  pos:       [],
  kitchen:   ["pos"],
  payments:  ["pos"],
  inventory: ["pos"],
  tables:    ["pos"],
  analytics: ["pos"],
  totem:     ["pos"],
  events:    ["pos"],
};
