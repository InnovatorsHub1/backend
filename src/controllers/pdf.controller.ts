import { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/di/types';
import { PDFService } from '../services/pdf/pdf.service';
import { WinstonLogger } from '../core/logger/winston.logger';
import { ApiError } from '../core/errors/api.error';

@injectable()
export class PDFController {
  private logger = new WinstonLogger('PDFController');

  constructor(
    @inject(TYPES.PDFService) private readonly pdfService: PDFService
  ) {}

  generatePDF: RequestHandler = async (req, res) => {
    try {
      const { templateName, data, options } = req.body;

      if (!templateName || !data) {
        throw new ApiError('Missing required parameters', StatusCodes.BAD_REQUEST, 'PDFController');
      }

      const pdfBuffer = await this.pdfService.generatePDF(templateName, data, options);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${templateName}.pdf`);
      res.status(StatusCodes.OK).send(pdfBuffer);
    } catch (error) {
      this.logger.error('PDF generation failed', error);
      throw new ApiError('PDF generation failed', StatusCodes.INTERNAL_SERVER_ERROR, 'PDFController');
    }
  };

  mergePDFs: RequestHandler = async (req, res) => {
    try {
      const files = (req as any).files as Express.Multer.File[];
      
      if (!files || files.length < 2) {
        throw new ApiError('At least two PDF files are required', StatusCodes.BAD_REQUEST, 'PDFController');
      }

      const pdfBuffers = files.map(file => file.buffer);
      const mergedPDF = await this.pdfService.mergePDFs(pdfBuffers);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=merged.pdf');
      res.status(StatusCodes.OK).send(mergedPDF);
    } catch (error) {
      this.logger.error('PDF merging failed', error);
      throw new ApiError('PDF merging failed', StatusCodes.INTERNAL_SERVER_ERROR, 'PDFController');
    }
  };
}