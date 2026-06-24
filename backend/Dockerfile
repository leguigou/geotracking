FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Start both API (uvicorn) and ARQ worker
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips '*' & python -c 'import asyncio; from app.services.scan_queue import create_worker; asyncio.run(create_worker().async_run())' & wait"]
