import { StatusCodes } from 'http-status-codes';
import { Request, Response } from 'express';
import { PDFController } from '@gateway/controllers/pdf.controller';
import { PDFService } from '@gateway/services/pdf/pdf.service';
import { ApiError } from '@gateway/core/errors/api.error';


interface PDFGenerationOptions {
  orientation?: 'portrait' | 'landscape';
  size?: string;
  margin?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  // Add other options as needed based on your PDFService implementation
}

jest.mock('@gateway/core/logger/winston.logger', () => {
  return {
    WinstonLogger: jest.fn().mockImplementation(() => ({
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      log: jest.fn()
    }))
  };
});

// Mock inversify decorators
jest.mock('inversify', () => ({
  injectable: () => jest.fn(),
  inject: () => jest.fn()
}));

describe('PDFController', () => {
  let controller: PDFController;
  let mockPDFService: jest.Mocked<PDFService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    // Create complete mock PDF service with all methods
    mockPDFService = {
      generatePDF: jest.fn(),
      generateFromHTML: jest.fn(),
      addWatermark: jest.fn(),
      mergePDFs: jest.fn(),
      addPageNumbers: jest.fn()
    } as unknown as jest.Mocked<PDFService>;

    // Reset all mocks
    jest.clearAllMocks();

    // Create mock response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      setHeader: jest.fn()
    } as Partial<Response>;

    // Create mock request
    mockRequest = {
      body: {},
      files: []
    } as Partial<Request>;

    // Create controller instance
    controller = new PDFController(mockPDFService);
    


  });

  describe('generatePDF', () => {
    it('should generate PDF successfully', async () => {
      // Arrange
      const templateName = 'test-template';
      const data = { key: 'value' };
      const options: PDFGenerationOptions = {
        orientation: 'portrait',
        size: 'A4',
        margin: {
          top: 20,
          bottom: 20,
          left: 20,
          right: 20
        }
      };
      const pdfBuffer = Buffer.from('mock pdf content');

      mockRequest.body = { templateName, data, options };
      mockPDFService.generatePDF.mockResolvedValue(pdfBuffer);

      // Act
      await controller.generatePDF(
        mockRequest as Request,
        mockResponse as Response,
        jest.fn()
      );

      // Assert
      expect(mockPDFService.generatePDF).toHaveBeenCalledWith(
        templateName,
        data,
        options
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf'
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        `attachment; filename=${templateName}.pdf`
      );
      expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(mockResponse.send).toHaveBeenCalledWith(pdfBuffer);
    });

    it('should throw error if templateName is missing', async () => {
      // Arrange
      mockRequest.body = { data: { key: 'value' } };

      // Act & Assert
      await expect(
        controller.generatePDF(
          mockRequest as Request,
          mockResponse as Response,
          jest.fn()
        )
      ).rejects.toThrow(new ApiError('Missing required parameters', StatusCodes.BAD_REQUEST, 'PDFController'));
    });

    it('should throw error if data is missing', async () => {
      // Arrange
      mockRequest.body = { templateName: 'test-template' };

      // Act & Assert
      await expect(
        controller.generatePDF(
          mockRequest as Request,
          mockResponse as Response,
          jest.fn()
        )
      ).rejects.toThrow(new ApiError('Missing required parameters', StatusCodes.BAD_REQUEST, 'PDFController'));
    });

  
  });

  describe('mergePDFs', () => {
    it('should merge PDFs successfully', async () => {
      // Arrange
      const files = [
        { buffer: Buffer.from('pdf1') },
        { buffer: Buffer.from('pdf2') }
      ] as Express.Multer.File[];
      const mergedPdfBuffer = Buffer.from('merged pdf content');

      (mockRequest as any).files = files;
      mockPDFService.mergePDFs.mockResolvedValue(mergedPdfBuffer);

      // Act
      await controller.mergePDFs(
        mockRequest as Request,
        mockResponse as Response,
        jest.fn()
      );

      // Assert
      expect(mockPDFService.mergePDFs).toHaveBeenCalledWith([
        files[0].buffer,
        files[1].buffer
      ]);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf'
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename=merged.pdf'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(mockResponse.send).toHaveBeenCalledWith(mergedPdfBuffer);
    });

    it('should throw error if less than 2 files are provided', async () => {
      // Arrange
      (mockRequest as any).files = [{ buffer: Buffer.from('pdf1') }];

      // Act & Assert
      await expect(
        controller.mergePDFs(
          mockRequest as Request,
          mockResponse as Response,
          jest.fn()
        )
      ).rejects.toThrow(new ApiError('At least two PDF files are required', StatusCodes.BAD_REQUEST, 'PDFController'));
    });

    it('should throw error if no files are provided', async () => {
      // Arrange
      (mockRequest as any).files = undefined;

      // Act & Assert
      await expect(
        controller.mergePDFs(
          mockRequest as Request,
          mockResponse as Response,
          jest.fn()
        )
      ).rejects.toThrow(new ApiError('At least two PDF files are required', StatusCodes.BAD_REQUEST, 'PDFController'));
    });

   
  });
});