/** 支持的量纲与到基准单位的换算系数 */
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

/** 找出某个单位属于哪个量纲，找不到返回 null。温度单位不在 FACTORS 里，单独判断。 */
export function dimensionOf(unit: string): string | null {
  if (TEMPS.includes(unit)) return 'temperature';
  for (const [dim, table] of Object.entries(FACTORS)) {
    if (unit in table) return dim;
  }
  return null;
}

/**
 * 单位换算。温度不走系数表，单独处理。
 * @throws 单位未知或两个单位不同量纲时抛错
 */
export function convert(value: number, from: string, to: string): ConvertResult {
  if (!Number.isFinite(value)) throw new Error(`value 必须是有限数字: ${value}`);

  const temp = convertTemperature(value, from, to);
  if (temp !== null) return { value: cleanFloat(temp), from, to, dimension: 'temperature' };

  const dFrom = dimensionOf(from);
  const dTo = dimensionOf(to);
  if (!dFrom) throw new Error(`未知单位: ${from}`);
  if (!dTo) throw new Error(`未知单位: ${to}`);
  if (dFrom !== dTo) throw new Error(`量纲不匹配: ${from} 是 ${dFrom}，${to} 是 ${dTo}`);

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

/** 温度换算，非温度单位返回 null。 */
function convertTemperature(value: number, from: string, to: string): number | null {
  if (!TEMPS.includes(from) || !TEMPS.includes(to)) return null;
  const celsius = from === 'C' ? value : from === 'F' ? (value - 32) / 1.8 : value - 273.15;
  return to === 'C' ? celsius : to === 'F' ? celsius * 1.8 + 32 : celsius + 273.15;
}

/** 列出所有支持的单位。 */
export function supportedUnits(): string[] {
  return [...Object.values(FACTORS).flatMap((t) => Object.keys(t)), 'C', 'F', 'K'];
}
