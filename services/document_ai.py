from google.api_core.client_options import ClientOptions
from google.cloud import documentai
from core.config import settings

def process_single_image_to_table(file_bytes: bytes, page_index: int, mime_type: str = "application/pdf") -> dict:
    """Gọi Google Document AI Form Parser cho 1 trang tài liệu đơn lẻ và định dạng kết quả trả về."""
    
    # Khởi tạo client kết nối tới API Google Document AI
    opts = ClientOptions(api_endpoint=f"{settings.GCP_LOCATION}-documentai.googleapis.com")
    client = documentai.DocumentProcessorServiceClient(client_options=opts)
    name = client.processor_path(settings.GCP_PROJECT_ID, settings.GCP_LOCATION, settings.GCP_PROCESSOR_ID)

    # Đóng gói tài liệu thành raw document request
    raw_document = documentai.RawDocument(content=file_bytes, mime_type=mime_type)
    request = documentai.ProcessRequest(name=name, raw_document=raw_document)

    try:
        # Thực hiện gọi API đồng bộ
        result = client.process_document(request=request)
        document = result.document
    except Exception as e:
        print(f"Lỗi khi xử lý trang {page_index}: {str(e)}")
        return {"page_number": page_index + 1, "tables": [], "error": str(e)}

    # Trích xuất dữ liệu gốc các bảng từ trang
    raw_tables = list(document.pages[0].tables)
    document_text = document.text
    
    final_tables = []
    
    for t_idx, t in enumerate(raw_tables):
        raw_rows = list(t.header_rows) + list(t.body_rows)
        if not raw_rows:
            continue
            
        # Xây dựng ma trận lưới ô 2 chiều để định vị chính xác vị trí hàng, cột và cell span
        grid = {}
        for r_idx, row in enumerate(raw_rows):
            c_idx = 0
            for cell in row.cells:
                # Tìm cột trống tiếp theo trên dòng này (tránh đè lên vùng ô gộp)
                while (r_idx, c_idx) in grid:
                    c_idx += 1
                row_span = getattr(cell, "row_span", 1) or 1
                col_span = getattr(cell, "col_span", 1) or 1
                
                # Điền thông tin ô vào lưới cho tất cả tọa độ bị gộp ô chiếm dụng
                for dr in range(row_span):
                    for dc in range(col_span):
                        grid[(r_idx + dr, c_idx + dc)] = {
                            "cell_obj": cell,
                            "is_origin": (dr == 0 and dc == 0),
                            "row_span": row_span,
                            "col_span": col_span
                        }
                c_idx += col_span
                
        if not grid:
            continue
            
        max_row = max(r for r, c in grid.keys())
        max_col = max(c for r, c in grid.keys())
        row_count = max_row + 1
        col_count = max_col + 1
        
        # Chuyển đổi ma trận lưới ô sang cấu trúc dòng và cột cho bảng
        table_rows = []
        for r_idx in range(row_count):
            row_cells = []
            for c_idx in range(col_count):
                grid_cell = grid.get((r_idx, c_idx))
                cell_text = ""
                c_span = 1
                r_span = 1
                
                if grid_cell:
                    if grid_cell["is_origin"]:
                        cell = grid_cell["cell_obj"]
                        # Trích xuất đoạn văn bản từ tài liệu gốc tương ứng với ô này
                        text_segments = []
                        for segment in cell.layout.text_anchor.text_segments:
                            text_segments.append(document_text[segment.start_index:segment.end_index])
                        cell_text = "".join(text_segments).strip().replace('\n', ' ')
                        c_span = grid_cell["col_span"]
                        r_span = grid_cell["row_span"]
                    else:
                        # Các ô phụ nằm trong vùng gộp được gán text rỗng
                        cell_text = ""
                        c_span = 1
                        r_span = 1
                        
                row_cells.append({
                    "col_index": c_idx,
                    "text": cell_text,
                    "col_span": c_span,
                    "row_span": r_span
                })
            table_rows.append({
                "row_index": r_idx,
                "cells": row_cells
            })
            
        final_tables.append({
            "table_index": len(final_tables) + 1,
            "rows": table_rows
        })
        
    return {
        "page_number": page_index + 1,
        "tables": final_tables
    }
