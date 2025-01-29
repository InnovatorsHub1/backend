import { PDFConfig, StyleConfig } from "./types";

export const PDF_CONFIG: PDFConfig = {
    pageSize: 'A4',
    marginTop: '20mm',
    marginBottom: '20mm',
    marginLeft: '15mm',
    marginRight: '15mm',
    encoding: 'UTF-8',
    dpi: 300
  };
  
  export const STYLE_CONFIG: StyleConfig = {
    defaultFont: 'Arial',
    fontSize: 12,
    lineHeight: 1.5,
    headerHeight: '30mm',
    footerHeight: '20mm'
  };