export type Precision = 'auto' | '2' | '4' | '6' | '8'
export type Notation = 'standard' | 'scientific' | 'engineering'

export interface UnitDef { id: string; name: string; symbol: string; toBase: (value: number, ctx?: ConversionContext) => number; fromBase: (value: number, ctx?: ConversionContext) => number; note?: string }
export interface ConversionCategory { id: string; name: string; units: UnitDef[] }
export interface ConversionContext { remPx: number; emPx: number }

const linear = (factor: number): Pick<UnitDef, 'toBase' | 'fromBase'> => ({ toBase: (value) => value * factor, fromBase: (value) => value / factor })
const reciprocal = (toBase: (value: number) => number, fromBase: (value: number) => number): Pick<UnitDef, 'toBase' | 'fromBase'> => ({ toBase, fromBase })

export const conversionCategories: ConversionCategory[] = [
  { id: 'length', name: 'Length', units: [
    u('nanometer', 'Nanometer', 'nm', 1e-9), u('micrometer', 'Micrometer', 'um', 1e-6), u('millimeter', 'Millimeter', 'mm', 0.001), u('centimeter', 'Centimeter', 'cm', 0.01), u('decimeter', 'Decimeter', 'dm', 0.1), u('meter', 'Meter', 'm', 1), u('decameter', 'Decameter', 'dam', 10), u('hectometer', 'Hectometer', 'hm', 100), u('kilometer', 'Kilometer', 'km', 1000), u('inch', 'Inch', 'in', 0.0254), u('foot', 'Foot', 'ft', 0.3048), u('yard', 'Yard', 'yd', 0.9144), u('mile', 'Mile', 'mi', 1609.344), u('nautical-mile', 'Nautical mile', 'nmi', 1852),
  ] },
  { id: 'area', name: 'Area', units: [u('square-mm', 'Square millimeter', 'mm2', 1e-6), u('square-cm', 'Square centimeter', 'cm2', 1e-4), u('square-meter', 'Square meter', 'm2', 1), u('square-km', 'Square kilometer', 'km2', 1e6), u('hectare', 'Hectare', 'ha', 10000), u('acre', 'Acre', 'ac', 4046.8564224), u('square-inch', 'Square inch', 'in2', 0.00064516), u('square-foot', 'Square foot', 'ft2', 0.09290304), u('square-yard', 'Square yard', 'yd2', 0.83612736), u('square-mile', 'Square mile', 'mi2', 2589988.110336)] },
  { id: 'volume', name: 'Volume', units: [u('milliliter', 'Milliliter', 'mL', 0.001), u('centiliter', 'Centiliter', 'cL', 0.01), u('deciliter', 'Deciliter', 'dL', 0.1), u('liter', 'Liter', 'L', 1), u('cubic-mm', 'Cubic millimeter', 'mm3', 1e-6), u('cubic-cm', 'Cubic centimeter', 'cm3', 0.001), u('cubic-meter', 'Cubic meter', 'm3', 1000), u('us-tsp', 'US teaspoon', 'tsp US', 0.00492892159375), u('us-tbsp', 'US tablespoon', 'tbsp US', 0.01478676478125), u('us-fl-oz', 'US fluid ounce', 'fl oz US', 0.0295735295625), u('us-cup', 'US cup', 'cup US', 0.2365882365), u('us-pint', 'US pint', 'pt US', 0.473176473), u('us-quart', 'US quart', 'qt US', 0.946352946), u('us-gallon', 'US gallon', 'gal US', 3.785411784), u('imp-fl-oz', 'Imperial fluid ounce', 'fl oz imp', 0.0284130625), u('imp-pint', 'Imperial pint', 'pt imp', 0.56826125), u('imp-quart', 'Imperial quart', 'qt imp', 1.1365225), u('imp-gallon', 'Imperial gallon', 'gal imp', 4.54609)] },
  { id: 'mass', name: 'Mass / Weight', units: [u('microgram', 'Microgram', 'ug', 1e-9), u('milligram', 'Milligram', 'mg', 1e-6), u('gram', 'Gram', 'g', 0.001), u('kilogram', 'Kilogram', 'kg', 1), u('metric-ton', 'Metric ton', 't', 1000), u('ounce', 'Ounce', 'oz', 0.028349523125), u('pound', 'Pound', 'lb', 0.45359237), u('stone', 'Stone', 'st', 6.35029318), u('us-ton', 'US ton', 'ton US', 907.18474), u('imperial-ton', 'Imperial ton', 'ton imp', 1016.0469088)] },
  { id: 'temperature', name: 'Temperature', units: [affine('celsius', 'Celsius', 'C', (v) => v + 273.15, (v) => v - 273.15), affine('fahrenheit', 'Fahrenheit', 'F', (v) => (v - 32) * 5 / 9 + 273.15, (v) => (v - 273.15) * 9 / 5 + 32), affine('kelvin', 'Kelvin', 'K', (v) => v, (v) => v)] },
  { id: 'speed', name: 'Speed', units: [u('mps', 'Meter per second', 'm/s', 1), u('kmh', 'Kilometer per hour', 'km/h', 1 / 3.6), u('mph', 'Mile per hour', 'mph', 0.44704), u('fps', 'Foot per second', 'ft/s', 0.3048), u('knot', 'Knot', 'kn', 0.514444444444), u('mach', 'Mach approx', 'Mach', 343, 'Approx at sea level, 20 C')] },
  { id: 'time', name: 'Time', units: [u('nanosecond', 'Nanosecond', 'ns', 1e-9), u('microsecond', 'Microsecond', 'us', 1e-6), u('millisecond', 'Millisecond', 'ms', 0.001), u('second', 'Second', 's', 1), u('minute', 'Minute', 'min', 60), u('hour', 'Hour', 'h', 3600), u('day', 'Day', 'd', 86400), u('week', 'Week', 'wk', 604800), u('month', 'Month approx', 'mo', 2629800, 'Approx: 30.4375 days'), u('year', 'Year approx', 'yr', 31557600, 'Approx: 365.25 days')] },
  { id: 'data', name: 'Data / Storage', units: [u('bit', 'Bit', 'bit', 0.125), u('kilobit', 'Kilobit', 'kb', 125), u('megabit', 'Megabit', 'Mb', 125000), u('gigabit', 'Gigabit', 'Gb', 125000000), u('byte', 'Byte', 'B', 1), u('kb', 'Kilobyte', 'KB', 1000), u('mb', 'Megabyte', 'MB', 1e6), u('gb', 'Gigabyte', 'GB', 1e9), u('tb', 'Terabyte', 'TB', 1e12), u('pb', 'Petabyte', 'PB', 1e15), u('kib', 'Kibibyte', 'KiB', 1024), u('mib', 'Mebibyte', 'MiB', 1048576), u('gib', 'Gibibyte', 'GiB', 1073741824), u('tib', 'Tebibyte', 'TiB', 1099511627776), u('pib', 'Pebibyte', 'PiB', 1125899906842624)] },
  { id: 'data-rate', name: 'Data Transfer Rate', units: [u('bps', 'Bit per second', 'bps', 0.125), u('kbps', 'Kilobit per second', 'Kbps', 125), u('mbps', 'Megabit per second', 'Mbps', 125000), u('gbps', 'Gigabit per second', 'Gbps', 125000000), u('bs', 'Byte per second', 'B/s', 1), u('kbs', 'Kilobyte per second', 'KB/s', 1000), u('mbs', 'Megabyte per second', 'MB/s', 1e6), u('gbs', 'Gigabyte per second', 'GB/s', 1e9)] },
  { id: 'pressure', name: 'Pressure', units: [u('pascal', 'Pascal', 'Pa', 1), u('kpa', 'Kilopascal', 'kPa', 1000), u('mpa', 'Megapascal', 'MPa', 1e6), u('bar', 'Bar', 'bar', 100000), u('millibar', 'Millibar', 'mbar', 100), u('atm', 'Atmosphere', 'atm', 101325), u('psi', 'PSI', 'psi', 6894.757293168), u('mmhg', 'Millimeter mercury', 'mmHg', 133.322387415), u('torr', 'Torr', 'Torr', 133.322368421)] },
  { id: 'energy', name: 'Energy', units: [u('joule', 'Joule', 'J', 1), u('kilojoule', 'Kilojoule', 'kJ', 1000), u('calorie', 'Calorie', 'cal', 4.184), u('kilocalorie', 'Kilocalorie', 'kcal', 4184), u('wh', 'Watt-hour', 'Wh', 3600), u('kwh', 'Kilowatt-hour', 'kWh', 3600000), u('btu', 'BTU', 'BTU', 1055.05585262), u('electronvolt', 'Electronvolt', 'eV', 1.602176634e-19)] },
  { id: 'power', name: 'Power', units: [u('watt', 'Watt', 'W', 1), u('kilowatt', 'Kilowatt', 'kW', 1000), u('megawatt', 'Megawatt', 'MW', 1e6), u('mechanical-hp', 'Horsepower mechanical', 'hp', 745.699871582), u('metric-hp', 'Horsepower metric', 'PS', 735.49875)] },
  { id: 'force', name: 'Force', units: [u('newton', 'Newton', 'N', 1), u('kilonewton', 'Kilonewton', 'kN', 1000), u('dyne', 'Dyne', 'dyn', 1e-5), u('pound-force', 'Pound-force', 'lbf', 4.4482216152605), u('kilogram-force', 'Kilogram-force', 'kgf', 9.80665)] },
  { id: 'torque', name: 'Torque', units: [u('nm', 'Newton meter', 'N.m', 1), u('knm', 'Kilonewton meter', 'kN.m', 1000), u('lb-ft', 'Pound-foot', 'lb-ft', 1.3558179483314), u('lb-in', 'Pound-inch', 'lb-in', 0.11298482902762), u('kgf-m', 'Kilogram-force meter', 'kgf.m', 9.80665)] },
  { id: 'angle', name: 'Angle', units: [u('degree', 'Degree', 'deg', Math.PI / 180), u('radian', 'Radian', 'rad', 1), u('gradian', 'Gradian', 'gon', Math.PI / 200), u('arcminute', 'Arcminute', 'arcmin', Math.PI / 10800), u('arcsecond', 'Arcsecond', 'arcsec', Math.PI / 648000), u('revolution', 'Revolution', 'rev', Math.PI * 2)] },
  { id: 'frequency', name: 'Frequency', units: [u('hz', 'Hertz', 'Hz', 1), u('khz', 'Kilohertz', 'kHz', 1000), u('mhz', 'Megahertz', 'MHz', 1e6), u('ghz', 'Gigahertz', 'GHz', 1e9), u('rpm', 'RPM', 'rpm', 1 / 60)] },
  { id: 'fuel', name: 'Fuel Economy', units: [recipUnit('km-l', 'Kilometer per liter', 'km/L', (v) => v, (v) => v), recipUnit('l-100km', 'Liter per 100 km', 'L/100km', (v) => 100 / v, (v) => 100 / v), recipUnit('mpg-us', 'MPG US', 'mpg US', (v) => v * 0.425143707, (v) => v / 0.425143707), recipUnit('mpg-imp', 'MPG Imperial', 'mpg imp', (v) => v * 0.35400619, (v) => v / 0.35400619)] },
  { id: 'typography', name: 'Typography / Web', units: [ctxUnit('px', 'Pixel', 'px', (v) => v, (v) => v), ctxUnit('rem', 'Root em', 'rem', (v, c) => v * c.remPx, (v, c) => v / c.remPx, 'Uses configured root pixel size'), ctxUnit('em', 'Em', 'em', (v, c) => v * c.emPx, (v, c) => v / c.emPx, 'Uses configured element pixel size'), u('pt', 'Point', 'pt', 96 / 72), u('pc', 'Pica', 'pc', 16)] },
]

export function convertAll(categoryId: string, value: number, unitId: string, ctx: ConversionContext): Array<UnitDef & { value: number }> {
  const category = conversionCategories.find((item) => item.id === categoryId) ?? conversionCategories[0]!
  const source = category.units.find((unit) => unit.id === unitId) ?? category.units[0]!
  const base = source.toBase(value, ctx)
  return category.units.map((unit) => ({ ...unit, value: unit.fromBase(base, ctx) }))
}

export function formatNumber(value: number, locale: string, precision: Precision = 'auto', notation: Notation = 'standard'): string {
  if (!Number.isFinite(value)) return 'Invalid'
  const abs = Math.abs(value)
  const useScientific = notation === 'scientific' || (notation === 'standard' && abs > 0 && (abs >= 1e9 || abs < 1e-6))
  const digits = precision === 'auto' ? (useScientific ? 6 : 8) : Number(precision)
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits, notation: notation === 'engineering' ? 'engineering' : useScientific ? 'scientific' : 'standard' }).format(value)
}

function u(id: string, name: string, symbol: string, factor: number, note?: string): UnitDef { return { id, name, symbol, ...linear(factor), ...(note ? { note } : {}) } }
function affine(id: string, name: string, symbol: string, toBase: (value: number) => number, fromBase: (value: number) => number): UnitDef { return { id, name, symbol, toBase, fromBase } }
function recipUnit(id: string, name: string, symbol: string, toBase: (value: number) => number, fromBase: (value: number) => number): UnitDef { return { id, name, symbol, ...reciprocal(toBase, fromBase) } }
function ctxUnit(id: string, name: string, symbol: string, toBase: (value: number, ctx: ConversionContext) => number, fromBase: (value: number, ctx: ConversionContext) => number, note?: string): UnitDef {
  const fallback = { remPx: 16, emPx: 16 }
  return { id, name, symbol, toBase: (value, ctx = fallback) => toBase(value, ctx), fromBase: (value, ctx = fallback) => fromBase(value, ctx), ...(note ? { note } : {}) }
}
