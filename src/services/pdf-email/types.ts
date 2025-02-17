export interface IPDFEmailOptions {
    templateName: string;
    data: Record<string, any>;
    emailTo: string | string[];
    emailSubject: string;
    emailTemplate: string;
    emailContext?: Record<string, any>;
    pdfOptions?: {
      watermark?: string;
      pageNumbers?: boolean;
      password?: string;
    };
  }
  
  export interface IPDFEmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
  }