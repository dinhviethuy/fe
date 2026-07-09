from pydantic import BaseModel
from typing import List, Optional

class CellSchema(BaseModel):
    col_index: int
    text: str
    col_span: int = 1
    row_span: int = 1

class RowSchema(BaseModel):
    row_index: int
    cells: List[CellSchema]

class TableSchema(BaseModel):
    table_index: int
    rows: List[RowSchema]

class PageSchema(BaseModel):
    page_number: int
    tables: List[TableSchema]
    error: Optional[str] = None

class ExtractionResponseSchema(BaseModel):
    document_name: str
    total_pages: int
    status: str
    pages: List[PageSchema]
