import os
import sys
import json
import asyncio
import random
from typing import List

# Add backend to path
sys.path.append(os.getcwd())

from database import SessionLocal
from models_db import Document as DocumentModel
from knowledge_base import openai_client, async_openai_client, index, search_pinecone, generate_answer_stream

async def get_filenames():
    db = SessionLocal()
    try:
        docs = db.query(DocumentModel).all()
        filenames = [d.filename for d in docs]
        return filenames
    finally:
        db.close()

async def generate_questions_for_file(fname: str, count: int = 30) -> List[str]:
    print(f"[GEN] Processing: {fname}")
    try:
        res = index.query(
            vector=[0.1]*512,
            filter={"source": fname},
            top_k=20,
            include_metadata=True
        )
        if not res.matches:
            return []
            
        context = "\n\n".join([m.metadata.get("text", "")[:500] for m in res.matches])
        resp = await async_openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": f"Generate {count} specific questions for '{fname}'. No numbers. One per line."},
                {"role": "user", "content": f"CONTENT SAMPLE:\n{context}"}
            ],
            temperature=0.7
        )
        content = resp.choices[0].message.content.strip()
        return [q.strip("- ").strip("1234567890. ").strip() for q in content.split("\n") if q.strip()]
    except Exception as e:
        print(f"[ERR] Question generation failed for {fname}: {e}")
        return []

async def process_question(semaphore, i, q, total, audit_results, completed_questions):
    if q in completed_questions:
        print(f"[{i+1}/{total}] Skipping (Already Done): {q[:50]}...")
        return

    async with semaphore:
        retries = 3
        delay = 5
        
        for attempt in range(retries):
            try:
                print(f"[{i+1}/{total}] Processing: {q[:50]}...")
                full_answer = ""
                context = await search_pinecone(q)
                if context:
                    async for chunk in generate_answer_stream(q, context):
                        full_answer += chunk
                else:
                    full_answer = "No relevant context found."
                
                res = {"question": q, "answer": full_answer}
                audit_results.append(res)
                
                # Incremental save
                with open("audit_results_partial.json", "a", encoding="utf-8") as f:
                    f.write(json.dumps(res, ensure_ascii=False) + "\n")
                
                await asyncio.sleep(0.5)
                return
                
            except Exception as e:
                if "429" in str(e) and attempt < retries - 1:
                    wait_time = delay * (2 ** attempt) + random.random()
                    print(f"  [!] Rate limit on {i+1}. Retrying in {wait_time:.1f}s...")
                    await asyncio.sleep(wait_time)
                else:
                    print(f"  [!] Permanent error on {i+1}: {e}")
                    break

async def run_god_tier_audit():
    print("--- AL-TIJARIA GOD-TIER RESUMABLE AUDIT ---")
    fnames = await get_filenames()
    if not fnames: return

    # Load existing questions or generate new ones
    # For stability, we generate the same set (mini is mostly deterministic at low temp)
    # but the REAL completion tracking is in audit_results_partial.json
    
    q_tasks = [generate_questions_for_file(fn, 30) for fn in fnames]
    q_results = await asyncio.gather(*q_tasks)
    all_questions = [q for sublist in q_results for q in sublist][:150]
    
    print(f"\n[AUDIT] Total Questions Targeted: {len(all_questions)}")
    if not all_questions: return

    # Load completed questions to skip them
    completed_questions = set()
    if os.path.exists("audit_results_partial.json"):
        with open("audit_results_partial.json", "r", encoding="utf-8") as f:
            for line in f:
                try:
                    data = json.loads(line)
                    completed_questions.add(data["question"])
                except: pass
    
    print(f"[AUDIT] Already Completed: {len(completed_questions)}")

    # 2. Resilient Concurrent Execution (3 parallel)
    semaphore = asyncio.Semaphore(3)
    audit_results = [] # we will populate the final list from the file later
    
    exec_tasks = [process_question(semaphore, i, q, len(all_questions), audit_results, completed_questions) for i, q in enumerate(all_questions)]
    await asyncio.gather(*exec_tasks)

    # 3. Final Markdown Report
    final_data = []
    if os.path.exists("audit_results_partial.json"):
        with open("audit_results_partial.json", "r", encoding="utf-8") as f:
            for line in f:
                try: final_data.append(json.loads(line))
                except: pass

    report_path = "God_Tier_Audit_Report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# AL-TIJARIA God-Tier AI Audit Report\n")
        f.write(f"**Total Verified Answers:** {len(final_data)}\n\n---\n")
        for i, res in enumerate(final_data):
            f.write(f"### Q{i+1}: {res['question']}\n\n{res['answer']}\n\n---\n\n")

    print(f"\n[SUCCESS] Audit Complete! Report: {report_path}")

if __name__ == "__main__":
    asyncio.run(run_god_tier_audit())
