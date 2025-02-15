import { injectable } from 'inversify';

import { WinstonLogger } from '../logger/winston.logger';

import {
  IValidationService,
  ValidationSchema,
  ValidationResult,
  ValidationRule,
  ValidatorFn,
  ValidationError,
  AsyncValidatorFn,
  ValidationValue,
} from './validation.types';
import { StandardValidators } from './validators';

/**
 * Service for validating data against defined schemas
 * @implements {IValidationService}
 */
@injectable()
export class ValidationService implements IValidationService {
  private validators: Record<string, ValidatorFn>;
  private asyncValidators: Record<string, AsyncValidatorFn>;
  private logger: WinstonLogger;

  constructor(logger?: WinstonLogger) {
    this.validators = { ...StandardValidators };
    this.asyncValidators = {};
    this.logger = logger || new WinstonLogger('ValidationService');
  }

  public addRule(name: string, validator: ValidatorFn): void {
    this.validators[name] = validator;
  }

  public addAsyncRule(name: string, validator: AsyncValidatorFn): void {
    this.asyncValidators[name] = validator;
  }

  /**
   * Validates data against a schema
   * @param data - The data to validate
   * @param schema - The validation schema
   * @returns ValidationResult containing validation status and errors
   */
  public validate(data: ValidationValue, schema: ValidationSchema): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!this.validators[schema.type](data)) {
      errors.push({
        field: '',
        message: `Invalid type. Expected ${schema.type}`,
      });
      
      return { isValid: false, errors };
    }

    if (schema.rules) {
      const fieldResult = this.validateField(data, schema.rules);
      errors.push(...fieldResult.errors);
    }

    if (schema.fields && this.validators.object(data)) {
      const objectData = data as Record<string, ValidationValue>;
      Object.entries(schema.fields).forEach(([field, fieldSchema]) => {
        const fieldValue = objectData[field];
        const fieldResult = this.validate(fieldValue, fieldSchema);
        
        fieldResult.errors.forEach((error) => {
          errors.push({
            field: field + (error.field ? `.${error.field}` : ''),
            message: error.message,
          });
        });
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
  public validateField(value: ValidationValue, rules: ValidationRule[]): ValidationResult {
    const errors: ValidationError[] = [];

    for (const rule of rules) {
      const validator = this.validators[rule.name];
      if (!validator) {
        this.logger.warn(`Validator ${rule.name} not found`);
        continue;
      }

      const isValid = validator(value, rule.params);
      if (!isValid) {
        errors.push({
          field: '',
          message: rule.message || `Validation failed for rule: ${rule.name}`,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
  public async validateAsync(data: ValidationValue, schema: ValidationSchema): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    if (schema.asyncRules) {
      for (const rule of schema.asyncRules) {
        const validator = this.asyncValidators[rule.name];
        if (!validator) {
          this.logger.warn(`Async validator ${rule.name} not found`);
          continue;
        }
        
        const isValid = await validator(data, rule.params);
        if (!isValid) {
          errors.push({
            field: '',
            message: rule.message || `Async validation failed for rule: ${rule.name}`,
          });
        }
      }
    }
  
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
  
}
