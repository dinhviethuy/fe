import os
from dotenv import load_dotenv

load_dotenv()

# Tự động chuyển đổi các đường dẫn tương đối trong file .env thành đường dẫn tuyệt đối
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for env_var in ["GOOGLE_APPLICATION_CREDENTIALS", "POPPLER_PATH"]:
    val = os.getenv(env_var, "")
    if val and not os.path.isabs(val):
        os.environ[env_var] = os.path.abspath(os.path.join(project_root, val))

class Settings:
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "Table Extractor API")
    MAX_CONCURRENT_WORKERS: int = int(os.getenv("MAX_CONCURRENT_WORKERS", "5"))
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "3000"))
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    
    # Cấu hình Google Document AI
    GCP_PROJECT_ID: str = os.getenv("GCP_PROJECT_ID", "your-gcp-project-id")
    GCP_LOCATION: str = os.getenv("GCP_LOCATION", "us")
    GCP_PROCESSOR_ID: str = os.getenv("GCP_PROCESSOR_ID", "your-processor-id") # ID của Form Parser Model
    POPPLER_PATH: str = os.getenv("POPPLER_PATH", "")

settings = Settings()
