class MockPDFService:
    """Mock service for PDF generation in tests"""
    
    def __init__(self, template_dir: str = 'app/templates/pdf'):
        """Initialize mock PDF service"""
        self.template_dir = template_dir

    def generate_invoice_pdf(self, data: dict) -> bytes:
        """
        Mock invoice PDF generation
        
        Args:
            data: Invoice data dictionary
            
        Returns:
            bytes: Mock PDF content
        """
        # Validate required fields
        required_fields = ['invoice_number', 'date', 'customer', 'items']
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")

        # Calculate totals like the real service
        for item in data['items']:
            item['total'] = item['quantity'] * item['price']
        data['subtotal'] = sum(item['total'] for item in data['items'])
        data['tax'] = data['subtotal'] * 0.10  # 10% tax
        data['total'] = data['subtotal'] + data['tax']
            
        # Return minimal valid PDF content
        return b"%PDF-1.4\n%EOF"