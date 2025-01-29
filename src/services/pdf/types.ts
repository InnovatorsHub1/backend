export interface PDFConfig {
    pageSize: string;
    marginTop: string;
    marginBottom: string;
    marginLeft: string;
    marginRight: string;
    encoding: string;
    dpi: number;
  }
  
  export interface StyleConfig {
    defaultFont: string;
    fontSize: number;
    lineHeight: number;
    headerHeight: string;
    footerHeight: string;
  }
  
  export interface PDFGenerationOptions {
    watermark?: string;
    pageNumbers?: boolean;
    password?: string;
    digitalSignature?: {
      certificate: string;
      reason: string;
    };
  }