from typing import Optional

def sanitize_sheet_name(name: Optional[str], fallback: str) -> str:
    """Loại bỏ ký tự đặc biệt không hợp lệ trong Excel sheet name và giới hạn 31 ký tự."""
    raw_name = name or fallback
    for char in ['\\', '/', '?', '*', '[', ']', ':']:
        raw_name = raw_name.replace(char, '')
    return raw_name[:31].strip() or fallback

def sanitize_file_name(name: Optional[str], fallback: str) -> str:
    """Loại bỏ các ký tự đặc biệt không được phép trong tên file trên hệ điều hành."""
    raw_file_name = name or fallback
    for char in ['/', '\\', '?', '%', '*', ':', '|', '"', '<', '>']:
        raw_file_name = raw_file_name.replace(char, '_')
    return raw_file_name.strip() or fallback
