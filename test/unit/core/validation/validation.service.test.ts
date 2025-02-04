import { ValidationService } from '@gateway/core/validation/validation.service';
import { ValidationSchema, AsyncValidatorFn } from '@gateway/core/validation/validation.types';
import { WinstonLogger } from '@gateway/core/logger/winston.logger';

jest.mock('@gateway/core/logger/winston.logger', () => {
  return {
    WinstonLogger: jest.fn().mockImplementation(() => ({
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
  };
});

describe('ValidationService', () => {
  let validationService: ValidationService;
  let mockLogger: jest.Mocked<WinstonLogger>;

  beforeEach(() => {
    mockLogger = new WinstonLogger('ValidationService') as jest.Mocked<WinstonLogger>;
    validationService = new ValidationService(mockLogger);
  });

  describe('Basic Validation', () => {
    it('should validate string type correctly', () => {
      const schema: ValidationSchema = {
        type: 'string',
        rules: [{ name: 'required' }],
      };
      const result = validationService.validate('test', schema);
      expect(result.isValid).toBe(true);
    });

    it('should fail validation for incorrect type', () => {
      const schema: ValidationSchema = {
        type: 'string',
        rules: [{ name: 'required' }],
      };
      const result = validationService.validate(123, schema);
      expect(result.isValid).toBe(false);
    });

    it('should log warning and continue when sync validator is not found', () => {
      const schema: ValidationSchema = {
        type: 'string',
        rules: [{ name: 'nonexistentValidator' }],
      };
    
      const result = validationService.validate('test-value', schema);
    
      expect(result.isValid).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith('Validator nonexistentValidator not found');
    });
    
  });

  describe('Complex Validation', () => {
    it('should validate nested objects', () => {
      const schema: ValidationSchema = {
        type: 'object',
        fields: {
          user: {
            type: 'object',
            fields: {
              email: { type: 'string', rules: [{ name: 'email' }] },
              age: { type: 'number', rules: [{ name: 'min', params: { min: 18 } }] },
            },
          },
        },
      };

      const data = {
        user: {
          email: 'test@example.com',
          age: 25,
        },
      };

      const result = validationService.validate(data, schema);
      expect(result.isValid).toBe(true);
    });
    it('should handle invalid nested object data', () => {
      const schema: ValidationSchema = {
        type: 'object',
        fields: {
          email: { type: 'string', rules: [{ name: 'email' }] },
        },
      };
      const result = validationService.validate({ email: 123 }, schema);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Custom Rules', () => {
    it('should allow adding and using custom validation rules', () => {
      const customRule = (value: unknown) => typeof value === 'string' && value.startsWith('custom');
      validationService.addRule('customPrefix', customRule);

      const schema: ValidationSchema = {
        type: 'string',
        rules: [{ name: 'customPrefix' }],
      };

      const result = validationService.validate('custom-value', schema);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Async Validation', () => {
    it('should pass async validation when rule succeeds', async () => {
      const mockAsyncValidator: AsyncValidatorFn = async (value: unknown, ...params: unknown[]) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(true);
          }, 100);
        });
      };
      
      validationService.addAsyncRule('mockAsync', mockAsyncValidator);

      const schema: ValidationSchema = {
        type: 'string',
        rules: [{ name: 'required' }],
        asyncRules: [{ name: 'mockAsync' }],
      };

      const result = await validationService.validateAsync('test-value', schema);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail async validation when rule fails', async () => {
      const mockAsyncValidator: AsyncValidatorFn = async (value: unknown) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(false);
          }, 100);
        });
      };
      
      validationService.addAsyncRule('mockAsync', mockAsyncValidator);

      const schema: ValidationSchema = {
        type: 'string',
        rules: [{ name: 'required' }],
        asyncRules: [{
          name: 'mockAsync',
          message: 'Async validation failed',
        }],
      };

      const result = await validationService.validateAsync('test-value', schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Async validation failed');
    });

    it('should handle multiple async rules', async () => {
      const successValidator: AsyncValidatorFn = async () => Promise.resolve(true);
      const failureValidator: AsyncValidatorFn = async () => Promise.resolve(false);
      
      validationService.addAsyncRule('asyncSuccess', successValidator);
      validationService.addAsyncRule('asyncFail', failureValidator);

      const schema: ValidationSchema = {
        type: 'string',
        asyncRules: [
          { name: 'asyncSuccess' },
          { name: 'asyncFail', message: 'Second async validation failed' },
        ],
      };

      const result = await validationService.validateAsync('test-value', schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Second async validation failed');
    });

    it('should log warning and continue when async validator is not found', async () => {
      const schema: ValidationSchema = {
        type: 'string',
        asyncRules: [{ name: 'nonexistentValidator' }],
      };

      const result = await validationService.validateAsync('test-value', schema);

      expect(result.isValid).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith('Async validator nonexistentValidator not found');
    });
  });
});