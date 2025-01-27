export interface IValidationService {
  validate<T>(data: T, schema: ValidationSchema): ValidationResult;
  validateAsync<T>(data: T, schema: ValidationSchema): Promise<ValidationResult>;
  addRule(name: string, validator: ValidatorFn): void;
  validateField<T>(value: T, rules: ValidationRule[]): ValidationResult;
}

export interface ValidationSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  rules?: ValidationRule[];
  asyncRules?: AsyncValidationRule[];
  fields?: Record<string, ValidationSchema>;
  messages?: Record<string, string>;
}

export interface ValidationRule {
  name: string;
  params?: unknown;
  message?: string;
}

export interface AsyncValidationRule {
  name: string;
  params?: unknown;
  message?: string;
}

export type ValidationResult = {
  isValid: boolean;
  errors: ValidationError[];
};

export interface ValidationError {
  field: string;
  message: string;
}

export type ValidatorFn = (value: unknown, ...params: unknown[]) => boolean;
export type AsyncValidatorFn = (value: unknown, params?: unknown) => Promise<boolean>;