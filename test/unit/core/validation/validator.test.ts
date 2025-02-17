import { StandardValidators } from "@gateway/core/validation/validators";


describe('StandardValidators', () => {
  describe('required', () => {
    const { required } = StandardValidators;

    it('should return true for non-empty values', () => {
      expect(required('test')).toBe(true);
      expect(required(0)).toBe(true);
      expect(required(false)).toBe(true);
      expect(required([])).toBe(true);
      expect(required({})).toBe(true);
    });

    it('should return false for empty values', () => {
      expect(required(undefined)).toBe(false);
      expect(required(null)).toBe(false);
      expect(required('')).toBe(false);
    });
  });

  describe('string', () => {
    const { string } = StandardValidators;

    it('should return true for string values', () => {
      expect(string('')).toBe(true);
      expect(string('test')).toBe(true);
      expect(string(`template`)).toBe(true);
    });

    it('should return false for non-string values', () => {
      expect(string(123)).toBe(false);
      expect(string(true)).toBe(false);
      expect(string({})).toBe(false);
      expect(string([])).toBe(false);
      expect(string(null)).toBe(false);
      expect(string(undefined)).toBe(false);
    });
  });

  describe('email', () => {
    const { email } = StandardValidators;

    it('should return true for valid email addresses', () => {
      expect(email('test@example.com')).toBe(true);
      expect(email('user.name@domain.co.uk')).toBe(true);
      expect(email('user+label@domain.com')).toBe(true);
    });

    it('should return false for invalid email addresses', () => {
      expect(email('invalid')).toBe(false);
      expect(email('test@')).toBe(false);
      expect(email('@domain.com')).toBe(false);
      expect(email('test@domain')).toBe(false);
      expect(email('test@domain.')).toBe(false);
      expect(email('test domain@test.com')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(email(123)).toBe(false);
      expect(email(null)).toBe(false);
      expect(email(undefined)).toBe(false);
      expect(email({})).toBe(false);
    });
  });

  describe('min', () => {
    const { min } = StandardValidators;

    it('should return true for values greater than or equal to minimum', () => {
      expect(min(5, { min: 3 })).toBe(true);
      expect(min(3, { min: 3 })).toBe(true);
      expect(min(10, { min: -5 })).toBe(true);
    });

    it('should return false for values less than minimum', () => {
      expect(min(2, { min: 3 })).toBe(false);
      expect(min(-5, { min: 0 })).toBe(false);
    });

    it('should return false for non-number values or missing params', () => {
      expect(min('5', { min: 3 })).toBe(false);
      expect(min(5)).toBe(false);
      expect(min(5, {})).toBe(false);
      expect(min(null, { min: 3 })).toBe(false);
    });
  });

  describe('max', () => {
    const { max } = StandardValidators;

    it('should return true for values less than or equal to maximum', () => {
      expect(max(3, { max: 5 })).toBe(true);
      expect(max(5, { max: 5 })).toBe(true);
      expect(max(-10, { max: -5 })).toBe(true);
    });

    it('should return false for values greater than maximum', () => {
      expect(max(6, { max: 5 })).toBe(false);
      expect(max(1, { max: 0 })).toBe(false);
    });

    it('should return false for non-number values or missing params', () => {
      expect(max('3', { max: 5 })).toBe(false);
      expect(max(3)).toBe(false);
      expect(max(3, {})).toBe(false);
      expect(max(null, { max: 5 })).toBe(false);
    });
  });

  describe('regex', () => {
    const { regex } = StandardValidators;

    it('should return true for strings matching pattern', () => {
      expect(regex('abc123', { pattern: /^[a-z0-9]+$/ })).toBe(true);
      expect(regex('test', { pattern: /^test$/ })).toBe(true);
    });

    it('should return false for strings not matching pattern', () => {
      expect(regex('ABC', { pattern: /^[a-z]+$/ })).toBe(false);
      expect(regex('test1', { pattern: /^test$/ })).toBe(false);
    });

    it('should return false for non-string values or missing pattern', () => {
      expect(regex(123, { pattern: /\d+/ })).toBe(false);
      expect(regex('test')).toBe(false);
      expect(regex('test', {})).toBe(false);
      expect(regex(null, { pattern: /test/ })).toBe(false);
    });
  });

  describe('number', () => {
    const { number } = StandardValidators;

    it('should return true for valid numbers', () => {
      expect(number(0)).toBe(true);
      expect(number(1.5)).toBe(true);
      expect(number(-10)).toBe(true);
      expect(number(Number.MAX_VALUE)).toBe(true);
    });

    it('should return false for non-number values', () => {
      expect(number('123')).toBe(false);
      expect(number(NaN)).toBe(false);
      expect(number(null)).toBe(false);
      expect(number(undefined)).toBe(false);
      expect(number({})).toBe(false);
      expect(number([])).toBe(false);
    });
  });

  describe('boolean', () => {
    const { boolean } = StandardValidators;

    it('should return true for boolean values', () => {
      expect(boolean(true)).toBe(true);
      expect(boolean(false)).toBe(true);
    });

    it('should return false for non-boolean values', () => {
      expect(boolean(1)).toBe(false);
      expect(boolean('true')).toBe(false);
      expect(boolean(null)).toBe(false);
      expect(boolean(undefined)).toBe(false);
      expect(boolean({})).toBe(false);
      expect(boolean([])).toBe(false);
    });
  });

  describe('array', () => {
    const { array } = StandardValidators;

    it('should return true for arrays', () => {
      expect(array([])).toBe(true);
      expect(array([1, 2, 3])).toBe(true);
      expect(array(new Array())).toBe(true);
    });

    it('should return false for non-array values', () => {
      expect(array({})).toBe(false);
      expect(array('[]')).toBe(false);
      expect(array(null)).toBe(false);
      expect(array(undefined)).toBe(false);
      expect(array(42)).toBe(false);
    });
  });

  describe('object', () => {
    const { object } = StandardValidators;

    it('should return true for objects', () => {
      expect(object({})).toBe(true);
      expect(object({ key: 'value' })).toBe(true);
      expect(object(new Object())).toBe(true);
    });

    it('should return false for non-object values', () => {
      expect(object([])).toBe(false);
      expect(object(null)).toBe(false);
      expect(object('object')).toBe(false);
      expect(object(42)).toBe(false);
      expect(object(undefined)).toBe(false);
    });
  });
});