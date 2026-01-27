import os
import sys
import json
import random

# Add backend to path
sys.path.append(os.getcwd())

from database import SessionLocal
from models_db import Document
from knowledge_base import search_knowledge_base, openai_client, index

def get_filenames():
    db = SessionLocal()
    docs = db.query(Document).all()
    filenames = [d.filename for d in docs]
    db.close()
    return filenames

def generate_questions(filenames, count_per_file=5):
    all_questions = []
    print(f"Generating questions for {len(filenames)} files...")
    
    for fname in filenames:
        res = index.query(
            vector=[0]*1536,
            filter={"source": fname},
            top_k=3,
            include_metadata=True
        )
        
        sample_text = "\n".join([m.metadata.get("text", "") for m in res.matches])
        if not sample_text:
            continue
            
        resp = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": f"Generate {count_per_file} diverse questions for the file '{fname}'. Mix English and Arabic queries. Return as a clean list."},
                {"role": "user", "content": sample_text}
            ],
            timeout=30
        )
        questions = resp.choices[0].message.content.strip().split("\n")
        all_questions.extend([q.strip("- ").strip() for q in questions if q.strip()])
        
    return all_questions

def run_stress_test(questions):
    results = []
    print(f"Running stress test with {len(questions)} questions...")
    
    for i, q in enumerate(questions):
        print(f"[{i+1}/{len(questions)}] Testing: {q[:50]}...")
        try:
            answer = search_knowledge_base(q)
            
            audit = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a quality auditor. Rate the ANSWER for the QUESTION. Return JSON: {accuracy_score: 1-10, language_pass: bool, directness_pass: bool, hallucinations: text}"},
                    {"role": "user", "content": f"QUESTION: {q}\nANSWER: {answer}"}
                ],
                response_format={"type": "json_object"},
                timeout=30
            )
            
            audit_data = json.loads(audit.choices[0].message.content)
            res = {
                "question": q,
                "answer": answer,
                "audit": audit_data
            }
            results.append(res)
            
            # Save incrementally
            with open("stress_test_partial.json", "a", encoding="utf-8") as f:
                f.write(json.dumps(res, ensure_ascii=False) + "\n")
        except Exception as e:
            print(f"Error on question {i}: {e}")
            
    return results

if __name__ == "__main__":
    fnames = get_filenames()
    if not fnames:
        print("No docs.")
        sys.exit(1)
        
    all_q = generate_questions(fnames, count_per_file=3)
    random.shuffle(all_q)
    # Target 20 questions
    final_q = all_q[:20]
    
    # Clear partial file
    with open("stress_test_partial.json", "w", encoding="utf-8") as f:
        f.write("")
        
    run_stress_test(final_q)
    print("Test finished.")
