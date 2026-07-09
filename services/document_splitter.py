import io
import zipfile
from typing import List
from pdf2image import convert_from_bytes
from PIL import Image
from core.config import settings

def split_pdf_to_images(file_bytes: bytes) -> List[bytes]:
    """Chuyển đổi PDF thành danh sách các ảnh JPEG format byte."""
    # Yêu cầu máy chủ đã cài đặt poppler
    poppler_path = settings.POPPLER_PATH if settings.POPPLER_PATH else None
    images = convert_from_bytes(file_bytes, dpi=200, poppler_path=poppler_path)
    image_bytes_list = []
    
    for img in images:
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='JPEG')
        image_bytes_list.append(img_byte_arr.getvalue())
        
    return image_bytes_list

def extract_images_from_docx(file_bytes: bytes) -> List[bytes]:
    """Giải nén DOCX và trích xuất ảnh từ thư mục word/media/."""
    image_bytes_list = []
    
    # DOCX bản chất là một file zip
    with zipfile.ZipFile(io.BytesIO(file_bytes)) as docx_zip:
        for item in docx_zip.namelist():
            if item.startswith('word/media/') and item.lower().endswith(('.png', '.jpg', '.jpeg')):
                img_data = docx_zip.read(item)
                
                # Chuẩn hóa về định dạng JPEG bytes (tùy chọn)
                img = Image.open(io.BytesIO(img_data))
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                img_byte_arr = io.BytesIO()
                img.save(img_byte_arr, format='JPEG')
                image_bytes_list.append(img_byte_arr.getvalue())
                
    return image_bytes_list

def process_file_to_image_pages(file_bytes: bytes, filename: str) -> List[bytes]:
    """Hàm route logic dựa trên đuôi file."""
    ext = filename.lower().split('.')[-1]
    if ext == 'pdf':
        return split_pdf_to_images(file_bytes)
    elif ext == 'docx':
        return extract_images_from_docx(file_bytes)
    elif ext in ['png', 'jpg', 'jpeg']:
        return [file_bytes]
    else:
        raise ValueError("Định dạng file không được hỗ trợ.")
