import asyncio
from concurrent.futures import ThreadPoolExecutor
import os
import uuid
import traceback
import io
from fastapi import UploadFile, HTTPException
from PIL import Image
from pypdf import PdfReader, PdfWriter

from core.config import settings
from utils.document_splitter import process_file_to_image_pages
from services.document_ai import process_single_image_to_table
from utils.file_converter import safe_convert

# Khởi tạo ThreadPool để giới hạn số luồng (tránh 429 Too Many Requests từ Google)
executor = ThreadPoolExecutor(max_workers=settings.MAX_CONCURRENT_WORKERS)

async def process_file_to_tables(file: UploadFile) -> dict:
    """Xử lý bóc tách file thành cấu trúc JSON các bảng (PDF, DOCX, Images)."""
    # Đọc file upload vào bộ nhớ
    file_bytes = await file.read()
    loop = asyncio.get_running_loop()
    
    ext = file.filename.lower().split('.')[-1]
    filename = file.filename
    
    # 1. Chuyển đổi tài liệu Word sang PDF trước
    if ext in ['doc', 'docx']:
        temp_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "temp")
        os.makedirs(temp_dir, exist_ok=True)
        
        unique_id = uuid.uuid4().hex
        temp_docx_path = os.path.join(temp_dir, f"{unique_id}.{ext}")
        temp_pdf_path = os.path.join(temp_dir, f"{unique_id}.pdf")
        
        try:
            with open(temp_docx_path, "wb") as f:
                f.write(file_bytes)
            
            await loop.run_in_executor(
                None, safe_convert, temp_docx_path, temp_pdf_path
            )
            
            with open(temp_pdf_path, "rb") as f:
                file_bytes = f.read()
            
            ext = 'pdf'
            filename = file.filename + ".pdf"
            
        finally:
            if os.path.exists(temp_docx_path):
                try:
                    os.remove(temp_docx_path)
                except Exception:
                    pass
            if os.path.exists(temp_pdf_path):
                try:
                    os.remove(temp_pdf_path)
                except Exception:
                    pass

    temp_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "temp")
    os.makedirs(temp_dir, exist_ok=True)
    file_prefix = os.path.splitext(file.filename)[0]
    
    pages_pdf_bytes = []
    total_pages = 0

    # 2. Xử lý chia trang và xuất PDF tùy thuộc định dạng tệp tin
    if ext == 'pdf':
        # PDF gốc: "cắt trang rồi extract luôn"
        # Bóc tách thành các trang ảnh JPEG để lưu trữ phục vụ xem kiểm tra
        image_pages = await loop.run_in_executor(
            None, process_file_to_image_pages, file_bytes, filename
        )
        for index, img_bytes in enumerate(image_pages):
            try:
                img_path = os.path.join(temp_dir, f"{file_prefix}_page_{index + 1}.jpg")
                with open(img_path, "wb") as f:
                    f.write(img_bytes)
            except Exception as e:
                print(f"Không thể ghi ảnh trang {index + 1} ra thư mục tạm: {str(e)}")
        
        # Cắt PDF thành các trang PDF đơn lẻ
        reader = PdfReader(io.BytesIO(file_bytes))
        total_pages = len(reader.pages)
        for page in reader.pages:
            writer = PdfWriter()
            writer.add_page(page)
            out_buf = io.BytesIO()
            writer.write(out_buf)
            pages_pdf_bytes.append(out_buf.getvalue())
            
    elif ext in ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff']:
        # Ảnh: "ảnh -> pdf"
        total_pages = 1
        # Lưu ảnh gốc vào thư mục kiểm tra
        try:
            img_path = os.path.join(temp_dir, f"{file_prefix}_page_1.{ext}")
            with open(img_path, "wb") as f:
                f.write(file_bytes)
        except Exception as e:
            print(f"Không thể ghi ảnh gốc ra thư mục tạm: {str(e)}")
            
        # Chuyển đổi ảnh sang PDF bytes
        img = Image.open(io.BytesIO(file_bytes))
        if img.mode != 'RGB':
            img = img.convert('RGB')
        pdf_buf = io.BytesIO()
        img.save(pdf_buf, format="PDF")
        pages_pdf_bytes.append(pdf_buf.getvalue())
        
    else:
        # Nếu là tài liệu Word đã được convert thành PDF ở bước trên
        # "1 trang doc -> ảnh -> pdf"
        # Bóc tách PDF kết quả thành các trang ảnh
        image_pages = await loop.run_in_executor(
            None, process_file_to_image_pages, file_bytes, filename
        )
        total_pages = len(image_pages)
        for index, img_bytes in enumerate(image_pages):
            try:
                img_path = os.path.join(temp_dir, f"{file_prefix}_page_{index + 1}.jpg")
                with open(img_path, "wb") as f:
                    f.write(img_bytes)
            except Exception as e:
                print(f"Không thể ghi ảnh trang {index + 1} ra thư mục tạm: {str(e)}")
                
            # Chuyển đổi trang ảnh đó sang PDF
            img = Image.open(io.BytesIO(img_bytes))
            if img.mode != 'RGB':
                img = img.convert('RGB')
            pdf_buf = io.BytesIO()
            img.save(pdf_buf, format="PDF")
            pages_pdf_bytes.append(pdf_buf.getvalue())

    if not pages_pdf_bytes:
        raise HTTPException(status_code=400, detail="Không tìm thấy nội dung hợp lệ trong file.")

    # 3. Tạo tác vụ xử lý song song lên Google Document AI (Gửi PDF, mime_type="application/pdf")
    tasks = []
    for index, page_pdf in enumerate(pages_pdf_bytes):
        task = loop.run_in_executor(
            executor, 
            process_single_image_to_table, 
            page_pdf, 
            index,
            "application/pdf"
        )
        tasks.append(task)
        
    # 4. Đợi tất cả hoàn thành (Gather Phase)
    completed_pages = await asyncio.gather(*tasks)
    
    # 5. Sắp xếp lại đảm bảo đúng thứ tự trang
    completed_pages.sort(key=lambda x: x["page_number"])
    
    # Lọc bỏ các trang rỗng (không có bảng và không có lỗi)
    filtered_pages = [
        page for page in completed_pages
        if page.get("tables") or page.get("error") is not None
    ]
    
    return {
        "document_name": file.filename,
        "total_pages": total_pages,
        "status": "success",
        "pages": filtered_pages
    }
