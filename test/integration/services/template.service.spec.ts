import { TemplateService } from '@gateway/services/pdf/template.service';
import { InvoiceData, InvoiceItem } from '@gateway/types/invoice.types';
import { readFile } from 'fs/promises';

// Mock fs/promises
jest.mock('fs/promises');
const mockedReadFile = readFile as jest.MockedFunction<typeof readFile>;

describe('TemplateService', () => {
  let templateService: TemplateService;

  beforeEach(() => {
    templateService = new TemplateService();
    jest.clearAllMocks();
  });

  describe('renderTemplate', () => {
    it('should replace simple variables', async () => {
      const template = '<p>Hello {{name}}!</p>';
      mockedReadFile.mockResolvedValue(template);

      const result = await templateService.renderTemplate('simple', { name: 'John' });

      expect(result).toBe('<p>Hello John!</p>');
    });

    it('should handle multiple variables', async () => {
      const template = '<div>{{firstName}} {{lastName}}</div>';
      mockedReadFile.mockResolvedValue(template);

      const result = await templateService.renderTemplate('multi', { 
        firstName: 'John',
        lastName: 'Doe'
      });

      expect(result).toBe('<div>John Doe</div>');
    });

    it('should handle arrays with #each', async () => {
      const template = `
        <ul>
          {{#each items}}
          <li>{{name}}</li>
          {{/each}}
        </ul>`;
      mockedReadFile.mockResolvedValue(template);

      interface ListItem {
        name: string;
      }

      const data: { items: ListItem[] } = {
        items: [
          { name: 'Item 1' },
          { name: 'Item 2' },
          { name: 'Item 3' }
        ]
      };

      const result = await templateService.renderTemplate('list', data);

      expect(result).toContain('<li>Item 1</li>');
      expect(result).toContain('<li>Item 2</li>');
      expect(result).toContain('<li>Item 3</li>');
    });

    it('should handle conditional rendering with #if', async () => {
      const template = `
        <div>
          {{#if showMessage}}
          <p>{{message}}</p>
          {{/if}}
        </div>`;
      mockedReadFile.mockResolvedValue(template);

      interface MessageData {
        showMessage: boolean;
        message: string;
      }

      const dataTrue: MessageData = {
        showMessage: true,
        message: 'Hello'
      };

      const dataFalse: MessageData = {
        showMessage: false,
        message: 'Hello'
      };

      const resultTrue = await templateService.renderTemplate('conditional', dataTrue);
      const resultFalse = await templateService.renderTemplate('conditional', dataFalse);

      expect(resultTrue).toContain('<p>Hello</p>');
      expect(resultFalse).not.toContain('<p>Hello</p>');
    });

    it('should handle complex invoice template', async () => {
      const template = `
        <div class="invoice">
          <h1>{{company_name}}</h1>
          <div class="details">
            <p>Invoice #{{invoice_number}}</p>
            <p>Date: {{date}}</p>
          </div>
          <table>
            {{#each items}}
            <tr>
              <td>{{description}}</td>
              <td>{{quantity}}</td>
              <td>{{price}}</td>
              <td>{{total}}</td>
            </tr>
            {{/each}}
          </table>
          {{#if has_tax}}
          <p>Tax Rate: {{tax_rate}}%</p>
          {{/if}}
          <p>Total: {{final_total}}</p>
        </div>`;
      mockedReadFile.mockResolvedValue(template);

      const items: InvoiceItem[] = [
        {
          description: 'Service 1',
          quantity: 2,
          price: 100,
          total: 200
        },
        {
          description: 'Service 2',
          quantity: 1,
          price: 300,
          total: 300
        }
      ];

      const invoiceData: InvoiceData = {
        company_name: 'Test Company',
        invoice_number: 'INV-001',
        date: '2025-01-27',
        items: items,
        has_tax: true,
        tax_rate: 20,
        final_total: 600
      };

      const result = await templateService.renderTemplate('invoice', invoiceData);

      expect(result).toContain('Test Company');
      expect(result).toContain('INV-001');
      expect(result).toContain('2025-01-27');
      expect(result).toContain('Service 1');
      expect(result).toContain('Service 2');
      expect(result).toContain('300');
      expect(result).toContain('200');
      expect(result).toContain('20%');
      expect(result).toContain('600');
    });
  });

  describe('validateTemplate', () => {
    it('should return true for existing template', async () => {
      mockedReadFile.mockResolvedValue('template content');
      const result = await templateService.validateTemplate('existing');
      expect(result).toBe(true);
    });

    it('should return false for non-existing template', async () => {
      mockedReadFile.mockRejectedValue(new Error('File not found'));
      const result = await templateService.validateTemplate('non-existing');
      expect(result).toBe(false);
    });
  });

  describe('getTemplateVars', () => {
    it('should extract template variables', async () => {
      const template = `
        <div>
          {{name}}
          {{#each items}}
          {{title}}
          {{/each}}
          {{#if show}}
          {{message}}
          {{/if}}
        </div>`;
      mockedReadFile.mockResolvedValue(template);

      const vars = await templateService.getTemplateVars('test');

      expect(vars).toContain('name');
      expect(vars).toContain('title');
      expect(vars).toContain('message');
      expect(vars).not.toContain('items');
      expect(vars).not.toContain('show');
    });

    it('should handle errors when reading template', async () => {
      mockedReadFile.mockRejectedValue(new Error('Read error'));
      await expect(templateService.getTemplateVars('error')).rejects.toThrow();
    });
  });
});