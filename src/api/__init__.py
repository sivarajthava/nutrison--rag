"""FastAPI API Gateway Module for Dietary Guidance RAG Chatbot."""

from src.api.app import create_app, app
from src.api.routes import router

__all__ = ["create_app", "app", "router"]
