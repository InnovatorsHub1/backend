import { ValidationValue, ValidatorFn, ValidatorParams, ValidatorResult } from './validation.types';

export const StandardValidators: Record<string, ValidatorFn> = {
  required: (value: ValidationValue): ValidatorResult => {
    return value !== undefined && value !== null && value !== '';
  },

  string: (value: ValidationValue): ValidatorResult => {
    return typeof value === 'string';
  },

  email: (value: ValidationValue): ValidatorResult => {
    if (typeof value !== 'string') { return false; }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  },

  min: (value: ValidationValue, params?: ValidatorParams): ValidatorResult => {
    if (typeof value !== 'number' || !params?.min) { return false; }

    return value >= params.min;
  },

  max: (value: ValidationValue, params?: ValidatorParams): ValidatorResult => {
    if (typeof value !== 'number' || !params?.max) { return false; }

    return value <= params.max;
  },

  regex: (value: ValidationValue, params?: ValidatorParams): ValidatorResult => {
    if (typeof value !== 'string' || !params?.pattern) { return false; }

    return params.pattern.test(value);
  },

  number: (value: ValidationValue): ValidatorResult => {
    return typeof value === 'number' && !isNaN(value);
  },

  boolean: (value: ValidationValue): ValidatorResult => {
    return typeof value === 'boolean';
  },

  array: (value: ValidationValue): ValidatorResult => {
    return Array.isArray(value);
  },

  object: (value: ValidationValue): ValidatorResult => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  },

  password: (value: ValidationValue): ValidatorResult => {
    return typeof value === 'string' && value.length >= 8 && /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/.test(value);
  }
};