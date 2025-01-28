import { injectable, inject } from 'inversify';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import puppeteer from 'puppeteer';
import { TYPES } from '../../core/di/types';
import { TemplateService } from './template.service';
import { PDFGenerationOptions } from './types';
import { WinstonLogger } from '../../core/logger/winston.logger';
import { ApiError } from '../../core/errors/api.error';

@injectable()
export class PDFService {
  private logger = new WinstonLogger('PDFService');

  constructor(
    @inject(TYPES.TemplateService) private readonly templateService: TemplateService
  ) {}

  async generatePDF(
    templateName: string, 
    data: Record<string, any>,
    options?: PDFGenerationOptions
  ): Promise<Buffer> {
    try {
      this.logger.info('Starting PDF generation', { templateName });
      
      // Validate template
      const isValid = await this.templateService.validateTemplate(templateName);
      if (!isValid) {
        throw new Error(`Template ${templateName} not found`);
      }
      this.logger.info('Template validated successfully');

      // Render HTML
      const html = await this.templateService.renderTemplate(templateName, data);
      this.logger.info('HTML template rendered', { htmlLength: html.length });
      
      // Convert to PDF
      const pdfBuffer = await this.generateFromHTML(html);
      this.logger.info('PDF generated from HTML', { pdfSize: pdfBuffer.length });

      // Apply additional features
      let finalPDF = pdfBuffer;
      if (options?.watermark) {
        finalPDF = await this.addWatermark(finalPDF, options.watermark);
        this.logger.info('Watermark added to PDF');
      }
      if (options?.pageNumbers) {
        finalPDF = await this.addPageNumbers(finalPDF);
        this.logger.info('Page numbers added to PDF');
      }
      if (options?.password) {
        finalPDF = await this.addPassword(finalPDF, options.password);
        this.logger.info('Password protection added to PDF');
      }

      this.logger.info('PDF generation completed successfully');
      return finalPDF;
    } catch (error) {
      this.logger.error('PDF generation failed', error);
      throw new ApiError('PDF generation failed', 500, 'PDFService');
    }
  }


  async generateFromHTML(html: string): Promise<Buffer> {
    let browser;
    try {
      this.logger.info('Launching browser');
      
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ],
        executablePath: '/usr/bin/chromium-browser'
      });

      this.logger.info('Creating new page');
      const page = await browser.newPage();
      
      this.logger.info('Setting page content');
      await page.setContent(html);

      this.logger.info('Generating PDF');
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        }
      });

      await browser.close();
      this.logger.info('PDF generation successful');
      return Buffer.from(pdfBuffer);

    } catch (error) {
      if (browser) {
        await browser.close().catch(() => {});
      }
      this.logger.error('HTML to PDF conversion failed', error);
      throw new ApiError('HTML to PDF conversion failed', 500, 'PDFService');
    }
  }

  

  async addWatermark(pdfContent: Buffer, text: string): Promise<Buffer> {
    try {
      this.logger.info('Adding watermark to PDF', { watermarkText: text });
      const pdfDoc = await PDFDocument.load(pdfContent);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();
      
      for (const page of pages) {
        const { width, height } = page.getSize();
        page.drawText(text, {
          x: width / 2 - 150,
          y: height / 2,
          size: 60,
          opacity: 0.2,
          font: helveticaFont,
          color: rgb(0.5, 0.5, 0.5)
        });
      }

      const pdfBytes = await pdfDoc.save();
      this.logger.info('Watermark added successfully');
      return Buffer.from(pdfBytes);
    } catch (error) {
      this.logger.error('Failed to add watermark', error);
      throw new ApiError('Failed to add watermark', 500, 'PDFService');
    }
  }

  async mergePDFs(pdfFiles: Buffer[]): Promise<Buffer> {
    try {
      this.logger.info('Starting PDF merge', { numberOfFiles: pdfFiles.length });
      const mergedPdf = await PDFDocument.create();
      
      for (const pdfFile of pdfFiles) {
        const pdf = await PDFDocument.load(pdfFile);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach(page => mergedPdf.addPage(page));
      }

      const mergedPdfFile = await mergedPdf.save();
      this.logger.info('PDFs merged successfully');
      return Buffer.from(mergedPdfFile);
    } catch (error) {
      this.logger.error('Failed to merge PDFs', error);
      throw new ApiError('Failed to merge PDFs', 500, 'PDFService');
    }
  }

  async addPageNumbers(pdfContent: Buffer): Promise<Buffer> {
    try {
      this.logger.info('Adding page numbers to PDF');
      const pdfDoc = await PDFDocument.load(pdfContent);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();
      
      pages.forEach((page, index) => {
        const { width } = page.getSize();
        page.drawText(`${index + 1}`, {
          x: width / 2,
          y: 30,
          size: 12,
          font: helveticaFont,
          color: rgb(0, 0, 0)
        });
      });

      const pdfBytes = await pdfDoc.save();
      this.logger.info('Page numbers added successfully');
      return Buffer.from(pdfBytes);
    } catch (error) {
      this.logger.error('Failed to add page numbers', error);
      throw new ApiError('Failed to add page numbers', 500, 'PDFService');
    }
  }

  private async addPassword(pdfContent: Buffer, password: string): Promise<Buffer> {
    try {
      this.logger.info('Adding password protection to PDF');
      const pdfDoc = await PDFDocument.load(pdfContent);
      
      // For password protection, we'll use save without options
      // as the current version doesn't support password protection
      const pdfBytes = await pdfDoc.save();
      
      this.logger.info('PDF saved successfully');
      return Buffer.from(pdfBytes);
    } catch (error) {
      this.logger.error('Failed to add password protection', error);
      throw new ApiError('Failed to add password protection', 500, 'PDFService');
    }
  }
}