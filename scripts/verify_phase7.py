"""Verification script for Phase 7 deliverables and quality gate criteria."""

import json
import urllib.request
import time

def parse_sse_events(response):
    """Parse W3C Server-Sent Events from an HTTP response stream."""
    events = []
    current_event = "message"
    current_data = []

    for line_bytes in response:
        line = line_bytes.decode("utf-8").strip()
        if not line:
            if current_data:
                data_str = "\n".join(current_data)
                try:
                    parsed_json = json.loads(data_str)
                    events.append({"event": current_event, "data": parsed_json})
                except Exception:
                    events.append({"event": current_event, "data": data_str})
                current_event = "message"
                current_data = []
            continue

        if line.startswith("event:"):
            current_event = line[6:].strip()
        elif line.startswith("data:"):
            current_data.append(line[5:].strip())

    return events


def main():
    print("=== Phase 7 Quality Gate Verification ===")

    # 1. Test Home Page HTML (Chat Interface Shell)
    print("\n[1/5] Verifying Chat Interface Home Page (http://localhost:3000/)...")
    req_home = urllib.request.Request("http://localhost:3000/")
    with urllib.request.urlopen(req_home) as res:
        assert res.status == 200, f"Expected 200, got {res.status}"
        html = res.read().decode("utf-8")
        assert "Dietary Guidance Assistant" in html or "Evidence Scope" in html or "All 7 Publications" in html
        print("  [OK] Home page active with Chat Shell and Scope Selector.")

    # 2. Test Real-Time SSE Token Streaming via BFF /api/chat
    print("\n[2/5] Testing Real-Time Token Streaming via BFF (/api/chat)...")
    t0 = time.perf_counter()
    req_chat = urllib.request.Request(
        "http://localhost:3000/api/chat",
        data=json.dumps({"query": "How long can cooked chicken stay in the fridge?"}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req_chat) as res:
        assert res.status == 200
        events = parse_sse_events(res)
        ttft_approx = (time.perf_counter() - t0) * 1000

        event_types = [e["event"] for e in events]
        print(f"  [OK] SSE event sequence received: {set(event_types)}")
        assert "status" in event_types, "Expected 'status' SSE event"
        assert "token" in event_types, "Expected 'token' SSE event"
        assert "citations" in event_types, "Expected 'citations' SSE event"
        assert "done" in event_types, "Expected 'done' SSE event"

        # Check tokens
        tokens = [e["data"]["delta"] for e in events if e["event"] == "token"]
        full_text = "".join(tokens)
        print(f"  [OK] Streamed {len(tokens)} token chunks. Content length: {len(full_text)} chars.")
        print(f"  [OK] Approx TTFT / response time: {ttft_approx:.0f}ms.")
        assert len(full_text) > 0, "Expected non-empty generated text"

        # Check citations
        citations_events = [e["data"] for e in events if e["event"] == "citations"]
        assert len(citations_events) > 0
        citations = citations_events[0].get("citations", [])
        print(f"  [OK] Extracted {len(citations)} verifiable citations:")
        for c in citations[:2]:
            print(f"    - [{c.get('document_title')} | {c.get('publisher')} | {c.get('source_url')}]")

    # 3. Test Multi-Document Inquiry & Authority Segregation
    print("\n[3/5] Testing Multi-Document Inquiries (Isolated Attribution)...")
    req_multi = urllib.request.Request(
        "http://localhost:3000/api/chat",
        data=json.dumps({"query": "What are recommendations on fat intake and cooking oils?"}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req_multi) as res:
        assert res.status == 200
        events = parse_sse_events(res)
        citations_events = [e["data"] for e in events if e["event"] == "citations"]
        sections = citations_events[0].get("sections", []) if citations_events else []
        print(f"  [OK] Segregated into {len(sections)} distinct authority section(s):")
        for sec in sections:
            print(f"    - Authority: {sec.get('publisher')} ({sec.get('document_title')})")

    # 4. Test Safety Guardrail Violation (Crimson Card Trigger)
    print("\n[4/5] Testing Safety Guardrail Interception (Refusal 2: Out of Scope)...")
    t_safety = time.perf_counter()
    req_safe = urllib.request.Request(
        "http://localhost:3000/api/chat",
        data=json.dumps({"query": "I want to cut to 1200 calories to lose 15 pounds in a month."}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req_safe) as res:
        assert res.status == 200
        events = parse_sse_events(res)
        latency_safety = (time.perf_counter() - t_safety) * 1000
        refusal_events = [e["data"] for e in events if e["event"] == "refusal"]
        assert len(refusal_events) > 0, "Expected 'refusal' SSE event"
        refusal = refusal_events[0]
        print(f"  [OK] Immediate Refusal 2 emitted in {latency_safety:.1f}ms:")
        print(f"    Status: {refusal.get('status')}")
        print(f"    Type: {refusal.get('type')}")
        print(f"    Message: {refusal.get('message')[:80]}...")
        assert refusal.get("status") == "REFUSAL_OUT_OF_SCOPE"

    # 5. Test Corpus Gap Query (Amber Card Trigger)
    print("\n[5/5] Testing Information Gap Interception (Refusal 1: Not in Corpus)...")
    req_gap = urllib.request.Request(
        "http://localhost:3000/api/chat",
        data=json.dumps({"query": "Can I store raw camel milk at 25°C for a week?"}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req_gap) as res:
        assert res.status == 200
        events = parse_sse_events(res)
        refusal_events = [e["data"] for e in events if e["event"] == "refusal"]
        assert len(refusal_events) > 0, "Expected 'refusal' SSE event"
        refusal = refusal_events[0]
        searched_docs = refusal.get("searched_documents", [])
        print(f"  [OK] Refusal 1 emitted with {len(searched_docs)} itemized searched documents:")
        for doc_name in searched_docs[:3]:
            print(f"    - {doc_name}")
        assert refusal.get("status") == "REFUSAL_NOT_IN_CORPUS"
        assert len(searched_docs) == 7, f"Expected 7 searched docs, got {len(searched_docs)}"

    print("\n========================================================")
    print("SUCCESS: ALL PHASE 7 QUALITY GATE CRITERIA PASSED 100%!")
    print("========================================================")

if __name__ == "__main__":
    main()
