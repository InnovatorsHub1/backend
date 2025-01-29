import { Router } from 'express';
import multer from 'multer';
import { PDFController } from '../controllers/pdf.controller';
import { createValidator } from '../middleware/validate-request.middleware';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/di/types';

@injectable()
export class PDFRoutes {
  public router: Router;
  private upload: multer.Multer;

  constructor(
    @inject(TYPES.PDFController) private readonly controller: PDFController
  ) {
    this.router = Router();
    this.upload = multer({
      storage: multer.memoryStorage(),
      fileFilter: (_, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(null, false);
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
      }
    });
    this.setupRoutes();
  }

  private setupRoutes(): void {
    const generatePDFValidator = createValidator({
      body: ['templateName', 'data']
    });

    this.router.post(
      '/generate',
      generatePDFValidator,
      this.controller.generatePDF
    );

    this.router.post(
      '/merge',
      this.upload.array('files', 10),
      this.controller.mergePDFs
    );
  }
}