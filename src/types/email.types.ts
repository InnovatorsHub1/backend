

export interface IEmailAttachment {
    filename: string;
    content: Buffer;
    contentType: string;
  }
  
  export interface IEmailOptions {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    attachments?: IEmailAttachment[];
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
  }
  
  export interface IEmailTemplate {
    name: string;
    subject: string;
    html: string;
    text?: string;
    version?: string;
  }