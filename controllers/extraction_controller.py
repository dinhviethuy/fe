import asyncio
import os
import uuid
import traceback
import io
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from docx2pdf import convert

from core.config import settings
from services.extractor import process_file_to_tables
from models.extraction import ExtractionResponseSchema

router = APIRouter()

@router.post("/api/v1/extract-tables", response_model=ExtractionResponseSchema)
@router.post("/api/v1/extract-tables/", response_model=ExtractionResponseSchema)
async def extract_tables_endpoint(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Không tìm thấy file.")

    try:
        return await process_file_to_tables(file)
    except HTTPException as he:
        raise he
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import Response
import io
import traceback

from services.excel_exporter import (
    ExportRequestSchema,
    ExportOptions,
    build_individual_zip_buffer,
    build_combined_vertical_workbook,
    build_multi_sheet_workbook
)

@router.post("/api/export-excel")
@router.post("/api/export-excel/")
async def export_excel_endpoint(request: ExportRequestSchema):
    try:
        tables = request.tables
        options = request.options or ExportOptions()
        
        if not tables:
            raise HTTPException(status_code=400, detail="Không có dữ liệu bảng để xuất.")
            
        if options.zip:
            zip_bytes = build_individual_zip_buffer(tables)
            return Response(
                content=zip_bytes,
                media_type="application/zip",
                headers={
                    "Content-Disposition": 'attachment; filename="extracted_tables_individual.zip"'
                }
            )
            
        elif options.verticalMerge:
            wb = build_combined_vertical_workbook(tables)
            excel_buffer = io.BytesIO()
            wb.save(excel_buffer)
            return Response(
                content=excel_buffer.getvalue(),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": 'attachment; filename="extracted_data_merged.xlsx"'
                }
            )
            
        else:
            wb = build_multi_sheet_workbook(tables)
            excel_buffer = io.BytesIO()
            wb.save(excel_buffer)
            return Response(
                content=excel_buffer.getvalue(),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": 'attachment; filename="extracted_data_combined.xlsx"'
                }
            )
            
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Xuất file Excel thất bại: {str(e)}")
