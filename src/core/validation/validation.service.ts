import { injectable } from 'inversify';
import { WinstonLogger } from '../logger/winston.logger';
import {
  IValidationService,
  ValidationSchema,
  ValidationResult,
  ValidationRule,
  ValidatorFn,
  ValidationError,
} from './validation.types';
import { StandardValidators } from './validators';

@injectable()
export class ValidationService implements IValidationService {
  private validators: Record<string, ValidatorFn>;
  private logger: WinstonLogger;

  constructor() {
    this.validators = { ...StandardValidators };
    this.logger = new WinstonLogger('ValidationService');
  }

  public addRule(name: string, validator: ValidatorFn): void {
    this.validators[name] = validator;
  }

  public validate<T>(data: T, schema: ValidationSchema): ValidationResult {
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

    if (schema.fields && typeof data === 'object') {
      Object.entries(schema.fields).forEach(([field, fieldSchema]) => {
        const fieldValue = (data as Record<string, unknown>)[field];
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
  public validateField<T>(value: T, rules: ValidationRule[]): ValidationResult {
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
}
