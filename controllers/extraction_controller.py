import traceback
from fastapi import UploadFile, HTTPException, Response
from services.extractor import process_file_to_tables
from services.excel_exporter import export_tables
from models.excel import ExportRequestSchema, ExportOptions

async def extract_tables_handler(file: UploadFile):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Không tìm thấy file.")

    try:
        return await process_file_to_tables(file)
    except HTTPException as he:
        raise he
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

async def export_excel_handler(request: ExportRequestSchema):
    try:
        tables = request.tables
        options = request.options or ExportOptions()
        
        if not tables:
            raise HTTPException(status_code=400, detail="Không có dữ liệu bảng để xuất.")
            
        file_bytes, media_type, filename = export_tables(tables, options)
        return Response(
            content=file_bytes,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
            
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Xuất file Excel thất bại: {str(e)}")
