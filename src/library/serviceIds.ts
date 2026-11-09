// Service IDs (PY3): every service's ID is fixed (type prefix SV + a number), never its name. Never reuse or renumber an ID.
export const SV = { drink: 'SV1', meal: 'SV2', bed: 'SV3', bath: 'SV4', clinic: 'SV5' } as const;
