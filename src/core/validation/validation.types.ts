// Base types for validation values
export type ValidationValue = string | number | boolean | object | unknown[] | null | undefined ;
export type ValidatorResult = boolean;

// Params interface for validators
export interface ValidatorParams {
  min?: number;
  max?: number;
  pattern?: RegExp;
  email?: boolean;
  required?: boolean;
  [key: string]: unknown;  // Allow for custom params while maintaining type safety
}

export type ValidatorFn = (value: ValidationValue, params?: ValidatorParams) => boolean;
export type AsyncValidatorFn = (value: ValidationValue, params?: ValidatorParams) => Promise<boolean>;


export interface ValidationError {
  field: string;
  message: string;
}

export type ValidationResult = {
  isValid: boolean;
  errors: ValidationError[];
};

export interface ValidationRule {
  name: string;
  params?: ValidatorParams;
  message?: string;
}

export interface AsyncValidationRule {
  name: string;
  params?: ValidatorParams;
  message?: string;
}

export interface ValidationSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  rules?: ValidationRule[];
  asyncRules?: AsyncValidationRule[];
  fields?: Record<string, ValidationSchema>;
  messages?: Record<string, string>;
}

export interface IValidationService {
  validate<T>(data: ValidationValue, schema: ValidationSchema): ValidationResult;
  validateAsync<T>(data: ValidationValue, schema: ValidationSchema): Promise<ValidationResult>;
  addRule(name: string, validator: ValidatorFn): void;
  validateField<T>(value: ValidationValue, rules: ValidationRule[]): ValidationResult;
}