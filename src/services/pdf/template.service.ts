import { injectable } from 'inversify';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { WinstonLogger } from '../../core/logger/winston.logger';
import { ApiError } from '../../core/errors/api.error';

@injectable()
export class TemplateService {
  private logger = new WinstonLogger('TemplateService');
  private templatesPath = join(process.cwd(), 'templates', 'documents', 'emails'); // Updated path

  async renderTemplate(templateName: string, context: Record<string, any>): Promise<string> {
    try {
      const templatePath = join(this.templatesPath, `${templateName}.html`);
      this.logger.info(`Loading template from: ${templatePath}`);
      
      let template = await readFile(templatePath, 'utf-8');
      
      // Handle {{#each}} blocks first
      template = this.processEachBlocks(template, context);
      
      // Handle {{#if}} blocks
      template = this.processIfBlocks(template, context);
      
      // Basic template variable replacement
      Object.entries(context).forEach(([key, value]) => {
        template = template.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value));
      });

      return template;
    } catch (error) {
      this.logger.error('Template rendering failed', error);
      throw new ApiError('Template rendering failed', 500, 'TemplateService');
    }
  }

  private processEachBlocks(template: string, context: Record<string, any>): string {
    const eachRegex = /{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g;
    return template.replace(eachRegex, (match, key, content) => {
      const items = context[key];
      if (!Array.isArray(items)) return '';
      
      return items.map(item => {
        let itemContent = content;
        Object.entries(item).forEach(([itemKey, itemValue]) => {
          itemContent = itemContent.replace(
            new RegExp(`{{\\s*${itemKey}\\s*}}`, 'g'),
            String(itemValue)
          );
        });
        return itemContent;
      }).join('');
    });
  }

  private processIfBlocks(template: string, context: Record<string, any>): string {
    const ifRegex = /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g;
    return template.replace(ifRegex, (match, key, content) => {
      return context[key] ? content : '';
    });
  }

  async validateTemplate(templateName: string): Promise<boolean> {
    try {
      const templatePath = join(this.templatesPath, `${templateName}.html`);
      await readFile(templatePath, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  async getTemplateVars(templateName: string): Promise<string[]> {
    try {
      const templatePath = join(this.templatesPath, `${templateName}.html`);
      const content = await readFile(templatePath, 'utf-8');
      const matches = content.match(/{{(?!#)\s*([^}]+)\s*}}/g) || [];
      return matches.map(match => match.replace(/[{}\s]/g, ''));
    } catch (error) {
      this.logger.error('Failed to get template variables', error);
      throw new ApiError('Failed to get template variables', 500, 'TemplateService');
    }
  }
}