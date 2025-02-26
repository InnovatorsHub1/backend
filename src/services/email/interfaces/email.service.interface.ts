import { IEmailOptions, IEmailTemplate } from "src/types/email.types"
import { IUser } from "src/types/user.types"

export interface IEmailService {
  // Core email sending
  sendEmail(options: IEmailOptions): Promise<boolean>;
  sendTemplatedEmail(
    templateName: string,
    context: Record<string, any>,
    options: Partial<IEmailOptions>
  ): Promise<boolean>;

  // Business email methods
  sendWelcomeEmail(user: IUser): Promise<boolean>;
  sendPasswordResetEmail(user: IUser, resetToken: string): Promise<boolean>;
  sendInvoiceEmail(user: IUser, invoiceNumber: string, pdfBuffer: Buffer): Promise<boolean>;

  // Template management
  getTemplate?(templateName: string): Promise<IEmailTemplate>;
  validateTemplate?(templateName: string): Promise<boolean>;

  // Utilities
  validateEmailAddress(email: string): boolean; // Done
  validateEmailAddresses(emails: string[]): boolean; // Done
}