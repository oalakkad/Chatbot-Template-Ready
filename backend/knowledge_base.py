
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

from openai import OpenAI

# CREDENTIALS (In real app, use env vars)
PINECONE_API_KEY = "pcsk_6gZ8KC_E34T5B3vMGXbpFCD6QNM4ENqGJTq5L9kVZZNrjkEvfSQZ7z2p9ZTZkYUcC6P7mr"
PINECONE_INDEX_NAME = "help-desk-chatbot"
PINECONE_HOST = "https://help-desk-chatbot-oofakob.svc.aped-4627-b74a.pinecone.io"
OPENAI_API_KEY = "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"

# Initialize Clients
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(name=PINECONE_INDEX_NAME, host=PINECONE_HOST)
openai_client = OpenAI(api_key=OPENAI_API_KEY)

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

def search_pinecone(query: str, top_k: int = 5) -> str:
    """
    Embeds query, searches Pinecone, returns formatted context string.
    Increased top_k to 5 for better accuracy.
    """
    try:
        print(f"[RAG] Searching for: {query}")
        query_vector = embeddings.embed_query(query)
        
        results = index.query(
            vector=query_vector,
            top_k=top_k,
            include_metadata=True
        )
        
        if not results.matches:
            return ""
            
        context_parts = []
        for match in results.matches:
            text = match.metadata.get("text", "")
            source = match.metadata.get("source", "Unknown")
            score = match.score
            if score > 0.25:  # Lowered threshold for more results
                context_parts.append(f"[Source: {source}]\n{text}")
        
        return "\n\n---\n\n".join(context_parts)
    except Exception as e:
        print(f"[RAG] Search Error: {e}")
        return ""

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

def generate_answer(query: str, context: str) -> str:
    """
    Uses OpenAI to generate a polite, accurate answer based on provided context.
    Optimized for speed and accuracy.
    """
    if not context:
        return "I'm sorry, I couldn't find any information about that in our knowledge base."

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",  # Fast and cost-effective
            messages=[
                {"role": "system", "content": """You are AL-TIJARIA Support Assistant - a professional, helpful AI assistant.

CRITICAL LANGUAGE RULE:
- If the user asks in ENGLISH → Answer in ENGLISH
- If the user asks in ARABIC → Answer in KUWAITI ARABIC (الكويتية)
- ALWAYS match the exact language of the question

OTHER RULES:
1. STRICTLY answer ONLY using the provided context below
2. If information is NOT in the context, say: 'I don't have that specific information in my knowledge base' (or in Arabic: 'ما عندي هالمعلومة بقاعدة البيانات حقتي')
3. Be concise but complete - provide all relevant details from the context
4. Format your response clearly with bullet points or paragraphs as needed
5. Never make up information or use external knowledge
6. Quote specific details from the context when helpful"""},
                {"role": "user", "content": f"""CONTEXT FROM KNOWLEDGE BASE:
{context}

---

USER QUESTION: {query}

Provide a clear, accurate answer based ONLY on the context above."""}
            ],
            temperature=0.3,  # Lower temperature for more consistent, accurate answers
            max_tokens=500  # Limit response length for speed
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"[LLM] Error: {e}")
        return "I'm having trouble thinking right now. Please try again or ask for a human agent."
