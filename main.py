import sys
import os
import site

# Thiết lập DLL cho pywin32 trước khi import bất kỳ thư viện win32/docx2pdf nào trên Windows
def setup_pywin32_dlls():
    try:
        user_site = site.getusersitepackages()
        if user_site and user_site not in sys.path:
            sys.path.append(user_site)
            for sub in ["win32", "win32\\lib", "pythonwin"]:
                sub_path = os.path.join(user_site, sub)
                if sub_path not in sys.path:
                    sys.path.append(sub_path)
    except Exception:
        pass

    paths = []
    try:
        paths.append(os.path.join(site.getusersitepackages(), "pywin32_system32"))
    except Exception:
        pass
    try:
        for p in site.getsitepackages():
            paths.append(os.path.join(p, "pywin32_system32"))
    except Exception:
        pass
    try:
        for p in sys.path:
            paths.append(os.path.join(p, "pywin32_system32"))
    except Exception:
        pass
        
    for path in paths:
        if os.path.isdir(path):
            try:
                os.add_dll_directory(path)
                break
            except Exception:
                pass

if os.name == 'nt':
    setup_pywin32_dlls()

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
import traceback

from core.config import settings
from controllers import extraction_controller

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 400 and exc.detail == "There was an error parsing the body":
        cause = exc.__cause__
        cause_msg = str(cause) if cause else "Unknown parsing error"
        print(f"Error parsing request body: {cause_msg}")
        if cause:
            traceback.print_exception(type(cause), cause, cause.__traceback__)
        return JSONResponse(
            status_code=400,
            content={
                "detail": f"There was an error parsing the body: {cause_msg}",
                "error_type": type(cause).__name__ if cause else "UnknownError"
            }
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# Đăng ký router từ Controller
app.include_router(extraction_controller.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host=settings.HOST, 
        port=settings.PORT, 
        reload=settings.DEBUG
    )
