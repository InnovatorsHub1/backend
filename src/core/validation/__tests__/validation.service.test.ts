import { ValidationService } from '../validation.service';
import { ValidationSchema } from '../validation.types';

describe('ValidationService', () => {
  let validationService: ValidationService;

  beforeEach(() => {
    validationService = new ValidationService();
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
              age: { type: 'number', rules: [{ name: 'min', params: 18 }] },
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
});
