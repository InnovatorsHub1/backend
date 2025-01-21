import logging

class FileReaderService:
    def __init__(self):
        # Configure logging
        self.logger = logging.getLogger(__name__)

    def read_file(self, file_path: str) -> str:
        """
        Reads the content of a file and returns it as a string.

        Args:
            file_path (str): Path to the file to read.

        Returns:
            str: Content of the file.
        """
        try:
            self.logger.info(f"Attempting to read file: {file_path}")
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            self.logger.info(f"File read successfully: {file_path}")
            return content
        except FileNotFoundError:
            self.logger.error(f"File not found: {file_path}")
            raise
        except Exception as e:
            self.logger.error(f"Error reading file: {str(e)}")
            raise

    # def detect_encoding(self, content: bytes) -> str:
    #     """
    #     Detect file encoding, focusing on Hebrew encodings
    #     Returns: detected encoding name
    #     """
    #     try:
    #         result = chardet.detect(content)
    #         encoding = result['encoding']
    #         confidence = result['confidence']
    #         self.logger.info(f"Detected encoding: {encoding} ({confidence})")
    #         return encoding
    #     except Exception as e:
    #         self.logger.error(f"Error detecting encoding: {str(e)}")
    #         return 'utf-8'  # default fallback
