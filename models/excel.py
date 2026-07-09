from typing import List, Optional, Any
from pydantic import BaseModel

class ClientMergeRange(BaseModel):
    startRow: int
    startCol: int
    endRow: int
    endCol: int

class ClientTableItem(BaseModel):
    tableName: Optional[str] = None
    headers: List[Any] = []
    rows: List[List[str]] = []
    merges: Optional[List[ClientMergeRange]] = None
    headerRows: Optional[List[int]] = None

class ExportOptions(BaseModel):
    zip: Optional[bool] = False
    verticalMerge: Optional[bool] = False

class ExportRequestSchema(BaseModel):
    tables: List[ClientTableItem]
    options: Optional[ExportOptions] = None
