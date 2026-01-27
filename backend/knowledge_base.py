
import os
import shutil
from typing import List
from uuid import uuid4
from fastapi import UploadFile

from pinecone import Pinecone
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

from openai import OpenAI, AsyncOpenAI
import asyncio
from concurrent.futures import ThreadPoolExecutor

# CREDENTIALS (In real app, use env vars)
PINECONE_API_KEY = "pcsk_6gZ8KC_E34T5B3vMGXbpFCD6QNM4ENqGJTq5L9kVZZNrjkEvfSQZ7z2p9ZTZkYUcC6P7mr"
PINECONE_INDEX_NAME = "help-desk-chatbot"
PINECONE_HOST = "https://help-desk-chatbot-oofakob.svc.aped-4627-b74a.pinecone.io"
OPENAI_API_KEY = "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"

# Initialize Clients
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(name=PINECONE_INDEX_NAME, host=PINECONE_HOST)
openai_client = OpenAI(api_key=OPENAI_API_KEY)
async_openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

# Executor for sync operations like embeddings
executor = ThreadPoolExecutor(max_workers=10)

# Initialize Embeddings (Local, Free)
# Using distiluse-base-multilingual-cased-v1 (512 dimensions) to match Pinecone Index
embeddings = HuggingFaceEmbeddings(model_name="distiluse-base-multilingual-cased-v1")


from sqlalchemy.orm import Session
from models_db import Document

def ingest_pdf(file: UploadFile, db: Session):
    """
    Saves the uploaded PDF, chunks it, embeds it, and upserts to Pinecone.
    """
    # 0. Create DB Record
    print(f"[DEBUG] Creating Document record for {file.filename}")
    new_doc = Document(filename=file.filename, status="INDEXING", chunk_count=0)
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    print(f"[DEBUG] Document record created with ID: {new_doc.id}")

    # 1. Save to temp file
    temp_path = f"temp_{uuid4()}.pdf"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        # 2. Load PDF
        loader = PyPDFLoader(temp_path)
        docs = loader.load()
        
        # 3. Split Text
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200
        )
        splits = text_splitter.split_documents(docs)
        
        print(f"[RAG] Processing {len(splits)} chunks from {file.filename}...")

        # 4. Embed & Upsert in batches
        vectors = []
        for i, doc in enumerate(splits):
            doc_id = str(uuid4())
            # Generate embedding
            embedding = embeddings.embed_query(doc.page_content)
            
            # Prepare metadata
            metadata = {
                "source": file.filename,
                "page": doc.metadata.get("page", 0),
                "text": doc.page_content
            }
            
            vectors.append({
                "id": doc_id,
                "values": embedding,
                "metadata": metadata
            })
            
            # Upsert in small batches (e.g., 50)
            if len(vectors) >= 50:
                index.upsert(vectors=vectors)
                vectors = []
        
        # Upsert remaining
        if vectors:
            index.upsert(vectors=vectors)
            
        print(f"[RAG] Successfully ingested {file.filename}")
        
        # 5. Update DB Record
        new_doc.status = "READY"
        new_doc.chunk_count = len(splits)
        db.commit()

        return len(splits)
        
    except Exception as e:
        new_doc.status = "ERROR"
        db.commit()
        raise e
        
    finally:
        # Cleanup
        if os.path.exists(temp_path):
            os.remove(temp_path)

async def search_pinecone(query: str, top_k: int = 20) -> str:
    """
    Super-Sonic Divine Precision Search:
    - Async & Parallelized for maximum speed.
    - Explicit Typo Correction.
    - 5x Query Expansion + Parallel Retrieval.
    """
    try:
        # 1. Async Multi-Query Expansion with Typo Correction
        queries = await generate_multi_queries(query)
        
        # 2. Parallel Embeddings & Pinecone Retrieval
        async def fetch_results(q):
            # Embeddings is sync/local, wrap in thread
            qv = await asyncio.get_event_loop().run_in_executor(executor, lambda: embeddings.embed_query(q))
            # Pinecone query is sync, wrap in thread
            res = await asyncio.get_event_loop().run_in_executor(executor, lambda: index.query(vector=qv, top_k=30, include_metadata=True))
            return res.matches

        # Parallelize all searches
        tasks = [fetch_results(q) for q in queries]
        all_results_lists = await asyncio.gather(*tasks)
        
        all_matches = []
        seen_ids = set()
        for matches in all_results_lists:
            for m in matches:
                if m.id not in seen_ids:
                    all_matches.append(m)
                    seen_ids.add(m.id)

        if not all_matches:
            return ""

        # Rapid Score-Based Selection
        all_matches.sort(key=lambda x: x.score, reverse=True)
        best_chunks = all_matches[:top_k]
        
        context_parts = []
        for match in best_chunks:
            text = match.metadata.get("text", "")
            source = match.metadata.get("source", "Unknown")
            page = match.metadata.get("page", "?")
            context_parts.append(f"[Source: {source} | Page: {page}]\n{text}")
        
        return "\n\n---\n\n".join(context_parts)
    except Exception as e:
        print(f"[SUPER_SONIC] Search Error: {e}")
        return ""

async def generate_multi_queries(query: str) -> List[str]:
    """Generates 5 version of the query with internal typo-correction."""
    try:
        resp = await async_openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": """You are an elite search engineer. 
1. CORRECT any typos in the user's request (e.g. 'policeis' -> 'policies').
2. Generate 4 additional, distinct search queries starting with the corrected query.
3. Return as a clean list separated by newlines."""},
                {"role": "user", "content": f"User Request: {query}"}
            ],
            temperature=0,
            timeout=5
        )
        variants = resp.choices[0].message.content.strip().split("\n")
        return [query] + [v.strip("- ").strip() for v in variants[:4]]
    except Exception as e:
        print(f"[QUERY_EXPANSION_ERROR] {e}")
        return [query]

def rerank_chunks(query: str, chunks: list, limit: int = 20) -> list:
    """Fast score-based selection."""
    chunks.sort(key=lambda x: x.score, reverse=True)
    return chunks[:limit]

def delete_document_vectors(filename: str):
    """
    Deletes all vectors associated with a specific filename from Pinecone.
    """
    try:
        print(f"[RAG] Deleting vectors for source: {filename}")
        # Delete by metadata filter
        index.delete(filter={"source": {"$eq": filename}})
        print(f"[RAG] Successfully deleted vectors for {filename}")
        return True
    except Exception as e:
        print(f"[RAG] Delete Error: {e}")
        raise e

async def generate_answer_stream(query: str, context: str, history: list = None):
    """
    Yields chunks of the AI's response for real-time streaming.
    - Merged validation rules.
    - Elite markdown formatting.
    """
    if not context:
        yield "Information not available in current records. Please try asking in a different way or check your spelling."
        return

    llm_messages = [
        {"role": "system", "content": """YOU ARE THE AL-TIJARIA 'ELDORADO' AI. 
DESIGN PHILOSOPHY: PREMIUM, HIGH-FIDELITY, ELITE.

STRICT CONSTRAINTS:
1. MATCH LANGUAGE: Detect the user's language and respond EXCLUSIVELY in that language.
2. NO CHATGPT-STYLE FILLER: No 'Sure', 'How can I help?', or 'Based on the context'. 
3. GOD-TIER LAYOUTING:
   - Use `###` for bold, capitalized headers.
   - Use Markdown Tables `| Header |` for any itemized data or multi-point comparisons.
   - For lists, use diamond bullets `- ◆` or clean bold numbering `1.`
   - Ensure spaciousness between sections.
   - Use `---` for clean dividers between sources.
4. CITATIONS: Use `[Source Name | Page #]` after every key point.

TONE: Clinical, Elite, Authoritative Assistant."""}
    ]

    if history:
        for h in history[-3:]:
             llm_messages.append({"role": "user" if h.sender == "user" else "assistant", "content": h.content})

    llm_messages.append({"role": "user", "content": f"CONTEXT: {context}\n\nQUERY: {query}"})

    try:
        response = await async_openai_client.chat.completions.create(
            model="gpt-4o",
            messages=llm_messages,
            temperature=0,
            stream=True
        )
        async for chunk in response:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except Exception as e:
        print(f"[STREAM_ERR] {e}")
        yield "Error during generation."
