// Fresh ids. One rule for every id code makes from a key: the key itself, else the key with _2, _3 … until it is free.
// A leaf module: it imports nothing, so any file can use it.

/** `key`, or `key_2`, `key_3` … the first one not in `taken`; it is added to `taken` */
export function freshId(key: string, taken: Set<string>): string {
  let id = key;
  for (let n = 2; taken.has(id); n++) id = `${key}_${n}`;
  taken.add(id);
  return id;
}
