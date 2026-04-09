import { evaluate } from 'mathjs';

/**
 * GraphAnalyzer — Numerical analysis utilities for detecting
 * mathematical features of a function: zeros, extrema, inflections, asymptotes.
 */

const EPSILON = 0.05;    // Threshold for "close to zero"
const DERIV_H = 0.001;    // Step for numerical differentiation
const JUMP_THRESHOLD = 50; // Y-jump that signals an asymptote

/**
 * Safely evaluate a math expression at a given x value.
 */
function safeEval(rhs, x) {
  try {
    const val = evaluate(rhs, { x, y: 0 });
    return Number.isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

/**
 * Numerical first derivative at x.
 */
function numericalDerivative(rhs, x) {
  const yPlus = safeEval(rhs, x + DERIV_H);
  const yMinus = safeEval(rhs, x - DERIV_H);
  if (yPlus === null || yMinus === null) return null;
  return (yPlus - yMinus) / (2 * DERIV_H);
}

/**
 * Numerical second derivative at x.
 */
function numericalSecondDerivative(rhs, x) {
  const dPlus = numericalDerivative(rhs, x + DERIV_H);
  const dMinus = numericalDerivative(rhs, x - DERIV_H);
  if (dPlus === null || dMinus === null) return null;
  return (dPlus - dMinus) / (2 * DERIV_H);
}

/**
 * Analyze a function over a range and return all notable features.
 *
 * @param {string} rhs - The right-hand side expression (e.g., "sin(x)")
 * @param {number} min - Start of range
 * @param {number} max - End of range
 * @param {number} step - Step size for sampling
 * @returns {{ zeros: Array, maxima: Array, minima: Array, inflections: Array, asymptotes: Array, yRange: [number, number] }}
 */
export function analyzeFunction(rhs, min, max, step = 0.1) {
  const zeros = [];
  const maxima = [];
  const minima = [];
  const inflections = [];
  const asymptotes = [];

  let yMin = Infinity;
  let yMax = -Infinity;
  let prevY = null;
  let prevD1 = null;
  let prevD2 = null;
  let prevX = null;

  for (let x = min; x <= max; x += step) {
    const y = safeEval(rhs, x);
    if (y === null) {
      prevY = null;
      prevD1 = null;
      prevD2 = null;
      prevX = x;
      continue;
    }

    yMin = Math.min(yMin, y);
    yMax = Math.max(yMax, y);

    const d1 = numericalDerivative(rhs, x);
    const d2 = numericalSecondDerivative(rhs, x);

    // Asymptote detection: huge jump between consecutive points
    if (prevY !== null && Math.abs(y - prevY) > JUMP_THRESHOLD) {
      asymptotes.push({ x: (prevX + x) / 2, type: 'asymptote' });
    }

    // Zero crossing: sign change between consecutive y-values
    if (prevY !== null && prevY * y < 0) {
      // Linear interpolation for better zero location
      const zeroX = prevX - prevY * (x - prevX) / (y - prevY);
      zeros.push({ x: Math.round(zeroX * 1000) / 1000, y: 0 });
    }

    // Close to zero (for functions that touch zero without crossing)
    if (Math.abs(y) < EPSILON && prevY !== null && Math.abs(prevY) >= EPSILON) {
      const alreadyFound = zeros.some(z => Math.abs(z.x - x) < step * 2);
      if (!alreadyFound) {
        zeros.push({ x: Math.round(x * 1000) / 1000, y: 0 });
      }
    }

    // Extrema detection: first derivative sign change
    if (d1 !== null && prevD1 !== null) {
      if (prevD1 > EPSILON && d1 < -EPSILON) {
        // Maximum: derivative went from + to -
        maxima.push({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
      } else if (prevD1 < -EPSILON && d1 > EPSILON) {
        // Minimum: derivative went from - to +
        minima.push({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
      }
    }

    // Inflection points: second derivative sign change
    if (d2 !== null && prevD2 !== null) {
      if (prevD2 * d2 < 0 && Math.abs(prevD2) > EPSILON && Math.abs(d2) > EPSILON) {
        inflections.push({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
      }
    }

    prevY = y;
    prevD1 = d1;
    prevD2 = d2;
    prevX = x;
  }

  return {
    zeros: deduplicatePoints(zeros, step * 3),
    maxima: deduplicatePoints(maxima, step * 3),
    minima: deduplicatePoints(minima, step * 3),
    inflections: deduplicatePoints(inflections, step * 3),
    asymptotes: deduplicatePoints(asymptotes, step * 3),
    yRange: [yMin, yMax]
  };
}

/**
 * Remove duplicate points that are too close together.
 */
function deduplicatePoints(points, threshold) {
  if (points.length === 0) return points;
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const result = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].x - result[result.length - 1].x) > threshold) {
      result.push(sorted[i]);
    }
  }
  return result;
}

/**
 * Classify what type of point x is on the function.
 * Returns: 'zero' | 'maximum' | 'minimum' | 'inflection' | 'asymptote' | 'regular'
 */
export function classifyPoint(rhs, x, step = 0.1) {
  const y = safeEval(rhs, x);
  if (y === null) return 'asymptote';

  const yBefore = safeEval(rhs, x - step);
  const yAfter = safeEval(rhs, x + step);

  // Check for asymptote (big jumps)
  if (yBefore !== null && Math.abs(y - yBefore) > JUMP_THRESHOLD) return 'asymptote';
  if (yAfter !== null && Math.abs(yAfter - y) > JUMP_THRESHOLD) return 'asymptote';

  // Check for zero
  if (Math.abs(y) < EPSILON * 2) return 'zero';

  const d1 = numericalDerivative(rhs, x);
  const d2 = numericalSecondDerivative(rhs, x);

  const d1Before = numericalDerivative(rhs, x - step);

  // Check for extrema
  if (d1 !== null && d1Before !== null) {
    if (d1Before > EPSILON && d1 < -EPSILON) return 'maximum';
    if (d1Before < -EPSILON && d1 > EPSILON) return 'minimum';
  }

  // Check for inflection
  const d2Before = numericalSecondDerivative(rhs, x - step);
  if (d2 !== null && d2Before !== null && d2 * d2Before < 0) return 'inflection';

  return 'regular';
}

/**
 * Generate a natural language description of a function.
 * @param {string} expr - Full expression like "y = sin(x)"
 * @param {number} min - Range start
 * @param {number} max - Range end
 * @returns {string} A spoken description
 */
export function describeGraph(expr, min, max) {
  let rhs = expr;
  if (expr.includes('=')) {
    rhs = expr.split('=')[1].trim();
  }

  const analysis = analyzeFunction(rhs, min, max, 0.05);
  const parts = [];

  parts.push(`Analyzing ${expr} from ${min} to ${max}.`);

  // Y-range
  if (isFinite(analysis.yRange[0]) && isFinite(analysis.yRange[1])) {
    parts.push(
      `The function ranges from ${analysis.yRange[0].toFixed(2)} to ${analysis.yRange[1].toFixed(2)}.`
    );
  }

  // Zeros
  if (analysis.zeros.length === 0) {
    parts.push('The function has no zeros in this range.');
  } else if (analysis.zeros.length <= 5) {
    const zeroList = analysis.zeros.map(z => `x = ${z.x}`).join(', ');
    parts.push(`Zeros at: ${zeroList}.`);
  } else {
    parts.push(`The function has ${analysis.zeros.length} zeros in this range.`);
  }

  // Maxima
  if (analysis.maxima.length > 0) {
    if (analysis.maxima.length <= 3) {
      const maxList = analysis.maxima.map(m => `(${m.x}, ${m.y})`).join(', ');
      parts.push(`Local maxima at: ${maxList}.`);
    } else {
      parts.push(`${analysis.maxima.length} local maxima found.`);
      const globalMax = analysis.maxima.reduce((a, b) => a.y > b.y ? a : b);
      parts.push(`Highest maximum at (${globalMax.x}, ${globalMax.y}).`);
    }
  }

  // Minima
  if (analysis.minima.length > 0) {
    if (analysis.minima.length <= 3) {
      const minList = analysis.minima.map(m => `(${m.x}, ${m.y})`).join(', ');
      parts.push(`Local minima at: ${minList}.`);
    } else {
      parts.push(`${analysis.minima.length} local minima found.`);
      const globalMin = analysis.minima.reduce((a, b) => a.y < b.y ? a : b);
      parts.push(`Lowest minimum at (${globalMin.x}, ${globalMin.y}).`);
    }
  }

  // Periodicity heuristic
  if (analysis.maxima.length >= 3) {
    const gaps = [];
    for (let i = 1; i < analysis.maxima.length; i++) {
      gaps.push(analysis.maxima[i].x - analysis.maxima[i - 1].x);
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance = gaps.reduce((a, b) => a + (b - avgGap) ** 2, 0) / gaps.length;
    if (variance < 0.1) {
      parts.push(`The function appears periodic with period approximately ${avgGap.toFixed(2)}.`);
    }
  }

  // Asymptotes
  if (analysis.asymptotes.length > 0) {
    parts.push(`${analysis.asymptotes.length} vertical asymptote(s) detected.`);
  }

  // Inflection points
  if (analysis.inflections.length > 0 && analysis.inflections.length <= 5) {
    parts.push(`${analysis.inflections.length} inflection point(s).`);
  }

  return parts.join(' ');
}

/**
 * Get the y-value at a specific x for an expression.
 */
export function evalAt(expr, x) {
  let rhs = expr;
  if (expr.includes('=')) {
    const parts = expr.split('=');
    rhs = parts[1].trim();
  }
  return safeEval(rhs, x);
}

/**
 * Get the RHS of an expression.
 */
export function getRHS(expr) {
  if (expr.includes('=')) return expr.split('=')[1].trim();
  return expr;
}
