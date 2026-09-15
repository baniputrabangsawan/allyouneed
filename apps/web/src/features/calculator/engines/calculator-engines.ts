export type AngleMode = 'deg' | 'rad'

const operators: Record<string, { p: number; r?: true; f: (a: number, b: number) => number }> = {
  '+': { p: 1, f: (a, b) => a + b }, '-': { p: 1, f: (a, b) => a - b }, '*': { p: 2, f: (a, b) => a * b }, '/': { p: 2, f: (a, b) => a / b }, '%': { p: 2, f: (a, b) => a % b }, '^': { p: 3, r: true, f: (a, b) => a ** b },
}

export function evaluateExpression(input: string, angleMode: AngleMode = 'rad'): number {
  const values: number[] = []
  const ops: string[] = []
  const tokens = tokenize(input.replace(/×/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi').replace(/√/g, 'sqrt'))
  const apply = () => {
    const op = ops.pop()
    if (!op) return
    if (op in functions) values.push(functions[op]!(values.pop() ?? NaN, angleMode))
    else {
      const b = values.pop() ?? NaN
      const a = values.pop() ?? NaN
      values.push(operators[op]!.f(a, b))
    }
  }
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token === undefined) continue
    if (typeof token === 'number') values.push(token)
    else if (token === 'pi') values.push(Math.PI)
    else if (token === 'e') values.push(Math.E)
    else if (token in functions) ops.push(token)
    else if (token === '(') ops.push(token)
    else if (token === ')') { while (ops.length && ops.at(-1) !== '(') apply(); if (ops.pop() !== '(') throw new Error('Mismatched parentheses.'); if (ops.at(-1) && ops.at(-1)! in functions) apply() }
    else if (token === '!') values.push(factorial(values.pop() ?? NaN))
    else if (token === '%' && (tokens[index + 1] === undefined || ['+', '-', '*', '/', '^', ')'].includes(String(tokens[index + 1])))) values.push((values.pop() ?? NaN) / 100)
    else if (token in operators) { while (ops.length && ops.at(-1)! in operators && (operators[ops.at(-1)!]!.p > operators[token]!.p || (!operators[token]!.r && operators[ops.at(-1)!]!.p === operators[token]!.p))) apply(); ops.push(token) }
    else if (token === 'mod') { while (ops.length && ops.at(-1)! in operators && operators[ops.at(-1)!]!.p >= operators['%']!.p) apply(); ops.push('%') }
  }
  while (ops.length) { if (ops.at(-1) === '(') throw new Error('Mismatched parentheses.'); apply() }
  const result = values[0]
  if (values.length !== 1 || result === undefined || !Number.isFinite(result)) throw new Error('Invalid expression or mathematical domain.')
  return result
}

const functions: Record<string, (value: number, mode: AngleMode) => number> = {
  sin: (v, m) => Math.sin(angle(v, m)), cos: (v, m) => Math.cos(angle(v, m)), tan: (v, m) => Math.tan(angle(v, m)), asin: (v, m) => invAngle(Math.asin(v), m), acos: (v, m) => invAngle(Math.acos(v), m), atan: (v, m) => invAngle(Math.atan(v), m), sinh: (v) => Math.sinh(v), cosh: (v) => Math.cosh(v), tanh: (v) => Math.tanh(v), log: (v) => Math.log10(v), log2: (v) => Math.log2(v), ln: (v) => Math.log(v), exp: (v) => Math.exp(v), sqrt: (v) => Math.sqrt(v), cbrt: (v) => Math.cbrt(v), abs: (v) => Math.abs(v), inv: (v) => 1 / v,
}

export function calculatePercent(mode: string, a: number, b: number): number {
  if (mode === 'of') return a * b / 100
  if (mode === 'what') return a / b * 100
  if (mode === 'change') return (b - a) / a * 100
  if (mode === 'add') return a * (1 + b / 100)
  if (mode === 'discount') return a * (1 - b / 100)
  return NaN
}

export function loanPayment(principal: number, annualRate: number, months: number) {
  const r = annualRate / 100 / 12
  const monthly = r === 0 ? principal / months : principal * r / (1 - (1 + r) ** -months)
  return { monthly, total: monthly * months, interest: monthly * months - principal }
}

export function compoundInterest(principal: number, annualRate: number, years: number, times = 12, contribution = 0) {
  const periods = years * times
  const r = annualRate / 100 / times
  const contributionValue = r === 0 ? contribution * periods : contribution * (((1 + r) ** periods - 1) / r)
  const finalValue = principal * (1 + r) ** periods + contributionValue
  const contributed = principal + contribution * periods
  return { finalValue, contributed, interest: finalValue - contributed }
}

export function statistics(values: number[], sample = true) {
  const sorted = [...values].sort((a, b) => a - b)
  const count = values.length
  const sum = values.reduce((a, b) => a + b, 0)
  const mean = sum / count
  const median = count % 2 ? sorted[(count - 1) / 2]! : (sorted[count / 2 - 1]! + sorted[count / 2]!) / 2
  const frequencies = new Map<number, number>(); for (const value of values) frequencies.set(value, (frequencies.get(value) ?? 0) + 1)
  const maxFreq = Math.max(...frequencies.values())
  const mode = [...frequencies].filter(([, n]) => n === maxFreq && n > 1).map(([value]) => value)
  const variance = values.reduce((sumSq, value) => sumSq + (value - mean) ** 2, 0) / Math.max(1, count - (sample ? 1 : 0))
  return { count, sum, min: sorted[0] ?? NaN, max: sorted.at(-1) ?? NaN, range: (sorted.at(-1) ?? NaN) - (sorted[0] ?? NaN), mean, median, mode, variance, stddev: Math.sqrt(variance) }
}

export function bases(input: string) {
  const decimal = input.trim().match(/^0x/i) ? Number.parseInt(input, 16) : input.trim().match(/^0b/i) ? Number.parseInt(input.slice(2), 2) : Number.parseInt(input, 10)
  if (!Number.isSafeInteger(decimal)) throw new Error('Enter a safe integer.')
  return { binary: decimal.toString(2), octal: decimal.toString(8), decimal: String(decimal), hex: decimal.toString(16).toUpperCase() }
}

export function bitwise(op: string, a: number, b: number, bits = 32): number {
  const mask = bits >= 32 ? 0xffffffff : 2 ** bits - 1
  if (op === 'AND') return (a & b) >>> 0
  if (op === 'OR') return (a | b) >>> 0
  if (op === 'XOR') return (a ^ b) >>> 0
  if (op === 'NOT') return (~a & mask) >>> 0
  if (op === 'LSH') return (a << b) >>> 0
  if (op === 'RSH') return a >>> b
  return NaN
}

export function simplifyFraction(n: number, d: number) {
  const g = gcd(Math.abs(n), Math.abs(d)) || 1
  const sign = d < 0 ? -1 : 1
  return { n: sign * n / g, d: sign * d / g }
}

function tokenize(input: string): Array<number | string> {
  const tokens: Array<number | string> = []
  let i = 0
  while (i < input.length) {
    const rest = input.slice(i)
    if (/^\s/.test(rest)) { i += 1; continue }
    const num = rest.match(/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i)
    if (num && (tokens.length === 0 || ['(', '+', '-', '*', '/', '%', '^'].includes(String(tokens.at(-1))))) { tokens.push(Number(num[0])); i += num[0].length; continue }
    const posNum = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i)
    if (posNum) { tokens.push(Number(posNum[0])); i += posNum[0].length; continue }
    const word = rest.match(/^[a-z][a-z0-9]*/i)
    if (word) { tokens.push(word[0].toLowerCase()); i += word[0].length; continue }
    if ('+-*/%^()!'.includes(input[i]!)) { tokens.push(input[i]!); i += 1; continue }
    throw new Error(`Unexpected token: ${input[i]}`)
  }
  return tokens
}
function angle(v: number, mode: AngleMode) { return mode === 'deg' ? v * Math.PI / 180 : v }
function invAngle(v: number, mode: AngleMode) { return mode === 'deg' ? v * 180 / Math.PI : v }
function factorial(value: number): number { if (!Number.isInteger(value) || value < 0 || value > 170) return NaN; let out = 1; for (let i = 2; i <= value; i += 1) out *= i; return out }
function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a }
