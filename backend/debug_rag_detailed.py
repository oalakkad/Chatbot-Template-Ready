import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

from knowledge_base import search_pinecone, generate_multi_queries, embeddings, index

def debug_rag(query):
    print(f"\n=== DEBUGGING QUERY: {query} ===")
    
    # 1. Check Multi-Queries
    variants = generate_multi_queries(query)
    print(f"Variants generated: {variants}")
    
    # 2. Check Raw Pinecone Matches for each variant
    all_hits = []
    for q in variants:
        qv = embeddings.embed_query(q)
        res = index.query(vector=qv, top_k=5, include_metadata=True)
        print(f"\nTop 5 for variant '{q}':")
        for m in res.matches:
            print(f"  - Score: {m.score:.4f}, Source: {m.metadata.get('source')}, Text Snippet: {m.metadata.get('text')[:100]}...")
            all_hits.append(m)
            
    # 3. Final Context
    context = search_pinecone(query)
    print(f"\nFinal Context Length: {len(context)}")
    if not context:
        print("!!! NO CONTEXT FOUND !!!")
    else:
        print("Context found. Sending to generate_answer...")

if __name__ == "__main__":
    debug_rag("social media policy")
