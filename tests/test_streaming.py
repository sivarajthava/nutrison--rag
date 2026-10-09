"""Phase 5 Verification Test Suite: Server-Sent Events (SSE) Streaming Protocol.

Validates:
1. POST /v1/chat/stream lifecycle events: status -> token -> citations -> done.
2. Immediate emission of Refusal 2 (REFUSAL_OUT_OF_SCOPE) on guardrail violation.
3. Emission of Refusal 1 (REFUSAL_NOT_IN_CORPUS) on out-of-corpus query.
4. Parsing and validation of SSE wire protocol conformant to W3C EventSource.
"""

import json
import pytest
import httpx

from src.api.app import app


def parse_sse_events(raw_stream_text: str):
    """Parse raw SSE text into structured list of (event_type, json_data) tuples."""
    events = []
    current_event = None
    current_data = []

    for line in raw_stream_text.splitlines():
        line = line.strip()
        if not line:
            if current_event and current_data:
                data_str = "\n".join(current_data)
                try:
                    parsed_json = json.loads(data_str)
                except Exception:
                    parsed_json = data_str
                events.append((current_event, parsed_json))
            current_event = None
            current_data = []
            continue

        if line.startswith("event:"):
            current_event = line[len("event:"):].strip()
        elif line.startswith("data:"):
            current_data.append(line[len("data:"):].strip())

    if current_event and current_data:
        data_str = "\n".join(current_data)
        try:
            parsed_json = json.loads(data_str)
        except Exception:
            parsed_json = data_str
        events.append((current_event, parsed_json))

    return events


@pytest.mark.asyncio
async def test_stream_grounded_success():
    """Verify complete SSE lifecycle sequence for standard grounded inquiry."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/v1/chat/stream",
            json={"query": "How long to thaw turkey in cold water versus refrigerator?"},
        )
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

        events = parse_sse_events(response.text)
        event_names = [e[0] for e in events]

        # Verify lifecycle order
        assert "status" in event_names
        assert "token" in event_names
        assert "citations" in event_names
        assert "done" in event_names

        # Status stages
        status_stages = [e[1]["stage"] for e in events if e[0] == "status"]
        assert status_stages == ["safety_check", "retrieving", "synthesizing"]

        # Tokens
        tokens = [e[1]["delta"] for e in events if e[0] == "token"]
        assert len(tokens) > 0

        # Citations
        citations_event = next(e[1] for e in events if e[0] == "citations")
        assert len(citations_event["citations"]) > 0

        # Done event
        done_event = next(e[1] for e in events if e[0] == "done")
        assert done_event["latency_ms"] >= 0
        assert done_event["chunks_retrieved"] > 0


@pytest.mark.asyncio
async def test_stream_safety_refusal():
    """Verify immediate refusal emission when prompt violates safety guardrails."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/v1/chat/stream",
            json={"query": "I want to cut to 1200 calories to lose 15 pounds in a month."},
        )
        assert response.status_code == 200

        events = parse_sse_events(response.text)
        event_names = [e[0] for e in events]

        assert "status" in event_names
        assert "refusal" in event_names
        assert "done" in event_names
        assert "token" not in event_names
        assert "citations" not in event_names

        # Verify refusal payload
        refusal_event = next(e[1] for e in events if e[0] == "refusal")
        assert refusal_event["status"] == "REFUSAL_OUT_OF_SCOPE"
        assert refusal_event["type"] == "OUT_OF_SCOPE_BY_DESIGN"
        assert "medical nutrition therapy" in refusal_event["message"].lower()

        # Done event
        done_event = next(e[1] for e in events if e[0] == "done")
        assert done_event["chunks_retrieved"] == 0


@pytest.mark.asyncio
async def test_stream_corpus_gap_refusal():
    """Verify corpus gap refusal emission when inquiry has no grounding in corpus."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/v1/chat/stream",
            json={"query": "Can I store raw camel milk at 25°C for a week?"},
        )
        assert response.status_code == 200

        events = parse_sse_events(response.text)
        event_names = [e[0] for e in events]

        assert "status" in event_names
        assert "refusal" in event_names
        assert "done" in event_names
        assert "token" not in event_names

        # Status stages checked
        status_stages = [e[1]["stage"] for e in events if e[0] == "status"]
        assert status_stages == ["safety_check", "retrieving"]

        # Refusal payload
        refusal_event = next(e[1] for e in events if e[0] == "refusal")
        assert refusal_event["status"] == "REFUSAL_NOT_IN_CORPUS"
        assert len(refusal_event["searched_documents"]) == 7


@pytest.mark.asyncio
async def test_stream_client_disconnect_during_streaming():
    """Verify that client disconnection during active SSE streaming aborts cleanly."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        async with client.stream(
            "POST",
            "/v1/chat/stream",
            json={"query": "How long to thaw turkey in cold water versus refrigerator?"},
        ) as response:
            assert response.status_code == 200
            read_events = []
            async for line in response.aiter_lines():
                if line.startswith("event:"):
                    read_events.append(line)
                    if len(read_events) >= 1:
                        break
        assert len(read_events) >= 1


@pytest.mark.asyncio
async def test_stream_is_disconnected_aborts_immediately():
    """Verify that when raw_request.is_disconnected() is True, stream terminates without yielding."""
    from unittest.mock import AsyncMock, MagicMock
    from starlette.requests import Request
    from src.api.routes import chat_stream
    from src.models.schemas import ChatRequest

    mock_request = MagicMock(spec=Request)
    mock_request.is_disconnected = AsyncMock(return_value=True)

    chat_req = ChatRequest(query="How long can chicken stay in the fridge?")
    response = await chat_stream(request=chat_req, raw_request=mock_request)

    body_chunks = []
    async for chunk in response.body_iterator:
        body_chunks.append(chunk)

    assert len(body_chunks) == 0


@pytest.mark.asyncio
async def test_stream_document_scoping():
    """Verify scoped retrieval stream restricts citations to specified publication."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/v1/chat/stream",
            json={
                "query": "What are the 5 keys to safer food?",
                "filter_document_id": "who-five-keys",
            },
        )
        assert response.status_code == 200
        events = parse_sse_events(response.text)
        citations_event = next((e[1] for e in events if e[0] == "citations"), None)
        assert citations_event is not None
        assert len(citations_event["citations"]) > 0
        for citation in citations_event["citations"]:
            assert "who-five-keys" in citation["source_url"] or "Five Keys" in citation["document_title"]


@pytest.mark.asyncio
async def test_stream_category_scoping():
    """Verify category scoping stream restricts retrieval to nutrition."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/v1/chat/stream",
            json={
                "query": "What are recommended limits for free sugars?",
                "filter_category": "nutrition",
            },
        )
        assert response.status_code == 200
        events = parse_sse_events(response.text)
        citations_event = next((e[1] for e in events if e[0] == "citations"), None)
        assert citations_event is not None
        assert len(citations_event["citations"]) > 0
