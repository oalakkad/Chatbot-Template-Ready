import os
import sys
import json
import asyncio
import time
import random
from typing import List

# Add backend to path
sys.path.append(os.getcwd())

from database import SessionLocal
from models_db import Document as DocumentModel
from knowledge_base import async_openai_client, index, search_pinecone, generate_answer_stream

async def get_filenames():
    db = SessionLocal()
    try:
        docs = db.query(DocumentModel).all()
        return [d.filename for d in docs]
    finally:
        db.close()

async def generate_complicated_questions(count: int = 30) -> List[str]:
    print(f"[GEN] Generating {count} complicated questions across all docs...")
    fnames = await get_filenames()
    if not fnames: return []
    
    # Sample context from all docs to inspire cross-questions
    context_samples = []
    for fn in fnames[:5]: # Sample up to 5 docs
        res = index.query(vector=[0.1]*512, filter={"source": fn}, top_k=5, include_metadata=True)
        context_samples.append(f"DOC: {fn}\nCONTENT: " + "\n".join([m.metadata.get("text", "")[:300] for m in res.matches]))
    
    all_context = "\n\n".join(context_samples)
    
    resp = await async_openai_client.chat.completions.create(
        model="gpt-4o", # Use strong model to generate "complicated" questions
        messages=[
            {"role": "system", "content": f"""Generate {count} COMPLICATED corporate policy questions.
A complicated question:
1. Might involve specific conditions (e.g. 'What happens if X happens after 2pm on a Tuesday?').
2. Might ask for a technical breakdown of a process.
3. Might cross-reference multiple aspects of a policy.
4. NO intro/outro. One question per line. No numbers."""},
            {"role": "user", "content": f"CONTEXT SAMPLES:\n{all_context}"}
        ],
        temperature=0.8
    )
    lines = resp.choices[0].message.content.strip().split("\n")
    return [l.strip("- ").strip("1234567890. ").strip() for l in lines if l.strip()][:count]

async def audit_response(question, answer, context):
    """
    LLM Auditor to score the response.
    """
    resp = await async_openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": """You are an ELITE Audit Officer. Score the AI response out of 10 based on:
1. ACCURACY (5 pts): Is it 1:1 with the context? No hallucinations?
2. CONCISENESS (3 pts): Did it add filler like 'Next Steps' or 'Hope this helps'? (-3 if it added 'Next Steps')
3. FORMATTING (2 pts): Is it clean and simple?

Output ONLY a JSON: {"score": X, "reasoning": "...", "added_filler": true/false}"""},
            {"role": "user", "content": f"QUERY: {question}\nCONTEXT: {context}\nAI_ANSWER: {answer}"}
        ],
        response_format={"type": "json_object"},
        temperature=0
    )
    return json.loads(resp.choices[0].message.content)

async def audit_response(question, answer, context):
    """
    LLM Auditor to score the response with RETRIES.
    """
    for attempt in range(5):
        try:
            resp = await async_openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": """You are an ELITE Audit Officer. Score the AI response out of 10 based on:
1. ACCURACY (5 pts): Is it 1:1 with the context? No hallucinations?
2. CONCISENESS (3 pts): Did it add filler like 'Next Steps' or 'Hope this helps'? (-3 if it added 'Next Steps')
3. FORMATTING (2 pts): Is it clean and simple?

Output ONLY a JSON: {"score": X, "reasoning": "...", "added_filler": true/false}"""},
                    {"role": "user", "content": f"QUERY: {question}\nCONTEXT: {context}\nAI_ANSWER: {answer}"}
                ],
                response_format={"type": "json_object"},
                temperature=0,
                timeout=30
            )
            return json.loads(resp.choices[0].message.content)
        except Exception as e:
            if "429" in str(e) and attempt < 4:
                wait = (attempt + 1) * 10
                print(f"  [!] Auditor rate limited. Waiting {wait}s...")
                await asyncio.sleep(wait)
            else:
                raise e

async def process_question(semaphore, i, q, total, completed_questions):
    if q in completed_questions:
        return None # already done
        
    async with semaphore:
        for attempt in range(3):
            try:
                start_time = time.time()
                print(f"[{i+1}/{total}] Running: {q[:60]}...")
                
                full_answer = ""
                context = await search_pinecone(q)
                if context:
                    async for chunk in generate_answer_stream(q, context):
                        full_answer += chunk
                else:
                    full_answer = "No relevant context found."
                    
                latency = time.time() - start_time
                voice_latency_est = latency + 3.5 
                
                audit = await audit_response(q, full_answer, context)
                
                result = {
                    "id": i + 1,
                    "question": q,
                    "answer": full_answer,
                    "latency_text": round(latency, 2),
                    "latency_voice_est": round(voice_latency_est, 2),
                    "score": audit["score"],
                    "added_filler": audit["added_filler"],
                    "reasoning": audit["reasoning"]
                }
                
                with open("audit_v2_partial.json", "a", encoding="utf-8") as f:
                    f.write(json.dumps(result, ensure_ascii=False) + "\n")
                
                return result
            except Exception as e:
                if "429" in str(e) and attempt < 2:
                    wait = 20 * (attempt + 1)
                    print(f"  [!] RAG rate limited on {i+1}. Waiting {wait}s...")
                    await asyncio.sleep(wait)
                else:
                    print(f"  [!] Error on {i+1}: {e}")
                    return None

async def run_audit():
    # Load completed
    completed_questions = {}
    if os.path.exists("audit_v2_partial.json"):
        with open("audit_v2_partial.json", "r", encoding="utf-8") as f:
            for line in f:
                try:
                    d = json.loads(line)
                    completed_questions[d["question"]] = d
                except: pass
    
    # Generate questions (Deterministic if we use same prompt/seed, but we just generate new ones if needed)
    # Actually, for consistency, let's try to keep them.
    questions = await generate_complicated_questions(30)
    print(f"[AUDIT] Starting God-Tier Stress Test for {len(questions)} queries. (Already Done: {len(completed_questions)})")
    
    semaphore = asyncio.Semaphore(2) # Reduced for safety
    tasks = [process_question(semaphore, i, q, len(questions), completed_questions) for i, q in enumerate(questions)]
    results_raw = await asyncio.gather(*tasks)
    
    # Merge results
    all_results = []
    if os.path.exists("audit_v2_partial.json"):
        with open("audit_v2_partial.json", "r", encoding="utf-8") as f:
            for line in f:
                try: all_results.append(json.loads(line))
                except: pass
    
    if not all_results: return

    # Final Report
    total_score = sum(r["score"] for r in all_results)
    avg_score = total_score / len(all_results)
    avg_latency = sum(r["latency_text"] for r in all_results) / len(all_results)
    filler_count = sum(1 for r in all_results if r["added_filler"])
    
    report_path = "Surgical_Precision_Audit_V2.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# Surgical Precision Audit V2 - Final Report\n\n")
        f.write(f"## OVERALL SCORE: {avg_score:.1f}/10\n")
        f.write(f"- **Avg Text Latency:** {avg_latency:.2f}s\n")
        f.write(f"- **Avg Voice Latency (Est):** {(avg_latency + 3.5):.2f}s\n")
        f.write(f"- **Hallucination/Filler Rate:** {filler_count}/{len(all_results)}\n\n")
        f.write("## Detailed Results\n\n")
        
        for r in all_results:
            status = "✅ PASS" if r["score"] >= 9 else "⚠️ REVIEW"
            f.write(f"### {r['id']}. {r['question']} [{status}]\n")
            f.write(f"**Score:** {r['score']}/10 | **Latency:** {r['latency_text']}s\n\n")
            f.write(f"**Answer:**\n{r['answer']}\n\n")
            f.write(f"**Audit Finding:** {r['reasoning']}\n\n---\n\n")
            
    print(f"\n[DONE] Audit V2 saved to {report_path}")
    print(f"FINAL SCORE: {avg_score:.1f}/10")

if __name__ == "__main__":
    asyncio.run(run_audit())
