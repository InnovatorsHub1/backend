export interface InvoiceItem {
    description: string;
    quantity: number;
    price: number;
    total: number;
  }
  
  export interface InvoiceData {
    company_name: string;
    invoice_number: string;
    date: string;
    items: InvoiceItem[];
    has_tax: boolean;
    tax_rate: number;
    final_total: number;
  }