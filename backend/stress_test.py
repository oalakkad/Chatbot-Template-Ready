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

def generate_questions(filenames, count_per_file=10):
    all_questions = []
    print(f"Generating questions for {len(filenames)} files...")
    
    for fname in filenames:
        # Get a sample of text from Pinecone for this file to generate questions
        res = index.query(
            vector=[0]*1536, # Dummy vector just to get metadata filter
            filter={"source": fname},
            top_k=5,
            include_metadata=True
        )
        
        sample_text = "\n".join([m.metadata.get("text", "") for m in res.matches])
        if not sample_text:
            continue
            
        resp = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": f"Based on the following text from the file '{fname}', generate {count_per_file} diverse questions that a user might ask. Mix simple and complex questions. Return as a clean list."},
                {"role": "user", "content": sample_text}
            ]
        )
        questions = resp.choices[0].message.content.strip().split("\n")
        all_questions.extend([q.strip("- ").strip() for q in questions if q.strip()])
        
    return all_questions

def run_stress_test(questions):
    results = []
    print(f"Running stress test with {len(questions)} questions...")
    
    for i, q in enumerate(questions):
        print(f"[{i+1}/{len(questions)}] Testing: {q[:50]}...")
        # Simulate call
        answer = search_knowledge_base(q)
        
        # Audit the answer
        audit = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a quality auditor. You will receive a QUESTION and an ANSWER. Rate the answer for Accuracy (1-10), Language Match (Pass/Fail), and Directness (Pass/Fail). Also flag any hallucinations. Return as JSON."},
                {"role": "user", "content": f"QUESTION: {q}\nANSWER: {answer}"}
            ],
            response_format={"type": "json_object"}
        )
        
        audit_data = json.loads(audit.choices[0].message.content)
        results.append({
            "question": q,
            "answer": answer,
            "audit": audit_data
        })
        
    return results

if __name__ == "__main__":
    fnames = get_filenames()
    if not fnames:
        print("No documents found in database.")
        sys.exit(1)
        
    questions = generate_questions(fnames, count_per_file=5) # 5 per file for a good sample
    random.shuffle(questions)
    results = run_stress_test(questions[:50]) # Run top 50 for now to keep it sane
    
    with open("stress_test_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=4, ensure_ascii=False)
        
    print("\nStress Test Complete. Results saved to stress_test_results.json")
