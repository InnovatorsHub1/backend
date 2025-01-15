import pytest
from app.errors.exceptions import APIError


class TestPDFService:
    """Test suite for PDF Service"""

    @pytest.fixture
    def valid_invoice_data(self):
        """Valid invoice data for testing"""
        return {
            "invoice_number": "INV-001",
            "date": "2024-01-15",
            "customer": {
                "name": "John Doe",
                "email": "john@example.com"
            },
            "items": [
                {
                    "name": "Product A",
                    "quantity": 2,
                    "price": 99.99
                }
            ]
        }

    def test_generate_invoice_pdf_success(self, app, valid_invoice_data):
        """Test successful PDF generation"""
        pdf_content = app.pdf_service.generate_invoice_pdf(valid_invoice_data)
        assert pdf_content is not None
        assert isinstance(pdf_content, bytes)
        assert len(pdf_content) > 0
        assert pdf_content.startswith(b'%PDF')

    def test_generate_invoice_pdf_missing_fields(self, app):
        """Test PDF generation with missing required fields"""
        invalid_data = {
            "invoice_number": "INV-001",
            # missing other required fields
        }
        with pytest.raises(ValueError) as exc_info:
            app.pdf_service.generate_invoice_pdf(invalid_data)
        assert "Missing required fields" in str(exc_info.value)

    def test_generate_invoice_pdf_calculations(self, app, valid_invoice_data):
        """Test PDF generation calculations"""
        app.pdf_service.generate_invoice_pdf(valid_invoice_data)
        
        # Verify calculations in the data
        items = valid_invoice_data["items"]
        for item in items:
            assert "total" in item
            assert item["total"] == item["quantity"] * item["price"]
        
        assert "subtotal" in valid_invoice_data
        assert "tax" in valid_invoice_data
        assert "total" in valid_invoice_data
        
        expected_subtotal = sum(item["quantity"] * item["price"] for item in items)
        assert valid_invoice_data["subtotal"] == expected_subtotal
        assert valid_invoice_data["tax"] == expected_subtotal * 0.10
        assert valid_invoice_data["total"] == expected_subtotal + valid_invoice_data["tax"]

    def test_generate_invoice_pdf_empty_items(self, app, valid_invoice_data):
        """Test PDF generation with empty items list"""
        valid_invoice_data["items"] = []
        pdf_content = app.pdf_service.generate_invoice_pdf(valid_invoice_data)
        assert pdf_content is not None
        assert isinstance(pdf_content, bytes)

    def test_generate_invoice_pdf_negative_amounts(self, app, valid_invoice_data):
        """Test PDF generation with negative amounts"""
        valid_invoice_data["items"][0]["price"] = -100
        pdf_content = app.pdf_service.generate_invoice_pdf(valid_invoice_data)
        assert pdf_content is not None
        assert isinstance(pdf_content, bytes)