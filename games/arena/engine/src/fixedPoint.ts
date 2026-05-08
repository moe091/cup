import type { Fixed } from './types.js';

export const DEFAULT_SCALE = 1024;

export const toFixed = (value: number, scale: number): Fixed => {
  return Math.round(value * scale);
};

export const fromFixed = (value: Fixed, scale: number): number => {
  return value / scale;
};

export const clamp = (value: number, min: number, max: number): number => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

export const sign = (value: number): -1 | 0 | 1 => {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
};
