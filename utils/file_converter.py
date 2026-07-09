def safe_convert(docx_path: str, pdf_path: str):
    """Bọc chuyển đổi Word sang PDF kèm khởi tạo COM trên luồng phụ."""
    import pythoncom
    from docx2pdf import convert
    pythoncom.CoInitialize()
    try:
        convert(docx_path, pdf_path)
    finally:
        pythoncom.CoUninitialize()
