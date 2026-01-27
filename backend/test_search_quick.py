import sys
import os
sys.path.append(os.getcwd())
from knowledge_base import embeddings, index

def test_search():
    query = "the"
    qv = embeddings.embed_query(query)
    res = index.query(vector=qv, top_k=1, include_metadata=True)
    print(f"Matches: {len(res.matches)}")
    for m in res.matches:
        print(f"Score: {m.score}, Text: {m.metadata.get('text')[:50]}")

if __name__ == "__main__":
    test_search()
