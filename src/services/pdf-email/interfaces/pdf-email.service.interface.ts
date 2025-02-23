import { IUser } from "src/types/user.types"
import { IPDFEmailOptions } from "src/services/pdf-email/types"

export interface IPDFEmailService {
  generateAndSendPDF(options: IPDFEmailOptions): Promise<boolean>;
  sendInvoicePDF(user: IUser, invoiceData: Record<string, any>): Promise<boolean>;
  sendReportPDF(reportConfig: {
    user: IUser;
    reportName: string;
    reportData: Record<string, any>;
    isConfidential?: boolean;
  }): Promise<boolean>;
}