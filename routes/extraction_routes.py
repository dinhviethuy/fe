from fastapi import APIRouter, UploadFile, File
from controllers.extraction_controller import extract_tables_handler, export_excel_handler
from models.extraction import ExtractionResponseSchema
from models.excel import ExportRequestSchema

router = APIRouter()

@router.post("/api/v1/extract-tables", response_model=ExtractionResponseSchema)
@router.post("/api/v1/extract-tables/", response_model=ExtractionResponseSchema)
async def extract_tables_endpoint(file: UploadFile = File(...)):
    return await extract_tables_handler(file)

@router.post("/api/export-excel")
@router.post("/api/export-excel/")
async def export_excel_endpoint(request: ExportRequestSchema):
    return await export_excel_handler(request)
