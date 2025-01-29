import { ValidatorFn } from './validation.types';

export const StandardValidators: Record<string, ValidatorFn> = {
  required: (value: unknown) => value !== undefined && value !== null && value !== '',
  string: (value: unknown) => typeof value === 'string',
  email: (value: unknown) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  min: (value: unknown, min: unknown) => typeof value === 'number' && typeof min === 'number' && value >= min,
  max: (value: unknown, max: unknown) => typeof value === 'number' && typeof max === 'number' && value <= max,
  regex: (value: unknown, params: unknown) => typeof value === 'string' && params instanceof RegExp && params.test(value),
  number: (value: unknown) => typeof value === 'number' && !isNaN(value),
  boolean: (value: unknown) => typeof value === 'boolean',
  array: (value: unknown) => Array.isArray(value),
  object: (value: unknown) => typeof value === 'object' && value !== null && !Array.isArray(value),
};