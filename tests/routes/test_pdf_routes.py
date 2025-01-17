import pytest
import json

from app.errors.exceptions import APIError

class TestPDFRoutes:
    """Test suite for PDF endpoints"""

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

    def test_generate_invoice_success(self, client, valid_invoice_data, headers):
        """Test successful invoice generation"""
        response = client.post(
            '/api/pdf/generate/invoice',
            json=valid_invoice_data,
            headers=headers
        )
        assert response.status_code == 200
        assert response.mimetype == 'application/pdf'
        assert response.headers['Content-Disposition'].startswith('attachment')
        assert f'invoice_{valid_invoice_data["invoice_number"]}.pdf' in response.headers['Content-Disposition']
        
        # Verify PDF content
        pdf_content = response.data
        assert pdf_content.startswith(b'%PDF')

    def test_generate_invoice_missing_fields(self, client, headers):
        """Test invoice generation with missing required fields"""
        invalid_data = {
            "invoice_number": "INV-001",
            # Missing other required fields
        }
        response = client.post(
            '/api/pdf/generate/invoice',
            json=invalid_data,
            headers=headers
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "Missing required fields" in data["message"]

    def test_generate_invoice_no_data(self, client, headers):
        """Test invoice generation with no data"""
        response = client.post(
            '/api/pdf/generate/invoice',
            json={},
            headers=headers
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "Missing required fields" in data["message"]

    def test_generate_invoice_with_calculation(self, client, valid_invoice_data, headers):
        """Test invoice generation with calculations"""
        response = client.post(
            '/api/pdf/generate/invoice',
            json=valid_invoice_data.copy(),
            headers=headers
        )
        
        assert response.status_code == 200
        assert response.mimetype == 'application/pdf'
        assert response.data.startswith(b'%PDF')