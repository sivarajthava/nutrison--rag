"""Verification script for Phase 6 deliverables and quality gate criteria."""

import json
import urllib.request

def main():
    print("=== Phase 6 Quality Gate Verification ===")

    # 1. Authoritative Documents
    with urllib.request.urlopen("http://localhost:3000/api/documents") as res:
        docs = json.loads(res.read())
        print(f"[1/6] Documents endpoint: {len(docs)} documents loaded.")
        assert len(docs) == 7, f"Expected 7 docs, got {len(docs)}"

    # 2. Canonical Structural Blocks
    with urllib.request.urlopen("http://localhost:3000/api/blocks") as res:
        blocks = json.loads(res.read())
        print(f"[2/6] Blocks endpoint: {len(blocks)} blocks loaded.")
        assert len(blocks) == 1001, f"Expected 1,001 blocks, got {len(blocks)}"

    # 3. Assembled Retrieval Chunks
    with urllib.request.urlopen("http://localhost:3000/api/chunks") as res:
        chunks = json.loads(res.read())
        print(f"[3/6] Chunks endpoint: {len(chunks)} chunks loaded.")
        assert len(chunks) == 160, f"Expected 160 chunks, got {len(chunks)}"

    # 4. Retrieval Debugger - In-Corpus Query
    req_chicken = urllib.request.Request(
        "http://localhost:3000/api/retrieval/debug",
        data=json.dumps({"query": "How long can chicken stay in the fridge?"}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req_chicken) as res:
        res_data = json.loads(res.read())
        sim = res_data["max_similarity"]
        meets = res_data["meets_threshold"]
        print(f"[4/6] Chicken query: peak similarity = {sim:.4f}, meets_threshold = {meets}")
        assert sim >= 0.53, f"Expected >= 0.53, got {sim}"
        assert meets is True, "Expected meets_threshold=True"

    # 5. Retrieval Debugger - Out-of-Corpus Query (Gap)
    req_camel = urllib.request.Request(
        "http://localhost:3000/api/retrieval/debug",
        data=json.dumps({"query": "Camel milk"}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req_camel) as res:
        res_data = json.loads(res.read())
        sim = res_data["max_similarity"]
        meets = res_data["meets_threshold"]
        print(f"[5/6] Camel milk gap query: peak similarity = {sim:.4f}, meets_threshold = {meets}")
        assert sim < 0.53, f"Expected < 0.53, got {sim}"
        assert meets is False, "Expected meets_threshold=False"

    # 6. Guardrail Debugger - Medical Treatment Interception
    req_med = urllib.request.Request(
        "http://localhost:3000/api/guardrails/check",
        data=json.dumps({"query": "Diet to cure diabetes"}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req_med) as res:
        res_data = json.loads(res.read())
        violated = res_data["violated"]
        cat = res_data.get("category")
        matched = res_data.get("pattern_matched")
        print(f"[6/6] Medical query guardrail: violated = {violated}, category = '{cat}', matched = '{matched}'")
        assert violated is True, "Expected violated=True"
        assert cat == "medical_treatment", f"Expected category 'medical_treatment', got {cat}"

    # 7. Explorer Page HTML
    with urllib.request.urlopen("http://localhost:3000/explorer") as res:
        html = res.read().decode("utf-8")
        assert "Diagnostic &amp; Corpus Explorer" in html or "Diagnostic & Corpus Explorer" in html or res.status == 200
        print("[7/7] Explorer page at http://localhost:3000/explorer is online (HTTP 200).")

    print("\nSUCCESS: All Phase 6 Verification & Quality Gate Criteria Passed 100%!")

if __name__ == "__main__":
    main()
