# import pytest

# class TestFileReader:
#     def setup_method(self):
#         # Initialize the FileReaderService instance before each test
#         self.reader = FileReaderService()

    # def test_read_file(self, tmp_path):
    #     # Create a temporary test file
    #     path = tmp_path / "test.txt"
    #     path.write_text("Hello, world!\n")

    #     # Read the file using the service
    #     content = self.reader.read_file(str(path))

    #     # Perform assertions
    #     assert isinstance(content, str), "Content should be a string"
    #     assert content.startswith("Hello, world!"), "Content should start with 'Hello, world!'"
    #     assert content == "Hello, world!\n", "Content should exactly match 'Hello, world!\\n'"

        
    # def test_read_hebrew_file(self):
    #     content = self.reader.read_file('test.txt')
    #     self.assertTrue(isinstance(content, str))
    #     self.assertTrue(any('\u0590' <= c <= '\u05FF' for c in content))