/** Supported dimensions and their conversion factors to a base unit. */
const FACTORS: Record<string, Record<string, number>> = {
  length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, ft: 0.3048, in: 0.0254 },
  mass: { g: 1, kg: 1000, mg: 0.001, lb: 453.59237, oz: 28.349523125 },
  time: { s: 1, min: 60, h: 3600, d: 86400, ms: 0.001 },
  volume: { l: 1, ml: 0.001, m3: 1000, gal: 3.785411784, qt: 0.946352946, cup: 0.2365882365, floz: 0.0295735295625 },
};

const TEMPS = ['C', 'F', 'K'];

export interface ConvertResult {
  value: number;
  from: string;
  to: string;
  dimension: string;
}

/** Finds the dimension a unit belongs to, or null if unknown. Temperature units aren't in FACTORS, so they're checked separately. */
export function dimensionOf(unit: string): string | null {
  if (TEMPS.includes(unit)) return 'temperature';
  for (const [dim, table] of Object.entries(FACTORS)) {
    if (unit in table) return dim;
  }
  return null;
}

/**
 * Converts a value between units. Temperature bypasses the factor table and
 * is handled separately since it isn't a linear scale from zero.
 * @throws if either unit is unknown or the two units belong to different dimensions
 */
export function convert(value: number, from: string, to: string): ConvertResult {
  if (!Number.isFinite(value)) throw new Error(`value must be finite: ${value}`);

  const temp = convertTemperature(value, from, to);
  if (temp !== null) return { value: cleanFloat(temp), from, to, dimension: 'temperature' };

  const dFrom = dimensionOf(from);
  const dTo = dimensionOf(to);
  if (!dFrom) throw new Error(`unknown unit: ${from}`);
  if (!dTo) throw new Error(`unknown unit: ${to}`);
  if (dFrom !== dTo) throw new Error(`dimension mismatch: ${from} is ${dFrom}, ${to} is ${dTo}`);

  const table = FACTORS[dFrom];
  return { value: cleanFloat((value * table[from]) / table[to]), from, to, dimension: dFrom };
}

/**
 * Chained float division/multiplication (e.g. 1609.344 / 0.3048) routinely lands
 * a couple ULPs off a round number. Rounding to 12 significant digits clears
 * that binary-floating-point noise while staying well inside a double's ~15-17
 * digits of real precision.
 */
function cleanFloat(value: number): number {
  if (!Number.isFinite(value) || value === 0) return value;
  return Number(value.toPrecision(12));
}

/** Converts a temperature value; returns null if either unit isn't a temperature unit. */
function convertTemperature(value: number, from: string, to: string): number | null {
  if (!TEMPS.includes(from) || !TEMPS.includes(to)) return null;
  const celsius = from === 'C' ? value : from === 'F' ? (value - 32) / 1.8 : value - 273.15;
  return to === 'C' ? celsius : to === 'F' ? celsius * 1.8 + 32 : celsius + 273.15;
}

/** Lists all supported units. */
export function supportedUnits(): string[] {
  return [...Object.values(FACTORS).flatMap((t) => Object.keys(t)), 'C', 'F', 'K'];
}
