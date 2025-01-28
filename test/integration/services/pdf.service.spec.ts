// src/services/pdf/__tests__/pdf.service.spec.ts
import { PDFDocument } from 'pdf-lib';
import { Container } from 'inversify';
import { PDFService } from '@gateway/services/pdf/pdf.service';
import { TemplateService } from '@gateway/services/pdf/template.service';
import { TYPES } from '@gateway/core/di/types';
import { ApiError } from '@gateway/core/errors/api.error';
import puppeteer from 'puppeteer';

const mockDrawText = jest.fn();
const mockGetSize = jest.fn().mockReturnValue({ width: 100, height: 100 });
const mockPage = { getSize: mockGetSize, drawText: mockDrawText };

// Mock pdf-lib
jest.mock('pdf-lib', () => {
  return {
    PDFDocument: {
      create: jest.fn().mockImplementation(() => ({
        copyPages: jest.fn().mockResolvedValue(['page1', 'page2']),
        addPage: jest.fn(),
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
      })),
      load: jest.fn().mockImplementation(() => ({
        getPageIndices: jest.fn().mockReturnValue([0, 1]),
        copyPages: jest.fn().mockResolvedValue(['page1', 'page2']),
        getPages: jest.fn().mockReturnValue([mockPage]),
        embedFont: jest.fn().mockResolvedValue({ name: 'Helvetica' }),
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
      }))
    },
    StandardFonts: {
      Helvetica: 'Helvetica'
    },
    rgb: jest.fn().mockReturnValue({ r: 0, g: 0, b: 0 })
  };
});

// Mock puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockImplementation(() => ({
    newPage: jest.fn().mockImplementation(() => ({
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from([1, 2, 3])),
      close: jest.fn().mockResolvedValue(undefined)
    })),
    close: jest.fn().mockResolvedValue(undefined)
  }))
}));

// Mock template service
const mockTemplateService = {
  validateTemplate: jest.fn(),
  renderTemplate: jest.fn()
};

describe('PDFService', () => {
  let pdfService: PDFService;
  let container: Container;

  beforeEach(() => {
    jest.clearAllMocks();
    container = new Container();
    container.bind<TemplateService>(TYPES.TemplateService).toConstantValue(mockTemplateService as any);
    container.bind<PDFService>(TYPES.PDFService).to(PDFService);
    pdfService = container.get<PDFService>(TYPES.PDFService);
    
    // Reset mock function calls
    mockDrawText.mockClear();
    mockGetSize.mockClear();
  });

  describe('generatePDF', () => {
    const templateName = 'invoice';
    const data = { test: 'data' };

    it('should validate template before generating PDF', async () => {
      mockTemplateService.validateTemplate.mockResolvedValue(true);
      mockTemplateService.renderTemplate.mockResolvedValue('<html>test</html>');

      const result = await pdfService.generatePDF(templateName, data);

      expect(mockTemplateService.validateTemplate).toHaveBeenCalledWith(templateName);
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should throw ApiError if template is not valid', async () => {
      mockTemplateService.validateTemplate.mockResolvedValue(false);

      await expect(pdfService.generatePDF(templateName, data))
        .rejects
        .toThrow(new ApiError('PDF generation failed', 500, 'PDFService'));
    });

    it('should render template with provided data', async () => {
      mockTemplateService.validateTemplate.mockResolvedValue(true);
      mockTemplateService.renderTemplate.mockResolvedValue('<html>test</html>');

      await pdfService.generatePDF(templateName, data);

      expect(mockTemplateService.renderTemplate).toHaveBeenCalledWith(templateName, data);
    });
  });

  describe('mergePDFs', () => {
    it('should merge multiple PDF files', async () => {
      const pdfBuffers = [
        Buffer.from('pdf1'),
        Buffer.from('pdf2')
      ];

      const result = await pdfService.mergePDFs(pdfBuffers);

      expect(PDFDocument.create).toHaveBeenCalled();
      expect(PDFDocument.load).toHaveBeenCalledTimes(2);
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('addWatermark', () => {
    it('should add watermark to PDF', async () => {
      const pdfBuffer = Buffer.from('test');
      const watermarkText = 'CONFIDENTIAL';

      const result = await pdfService.addWatermark(pdfBuffer, watermarkText);

      expect(PDFDocument.load).toHaveBeenCalledWith(pdfBuffer);
      expect(mockDrawText).toHaveBeenCalled();
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('addPageNumbers', () => {
    it('should add page numbers to PDF', async () => {
      const pdfBuffer = Buffer.from('test');

      const result = await pdfService.addPageNumbers(pdfBuffer);

      expect(PDFDocument.load).toHaveBeenCalledWith(pdfBuffer);
      expect(mockDrawText).toHaveBeenCalled();
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('generateFromHTML', () => {
    it('should generate PDF from HTML', async () => {
      const result = await pdfService.generateFromHTML('<html>test</html>');

      expect(puppeteer.launch).toHaveBeenCalled();
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });
});