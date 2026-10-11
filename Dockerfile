# Multi-stage Production Dockerfile for Dietary Guidance RAG FastAPI Service
# Targeted for Railway Cloud Deployment

# Stage 1: Build Dependencies
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build dependencies for compiled packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install dependencies into local user wheel cache
RUN pip install --no-cache-dir --user -r requirements.txt

# Pre-download embedding model weights during build for strict offline runtime
ENV PATH=/root/.local/bin:$PATH
RUN python -c "from sentence_transformers import SentenceTransformer; m = SentenceTransformer('all-MiniLM-L6-v2'); m.save('/build/models/all-MiniLM-L6-v2')"


# Stage 2: Production Minimal Runtime
FROM python:3.11-slim AS runner

WORKDIR /app

# Install curl for Docker/Railway healthcheck probes
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Strict offline flags preventing runtime model downloads or HuggingFace telemetry
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1
ENV ENVIRONMENT=production

# Copy application configuration, pre-parsed data, vector index, and source code
COPY config/ ./config/
COPY data/ ./data/
COPY src/ ./src/

# Ensure pre-downloaded offline embedding model weights are in place
COPY --from=builder /build/models/ /app/data/models/

# Railway dynamically injects $PORT at runtime (defaults to 8000)
ENV PORT=8000
EXPOSE 8000

# Container healthcheck probe against FastAPI /v1/health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/v1/health || exit 1

# Launch uvicorn listening on 0.0.0.0 and dynamic $PORT
CMD ["sh", "-c", "uvicorn src.api.app:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2"]
