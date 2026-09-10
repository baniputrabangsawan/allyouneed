# BACKEND-REVISI.md — ALL-IN-ONE UTILITY WEB APP

## ROLE

Bertindak sebagai **Senior Backend Engineer, Python Architect, Distributed Systems Engineer, Media Processing Engineer, AI Inference Engineer, dan API Designer**.

Bangun backend production-ready untuk **All-in-One Utility Web App** yang menangani:

- Image
- PDF
- Audio
- Video
- QR/QRIS
- OCR
- Speech to Text
- Text to Speech
- Background Removal
- AI Upscale
- Computer Vision
- Tool processing lainnya

Fokus **hanya backend**. Frontend diasumsikan menggunakan TanStack Start + React + TypeScript.

Backend harus modular, scalable, typed, privacy-first, resource-efficient, observable, dan tidak menggunakan AI untuk tugas deterministic.

---

# 1. TECH STACK

Gunakan:

```text
Language
Python 3.12+

API
FastAPI

Validation
Pydantic v2

ASGI Server
Uvicorn

Package Manager
uv

ORM
SQLAlchemy 2 Async

Database Driver
asyncpg

Migration
Alembic

Database
PostgreSQL

Queue
Dramatiq

Broker / Cache
Redis

Object Storage
Cloudflare R2 / S3-compatible

Image Processing
pyvips / libvips
Pillow
OpenCV

PDF
PyMuPDF
pikepdf

Audio / Video
FFmpeg
ffprobe

OCR
PaddleOCR
Tesseract fallback

Speech to Text
faster-whisper

Text to Speech
Kokoro / Piper

Background Removal
BiRefNet / rembg

AI Upscale
Real-ESRGAN

AI Runtime
ONNX Runtime
PyTorch jika diperlukan

HTTP Client
httpx

Logging
structlog

Monitoring
Sentry
OpenTelemetry-ready

Testing
pytest
pytest-asyncio
httpx

Quality
Ruff
mypy

Deployment
Docker
```

Jangan gunakan Node.js sebagai backend utama.

---

# 2. ARSITEKTUR UTAMA

Gunakan:

```text
Frontend
   |
   v
FastAPI
   |
   +--> Synchronous Processing
   |
   +--> Job Service
           |
           v
         Redis
           |
           v
       Dramatiq
           |
      +----+----------------------+
      |            |             |
      v            v             v
Image/PDF       Media           AI
Worker          Worker          Worker
      |            |             |
      +------------+-------------+
                   |
                   v
             Cloudflare R2
```

Gunakan:

```text
PostgreSQL
→ metadata durable

Redis
→ queue, cache, progress, temporary state

R2
→ actual user files
```

Jangan simpan file binary di PostgreSQL atau Redis.

---

# 3. PROCESSING RULE

Pisahkan processing berdasarkan beban.

## Client-side, tidak perlu backend

```text
QR generation
JSON formatter
Base64
UUID
basic text tools
basic image crop
rotate
simple resize
watermark
```

## Backend synchronous

Untuk proses kecil dan cepat:

```text
image metadata
small image conversion
small image resize
simple file inspection
```

## Background job

Gunakan worker untuk:

```text
video
large audio
large PDF
OCR
Speech to Text
Text to Speech berat
Background Removal
AI Upscale
large batch
AI inference
```

Jangan menjalankan proses berat langsung dalam HTTP request.

---

# 4. STRUKTUR PROJECT

```text
apps/
└── api/
    ├── app/
    │   ├── main.py
    │   │
    │   ├── api/
    │   │   ├── deps.py
    │   │   └── v1/
    │   │       ├── router.py
    │   │       ├── health.py
    │   │       ├── jobs.py
    │   │       ├── uploads.py
    │   │       ├── downloads.py
    │   │       ├── image.py
    │   │       ├── pdf.py
    │   │       ├── audio.py
    │   │       ├── video.py
    │   │       └── ai.py
    │   │
    │   ├── core/
    │   │   ├── config.py
    │   │   ├── logging.py
    │   │   ├── exceptions.py
    │   │   └── enums.py
    │   │
    │   ├── schemas/
    │   ├── services/
    │   ├── processors/
    │   │   ├── image/
    │   │   ├── pdf/
    │   │   ├── audio/
    │   │   ├── video/
    │   │   ├── ocr/
    │   │   └── ai/
    │   │
    │   ├── providers/
    │   │   ├── storage/
    │   │   ├── stt/
    │   │   ├── tts/
    │   │   ├── background_removal/
    │   │   └── upscale/
    │   │
    │   ├── workers/
    │   ├── repositories/
    │   ├── db/
    │   └── utils/
    │
    ├── tests/
    ├── Dockerfile
    ├── pyproject.toml
    └── uv.lock
```

---

# 5. LAYERING

Gunakan:

```text
API Route
↓
Service
↓
Processor / Provider
↓
Infrastructure
```

Route hanya:

```text
validate request
authorize jika diperlukan
call service
return response
```

Jangan memasukkan logic OpenCV, FFmpeg, Redis, SQL, R2, atau AI langsung ke route.

---

# 6. PROCESSOR ABSTRACTION

Semua processor harus mengikuti interface konsisten.

```python
class Processor(ABC):

    @abstractmethod
    async def process(
        self,
        input_data,
        *,
        context,
    ):
        ...
```

Processor tidak boleh mengetahui HTTP request.

Gunakan central registry:

```python
processor_registry = {
    "compress-image": CompressImageProcessor,
    "resize-image": ResizeImageProcessor,
    "convert-image": ConvertImageProcessor,
    "merge-pdf": MergePdfProcessor,
    "video-compressor": VideoCompressProcessor,
    "speech-to-text": SpeechToTextProcessor,
    "remove-background": BackgroundRemovalProcessor,
}
```

Jangan gunakan chain `if/elif` panjang.

---

# 7. BACKEND TOOL REGISTRY

Setiap tool memiliki:

```text
id
execution_mode
processor
queue
accepted_mimes
output_mimes
max_file_size
max_files
timeout
enabled
requires_auth
premium
```

Execution mode:

```text
local-only
sync
async
disabled
```

Tool baru idealnya cukup menambahkan:

```text
schema
processor
registry entry
tests
```

---

# 8. API VERSIONING

Gunakan:

```text
/api/v1
```

Minimal endpoint:

```text
GET    /api/v1/health/live
GET    /api/v1/health/ready

POST   /api/v1/jobs
GET    /api/v1/jobs/{job_id}
DELETE /api/v1/jobs/{job_id}
GET    /api/v1/jobs/{job_id}/result

POST   /api/v1/uploads/presign
POST   /api/v1/uploads/complete
```

Optional:

```text
GET /api/v1/jobs/{job_id}/events
```

Gunakan SSE untuk progress realtime jika diperlukan.

---

# 9. JOB SYSTEM

Status:

```text
queued
processing
completed
failed
cancelled
expired
```

State transition:

```text
queued → processing → completed
queued → cancelled
processing → failed
processing → cancelled
completed → expired
```

Jangan izinkan transition sembarang.

Create async job:

```text
HTTP 202 Accepted
```

Contoh:

```json
{
  "data": {
    "jobId": "job_xxx",
    "status": "queued"
  }
}
```

---

# 10. JOB PROGRESS

Response:

```json
{
  "data": {
    "jobId": "job_xxx",
    "status": "processing",
    "progress": 62,
    "stage": "encoding"
  }
}
```

Stage umum:

```text
validating
downloading
decoding
processing
encoding
uploading
finalizing
```

Jangan membuat fake progress.

Jika progress tidak dapat dihitung:

```text
progress = null
```

---

# 11. JOB CANCELLATION

```text
DELETE /api/v1/jobs/{job_id}
```

Harus:

```text
mark cancellation requested
cancel pending worker
terminate subprocess jika memungkinkan
cleanup partial output
update status
```

Gunakan cooperative cancellation.

---

# 12. IDEMPOTENCY

Support:

```text
Idempotency-Key
```

untuk job berat.

Retry request yang sama tidak boleh membuat processing job duplikat.

---

# 13. QUEUE

Gunakan:

```text
Dramatiq + Redis
```

Pisahkan queue:

```text
image
pdf
audio
video
ocr
stt
tts
ai-image
```

Queue payload hanya:

```text
job_id
storage_key
tool_id
options reference
```

Jangan mengirim image/video/PDF bytes melalui Redis.

---

# 14. WORKERS

Pisahkan worker berdasarkan workload:

```text
Image Worker
PDF Worker
Media Worker
OCR Worker
STT Worker
TTS Worker
AI Image Worker
```

Concurrency:

```text
Image
→ relatif tinggi

PDF
→ medium

FFmpeg
→ rendah

GPU AI
→ 1–2 concurrent jobs per GPU sebagai default konservatif
```

Jangan menggunakan concurrency tak terbatas.

---

# 15. RETRY

Retry hanya transient error:

```text
network timeout
R2 temporary error
provider 503
temporary Redis failure
```

Jangan retry:

```text
invalid file
unsupported format
quota exceeded
invalid user input
```

Gunakan exponential backoff + jitter dengan jumlah retry terbatas.

---

# 16. FILE UPLOAD

File kecil:

```text
multipart
↓
FastAPI
```

File besar:

```text
Browser
↓
request presigned URL
↓
upload langsung ke R2
↓
complete upload
↓
create job
```

Jangan menjadikan FastAPI bandwidth proxy untuk file besar.

---

# 17. STORAGE

Production:

```text
Cloudflare R2
```

Development:

```text
local temporary storage
```

Gunakan abstraction:

```python
class StorageProvider(Protocol):
    async def create_upload_url(...): ...
    async def create_download_url(...): ...
    async def exists(...): ...
    async def delete(...): ...
```

Business logic tidak boleh tergantung langsung pada boto3.

---

# 18. STORAGE KEY

Gunakan random ID:

```text
uploads/{date}/{random-id}
results/{date}/{job-id}/{random-id}
```

Jangan menggunakan filename asli sebagai object key utama.

---

# 19. FILE LIFECYCLE

```text
Upload
↓
Process
↓
Result
↓
Download
↓
Automatic Delete
```

Default:

```env
FILE_TTL_SECONDS=3600
```

Cleanup:

```text
on success
on failure
on cancellation
scheduled cleanup
```

---

# 20. SIGNED DOWNLOAD

Result endpoint mengembalikan signed URL.

Contoh:

```json
{
  "filename": "photo-no-bg.png",
  "contentType": "image/png",
  "size": 123456,
  "downloadUrl": "...",
  "expiresAt": "..."
}
```

Signed URL:

```text
5–15 menit
```

File result storage:

```text
sekitar 1 jam
```

---

# 21. FILE VALIDATION

Semua upload dianggap untrusted.

Validasi:

```text
MIME
extension
magic bytes
size
file count
tool compatibility
dimensions
page count
duration
```

Jangan percaya `Content-Type` browser saja.

---

# 22. TEMP FILES

Setiap job memiliki folder sendiri:

```text
/tmp/utility/job_xxx/
```

Gunakan generated filenames.

Jangan memakai raw client filename sebagai filesystem path.

Cleanup setelah processing selesai.

---

# 23. SUBPROCESS SAFETY

Untuk FFmpeg/system tools:

```python
args = [
    "ffmpeg",
    "-i",
    input_path,
]
```

Jangan gunakan:

```python
shell=True
```

Jangan izinkan raw command/flag user diteruskan langsung ke shell.

---

# 24. IMAGE PROCESSING

Prioritas:

```text
pyvips
↓
Pillow
↓
OpenCV
```

Gunakan pyvips untuk:

```text
resize
compression
conversion
thumbnail
large images
```

Gunakan Pillow untuk:

```text
watermark
metadata
drawing
simple transformations
```

Gunakan OpenCV untuk:

```text
face detection
blur face
computer vision
image enhancement
document scanner
```

---

# 25. IMAGE SAFETY

Sebelum decode penuh, validasi:

```text
dimensions
pixel count
estimated memory
```

Gunakan konfigurasi:

```text
MAX_IMAGE_PIXELS
```

untuk mencegah decompression bomb dan OOM.

---

# 26. IMAGE FORMAT

Support minimum:

```text
JPEG
PNG
WebP
AVIF
```

Optional bila runtime mendukung:

```text
HEIC
TIFF
GIF
SVG
```

Jangan advertise format yang build libvips tidak dukung.

---

# 27. PDF

Gunakan:

```text
PyMuPDF
pikepdf
```

Support:

```text
inspect
merge
split
rotate
delete pages
reorder
extract
render
image to PDF
watermark
page numbers
metadata
text extraction
```

Large PDF harus background job.

---

# 28. OCR

Default:

```text
PaddleOCR
```

Fallback:

```text
Tesseract
```

Gunakan provider abstraction.

OCR berat dijalankan melalui dedicated worker.

Return minimal:

```text
full text
per-page text
optional bounding boxes
```

---

# 29. SPEECH TO TEXT

Gunakan:

```text
faster-whisper
```

Jalankan pada dedicated STT worker.

Model lifecycle:

```text
worker startup
↓
load model once
↓
reuse untuk banyak job
```

Jangan load model untuk setiap request.

Support:

```text
language
auto detect
timestamps
VAD
```

Return:

```json
{
  "language": "id",
  "duration": 120.5,
  "text": "...",
  "segments": [
    {
      "start": 0.0,
      "end": 3.8,
      "text": "..."
    }
  ]
}
```

---

# 30. TEXT TO SPEECH

Gunakan provider abstraction.

Default self-hosted:

```text
Kokoro
atau
Piper
```

Expose stable options:

```text
text
language
voice
speed
format
```

Jangan advertise parameter yang engine tidak support.

---

# 31. BACKGROUND REMOVAL

Gunakan provider:

```text
BiRefNet
rembg
```

Default:

```text
self-hosted
```

Pipeline:

```text
download
↓
decode
↓
normalize
↓
inference
↓
mask
↓
postprocess
↓
encode
↓
upload result
```

Output utama:

```text
PNG dengan alpha transparency
```

---

# 32. AI UPSCALE

Gunakan:

```text
Real-ESRGAN
```

Support:

```text
2x
4x
```

Untuk image besar gunakan:

```text
tile processing
```

agar GPU/CPU memory tidak habis.

---

# 33. AI PROVIDER ABSTRACTION

Gunakan interface:

```text
SpeechToTextProvider
TextToSpeechProvider
BackgroundRemovalProvider
UpscaleProvider
OcrProvider
```

Provider dipilih melalui config:

```env
STT_PROVIDER=selfhosted
TTS_PROVIDER=selfhosted
BACKGROUND_REMOVAL_PROVIDER=selfhosted
UPSCALE_PROVIDER=selfhosted
```

Frontend tidak boleh bergantung pada nama model/provider.

---

# 34. AI COST STRATEGY

Gunakan:

```text
deterministic task
→ non-AI

AI task
→ self-hosted open-source

external AI API
→ optional premium/fallback
```

Jangan gunakan AI API berbayar jika proses dapat diselesaikan lokal atau self-hosted.

---

# 35. MODEL MANAGEMENT

Model harus:

```text
load sekali saat worker startup
reuse antar job
pin version
pin checksum jika relevan
cache weights
```

Jangan download model besar pada setiap container startup production.

---

# 36. CPU / GPU

Support:

```text
CPU
CUDA
```

melalui konfigurasi.

Pisahkan:

```text
API container
CPU workers
GPU AI workers
```

Jangan membuat semua container memakai CUDA.

---

# 37. FFMPEG

Gunakan:

```text
FFmpeg
ffprobe
```

Untuk:

```text
audio conversion
video conversion
compression
trim
merge
resize
crop
rotate
extract audio
thumbnail
subtitle
metadata
```

Gunakan `ffprobe` sebagai sumber metadata media.

---

# 38. VIDEO PROGRESS

Gunakan progress FFmpeg sebenarnya.

Contoh:

```text
-progress pipe:1
```

Hitung berdasarkan:

```text
processed_time / total_duration
```

Jika durasi tidak diketahui:

```text
progress = null
```

---

# 39. VIDEO OUTPUT VALIDATION

Sebelum job dinyatakan completed:

```text
ffprobe output
verify valid stream
verify duration
verify container
```

Jangan hanya mengecek file ada.

---

# 40. RESOURCE LIMITS

Setiap tool harus mempunyai:

```text
max file size
max files
max dimensions
max page count
max media duration
timeout
concurrency limit
```

Gunakan resource limits juga pada Docker/worker.

Jangan hanya mengandalkan application validation.

---

# 41. MEMORY MANAGEMENT

Jangan membaca file sangat besar seluruhnya ke RAM jika dapat di-stream.

Untuk:

```text
large video
large audio
large PDF
```

gunakan streaming/temp file.

Reject processing lebih awal jika estimasi resource terlalu besar.

---

# 42. JOB TIMEOUT

Setiap kategori memiliki timeout configurable.

Contoh:

```text
Image
60 detik

PDF
120 detik

Video
600 detik

STT
900 detik
```

Jika timeout:

```text
terminate process
cleanup
mark failed
```

---

# 43. JOB RECOVERY

Jika worker mati:

```text
job tidak boleh selamanya processing
```

Gunakan:

```text
heartbeat
stalled job detection
retry/fail policy
```

---

# 44. REQUEST ID

Setiap request memiliki:

```text
X-Request-ID
```

Gunakan dalam:

```text
logs
error response
job metadata
```

Hubungkan:

```text
request_id
job_id
user_id
tool_id
```

---

# 45. ERROR RESPONSE

Gunakan format konsisten:

```json
{
  "error": {
    "code": "INVALID_FILE",
    "message": "The uploaded file is invalid.",
    "requestId": "req_xxx"
  }
}
```

Error codes:

```text
VALIDATION_ERROR
INVALID_FILE
UNSUPPORTED_FORMAT
FILE_TOO_LARGE
TOO_MANY_FILES

JOB_NOT_FOUND
JOB_CANCELLED
JOB_TIMEOUT
JOB_FAILED

PROCESSING_FAILED
OUT_OF_MEMORY

RATE_LIMITED
QUOTA_EXCEEDED

STORAGE_ERROR
UPLOAD_FAILED
DOWNLOAD_EXPIRED

SERVICE_UNAVAILABLE
INTERNAL_ERROR
```

Jangan expose stack trace atau internal path kepada user.

---

# 46. HTTP STATUS

Gunakan semantic HTTP status:

```text
200 OK
201 Created
202 Accepted
204 No Content

400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
413 Payload Too Large
415 Unsupported Media Type
422 Validation Error
429 Too Many Requests

500 Internal Server Error
503 Service Unavailable
```

---

# 47. SETTINGS

Gunakan:

```text
pydantic-settings
```

Contoh `.env.example`:

```env
APP_ENV=development
APP_NAME=utility-api

DATABASE_URL=
REDIS_URL=redis://localhost:6379/0

R2_ENDPOINT_URL=
R2_BUCKET=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=

FILE_TTL_SECONDS=3600
MAX_UPLOAD_MB=100
MAX_BATCH_FILES=20

DEFAULT_JOB_TIMEOUT_SECONDS=300

ENABLE_SELF_HOSTED_AI=true
ENABLE_EXTERNAL_AI=false

STT_PROVIDER=selfhosted
TTS_PROVIDER=selfhosted
BACKGROUND_REMOVAL_PROVIDER=selfhosted
UPSCALE_PROVIDER=selfhosted

SENTRY_DSN=
```

Jangan hardcode secret.

---

# 48. DATABASE ACCESS

Gunakan:

```text
SQLAlchemy 2 async
asyncpg
Alembic
```

Repository layer menangani query.

Database hanya menyimpan metadata seperti:

```text
job
user
usage
quota
subscription
file metadata
timestamps
```

Jangan menyimpan file binary.

Database detail akan dibahas terpisah dalam `database.md`.

---

# 49. REDIS

Gunakan Redis untuk:

```text
Dramatiq broker
job progress
cache
rate limit
idempotency
temporary locks
ephemeral state
```

Jangan gunakan Redis sebagai durable file store.

---

# 50. LOGGING

Gunakan:

```text
structlog
```

Production log berbentuk JSON.

Fields:

```text
timestamp
level
service
request_id
job_id
tool_id
duration_ms
status
error_code
```

Jangan log:

```text
file content
raw QR payload
transcript content
TTS text
password
JWT
API key
authorization header
signed URL penuh
```

---

# 51. MONITORING

Gunakan:

```text
Sentry
OpenTelemetry-ready
```

Track:

```text
request count
request latency
job count
job duration
job failure rate
queue depth
worker utilization
storage errors
processing duration
```

Jangan track user file content.

---

# 52. HEALTH CHECK

Gunakan:

```text
GET /api/v1/health/live
GET /api/v1/health/ready
```

`live`:

```text
service process hidup
```

`ready`:

```text
critical dependency tersedia
```

---

# 53. FASTAPI LIFESPAN

Gunakan lifespan untuk:

```text
initialize shared HTTP client
Redis pool
database engine
lightweight provider
clean shutdown
```

Jangan load AI model besar di main API process.

---

# 54. STATELESS API

FastAPI harus stateless.

Jangan menyimpan secara permanen:

```text
job state
uploads
results
session
```

di local disk API container.

Local disk hanya untuk temporary processing.

---

# 55. DEPLOYMENT

Production:

```text
Cloudflare
   |
   v
Frontend
   |
   v
Reverse Proxy / API Gateway
   |
   v
FastAPI replicas
   |
   +--> PostgreSQL
   +--> Redis
   +--> R2
   |
   v
Workers
   ├── Image/PDF
   ├── Media
   ├── OCR/STT
   └── AI
```

API dan worker harus dapat diskalakan terpisah.

---

# 56. DOCKER

Pisahkan image:

```text
API image
Media worker image
AI worker image
```

API image jangan memuat:

```text
large AI models
CUDA runtime
dependency berat yang tidak dipakai
```

AI worker dapat memiliki versi:

```text
CPU
GPU/CUDA
```

---

# 57. TESTING

Gunakan:

```text
pytest
pytest-asyncio
httpx
```

Test minimal:

```text
health
job creation
job status
job cancellation
invalid payload
unsupported format
file validation
processor registry
job state machine
image resize
image conversion
PDF basic processing
ffprobe
storage abstraction
```

AI model besar tidak perlu dijalankan pada setiap unit test.

Gunakan mock provider untuk unit test.

---

# 58. QUALITY VALIDATION

Sebelum menyatakan backend selesai jalankan:

```bash
uv sync
uv run ruff check .
uv run ruff format --check .
uv run mypy app
uv run pytest
docker build -t utility-api .
```

Jika menggunakan compose:

```bash
docker compose config
```

Jangan menyatakan selesai sebelum validation berhasil.

---

# 59. IMPLEMENTATION PHASES

## Phase 1 — Foundation

```text
FastAPI
Pydantic
settings
logging
exceptions
health
API v1
SQLAlchemy session
Redis
storage abstraction
tool registry
```

## Phase 2 — Job Infrastructure

```text
job schema
job repository
job service
state machine
Dramatiq
progress
cancellation
SSE/polling
```

## Phase 3 — File Infrastructure

```text
presigned upload
upload complete
file validation
temporary storage
signed download
cleanup
```

## Phase 4 — Basic Processing

```text
image metadata
resize
convert
PDF inspect
PDF merge
ffprobe
audio conversion
```

## Phase 5 — Media

```text
video compression
video conversion
audio extraction
thumbnail
progress
timeout
```

## Phase 6 — AI

```text
background removal
Speech to Text
AI Upscale
OCR
TTS
```

## Phase 7 — Production Hardening

```text
metrics
monitoring
stalled-job recovery
resource limits
load testing
deployment
```

---

# 60. IMPLEMENTATION RULES

Wajib:

```text
No fake AI
No fake progress
No large binary in Redis
No file binary in PostgreSQL
No shell=True
No raw FFmpeg flags from users
No long CPU job in HTTP route
No blocking event loop
No unbounded concurrency
No hardcoded AI provider
No hardcoded secrets
No trusting frontend validation
No permanent file storage by default
```

---

# 61. FINAL BACKEND ARCHITECTURE

```text
Frontend
TanStack Start
      |
      v
FastAPI API
      |
      +--------------------------+
      |                          |
      v                          v
PostgreSQL                     Redis
                                 |
                                 v
                              Dramatiq
                                 |
            +--------------------+--------------------+
            |                    |                    |
            v                    v                    v
        Image/PDF             Media               AI Workers
          Worker              Worker                  |
            |                  |                     |
         pyvips              FFmpeg       Whisper / BiRefNet /
         Pillow              ffprobe      Real-ESRGAN / OCR / TTS
         PyMuPDF
            |                  |                     |
            +------------------+---------------------+
                               |
                               v
                         Cloudflare R2
```

---

# 62. FINAL BACKEND STACK

```text
Backend Framework
FastAPI

Language
Python 3.12+

Validation
Pydantic v2

Server
Uvicorn

Package Manager
uv

ORM
SQLAlchemy 2 Async

Driver
asyncpg

Migration
Alembic

Queue
Dramatiq

Broker / Cache
Redis

Storage
Cloudflare R2

Image
pyvips
Pillow
OpenCV

PDF
PyMuPDF
pikepdf

Audio / Video
FFmpeg
ffprobe

OCR
PaddleOCR
Tesseract fallback

Speech to Text
faster-whisper

Text to Speech
Kokoro / Piper

Background Removal
BiRefNet / rembg

Upscale
Real-ESRGAN

AI Runtime
ONNX Runtime
PyTorch bila diperlukan

HTTP
httpx

Logging
structlog

Monitoring
Sentry
OpenTelemetry-ready

Testing
pytest
pytest-asyncio
httpx

Quality
Ruff
mypy

Deployment
Docker
```

---

# 63. CORE PRINCIPLE

Bangun backend sebagai **modular processing platform**, bukan sekadar kumpulan endpoint.

Gunakan prinsip:

```text
FastAPI sebagai API/orchestration layer
+
Dramatiq worker untuk pekerjaan berat
+
Redis untuk broker/cache/progress
+
PostgreSQL untuk metadata durable
+
Cloudflare R2 untuk file
+
Python processing ecosystem
+
Provider abstraction untuk AI
+
Self-hosted AI sebagai default
+
No unnecessary AI
+
No unnecessary backend processing
+
Explicit job state
+
Bounded resource usage
+
Privacy-first temporary file lifecycle
```

Setiap backend tool baru harus dapat ditambahkan melalui **schema + processor/provider + registry + tests** tanpa merusak fondasi sistem.
