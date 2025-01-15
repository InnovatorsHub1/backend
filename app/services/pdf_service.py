import logging
from weasyprint import HTML
from jinja2 import Environment, FileSystemLoader
import os
from pathlib import Path
import tempfile

logger = logging.getLogger(__name__)

class PDFService:
    """Service for generating PDF documents"""
    
    def __init__(self, template_dir: str = 'app/templates/pdf'):
        """Initialize PDF service"""
        try:
            # Convert to Path object for better path handling
            template_path = Path(template_dir)
            
            # Create template directory if it doesn't exist
            template_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Using template directory: {template_path}")
            
            self.template_env = Environment(
                loader=FileSystemLoader(str(template_path))
            )
            logger.info("PDF Service initialized successfully")
        except Exception as e:
            logger.error(f"PDF Service initialization failed: {str(e)}")
            raise

    def generate_invoice_pdf(self, data: dict) -> bytes:
        """
        Generate PDF invoice from template and data
        
        Args:
            data: Invoice data dictionary
            
        Returns:
            bytes: Generated PDF content
        """
        temp_html_path = None
        try:
            logger.info(f"Generating PDF for invoice: {data.get('invoice_number')}")
            
            # Validate required fields
            required_fields = ['invoice_number', 'date', 'customer', 'items']
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")

            # Calculate totals
            for item in data['items']:
                item['total'] = item['quantity'] * item['price']
            data['subtotal'] = sum(item['total'] for item in data['items'])
            data['tax'] = data['subtotal'] * 0.10  # 10% tax
            data['total'] = data['subtotal'] + data['tax']
            
            # Render HTML template
            template = self.template_env.get_template('invoice.html')
            html_content = template.render(**data)
            
            # Create temporary HTML file
            fd, temp_html_path = tempfile.mkstemp(suffix='.html')
            try:
                with os.fdopen(fd, 'w') as tmp:
                    tmp.write(html_content)
                
                # Generate PDF from the temporary HTML file
                html = HTML(filename=temp_html_path)
                pdf_content = html.write_pdf()
                logger.info(f"Successfully generated PDF for invoice: {data.get('invoice_number')}")
                return pdf_content
            finally:
                # Clean up temporary file
                if temp_html_path and os.path.exists(temp_html_path):
                    os.unlink(temp_html_path)
            
        except Exception as e:
            logger.error(f"PDF generation failed: {str(e)}")
            logger.error(f"Data received: {data}")
            if temp_html_path and os.path.exists(temp_html_path):
                os.unlink(temp_html_path)
            raise