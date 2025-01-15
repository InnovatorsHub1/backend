from flask import Blueprint, send_file, request, current_app
from app.errors.exceptions import APIError
import logging
from io import BytesIO

logger = logging.getLogger(__name__)
pdf_bp = Blueprint('pdf', __name__, url_prefix='/api/pdf')

@pdf_bp.route('/generate/invoice', methods=['POST'])
def generate_invoice():
    """Generate invoice PDF"""
    try:
        # Get and validate request data
        data = request.get_json(force=True)
        logger.info(f"Received PDF generation request: {data}")
        
        # Validate required fields
        required_fields = ['invoice_number', 'date', 'customer', 'items']
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            raise APIError(f"Missing required fields: {', '.join(missing_fields)}", 400)
        
        # Generate PDF
        pdf_content = current_app.pdf_service.generate_invoice_pdf(data)
        
        # Return PDF file
        return send_file(
            BytesIO(pdf_content),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"invoice_{data['invoice_number']}.pdf"
        )
        
    except APIError as e:
        logger.warning(f"PDF generation failed with API error: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"PDF generation failed with error: {str(e)}")
        raise APIError(f"Failed to generate PDF: {str(e)}", 500)