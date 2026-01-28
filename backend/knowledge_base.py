
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
from anthropic import Anthropic, AsyncAnthropic
import asyncio
from concurrent.futures import ThreadPoolExecutor

# CREDENTIALS (In real app, use env vars)
PINECONE_API_KEY = "pcsk_6gZ8KC_E34T5B3vMGXbpFCD6QNM4ENqGJTq5L9kVZZNrjkEvfSQZ7z2p9ZTZkYUcC6P7mr"
PINECONE_INDEX_NAME = "help-desk-chatbot"
PINECONE_HOST = "https://help-desk-chatbot-oofakob.svc.aped-4627-b74a.pinecone.io"
OPENAI_API_KEY = "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"
ANTHROPIC_API_KEY = "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"

# Initialize Clients
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(name=PINECONE_INDEX_NAME, host=PINECONE_HOST)
openai_client = OpenAI(api_key=OPENAI_API_KEY)
async_openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)
async_anthropic_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

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

async def search_pinecone(query: str, history: list = None, top_k: int = 20) -> str:
    """
    God-Speed Divine Precision Search:
    - Initiates original query search IN PARALLEL with query expansion.
    - Smart Bypass: If a direct hit is found (score > 0.85), skips costly LLM reranking.
    - Follow-up Intelligence: If query is "more depth", uses history for context.
    """
    try:
        # Detect Follow-up intent
        is_follow_up = False
        follow_up_keywords = ["more depth", "more detail", "elaborate", "tell me more", "expand", "further", "depth"]
        query_lower = query.lower()
        if any(k in query_lower for k in follow_up_keywords) and len(query_lower.split()) < 5:
            is_follow_up = True
            
        search_query = query
        if is_follow_up and history:
            # Find last non-follow-up user query
            last_real_query = ""
            for h in reversed(history):
                if h.sender == "user":
                    test_q = h.content.lower()
                    if not any(k in test_q for k in follow_up_keywords) or len(test_q.split()) >= 5:
                        last_real_query = h.content
                        break
            if last_real_query:
                search_query = f"{last_real_query} {query}"
                print(f"[FOLLOW_UP] Detected. Expanded search query: '{search_query}'")

        # 1. Start original query search IMMEDIATELY (Don't wait for expansion)
        original_embedding_task = asyncio.get_event_loop().run_in_executor(executor, lambda: embeddings.embed_query(search_query))
        
        # 2. Start Query Expansion in parallel
        is_short_query = len(search_query.split()) < 4
        expansion_task = asyncio.create_task(generate_multi_queries(search_query, history=history if is_follow_up else None))
        
        # Wait for original embedding to finish first
        orig_qv = await original_embedding_task
        orig_res = await asyncio.get_event_loop().run_in_executor(executor, lambda: index.query(vector=orig_qv, top_k=top_k, include_metadata=True))
        
        # 3. SMART BYPASS: If we have a very strong direct hit or it's a short query, we can potentially skip everything else
        if orig_res.matches and (orig_res.matches[0].score > 0.90 or (is_short_query and orig_res.matches[0].score > 0.75)):
            print(f"[GOD_SPEED] Direct Hit or Short Query Match (Score: {orig_res.matches[0].score:.4f}). Bypassing expansion and rerank.")
            best_chunks = orig_res.matches[:top_k]
        else:
            # Otherwise, wait for expansion (if it was started) and do full retrieval
            expanded_queries = []
            if expansion_task:
                expanded_queries = await expansion_task
            
            # Remove original from expanded to avoid redundant work
            other_queries = [v for v in expanded_queries if v != query]
            
            async def fetch_results(q):
                qv = await asyncio.get_event_loop().run_in_executor(executor, lambda: embeddings.embed_query(q))
                res = await asyncio.get_event_loop().run_in_executor(executor, lambda: index.query(vector=qv, top_k=15, include_metadata=True))
                return res.matches

            # Execute other expansions in parallel
            tasks = [fetch_results(q) for q in other_queries]
            other_results_lists = await asyncio.gather(*tasks)
            
            # Merge all
            all_matches = list(orig_res.matches)
            seen_ids = {m.id for m in all_matches}
            for matches in other_results_lists:
                for m in matches:
                    if m.id not in seen_ids:
                        all_matches.append(m)
                        seen_ids.add(m.id)

            al_matches_sorted = sorted(all_matches, key=lambda x: x.score, reverse=True)
            candidate_pool = al_matches_sorted[:top_k * 2]

            # 4. CONDITIONAL RERANK: Skip if top score is very high, otherwise Rerank
            if candidate_pool and candidate_pool[0].score > 0.85:
                print(f"[GOD_SPEED] High Confidence (Score: {candidate_pool[0].score:.4f}). Skipping Reranker.")
                best_chunks = candidate_pool[:top_k]
            else:
                print(f"[GOD_SPEED] Low Confidence. Performing Surgical Rerank...")
                best_chunks = await rerank_results(query, candidate_pool, limit=top_k)
        
        # Format Results
        context_parts = []
        for match in best_chunks:
            text = match.metadata.get("text", "")
            source = match.metadata.get("source", "Unknown")
            page = match.metadata.get("page", "?")
            context_parts.append(f"[Source: {source} | Page: {page}]\n{text}")
        
        return "\n\n---\n\n".join(context_parts)
    except Exception as e:
        print(f"[GOD_SPEED] Search Error: {e}")
        return ""

async def rerank_results(query: str, chunks: list, limit: int = 10) -> list:
    """
    Surgical Reranking using LLM to identify the most relevant chunks.
    This eliminates 'general' noise and ensures 'God-Tier' precision.
    """
    if not chunks:
        return []
    
    try:
        # Prepare content for reranker
        candidates = []
        for i, m in enumerate(chunks):
            candidates.append(f"ID: {i}\nContent: {m.metadata.get('text', '')[:300]}...")
        
        candidates_str = "\n\n".join(candidates)
        
        resp = await async_anthropic_client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=50,
            system="Return ONLY a comma-separated list of candidate IDs that are relevant and help answer the query. Max 12 IDs.",
            messages=[
                {"role": "user", "content": f"QUERY: {query}\nCANDIDATES:\n{candidates_str}"}
            ],
            temperature=0,
            timeout=5
        )
        
        id_str = resp.content[0].text.strip()
        # Parse IDs safely
        try:
            ids = [int(x.strip()) for x in id_str.split(",") if x.strip().isdigit()]
            reranked = [chunks[i] for i in ids if i < len(chunks)]
            return reranked[:limit]
        except:
            # Fallback to score-based if parsing fails
            return chunks[:limit]
            
    except Exception as e:
        print(f"[RERANK_ERROR] {e}")
        return chunks[:limit]

async def generate_multi_queries(query: str, history: list = None) -> List[str]:
    """Generates 3 variations of the query for semantic search, aware of history for follow-ups."""
    try:
        system_msg = "Return 3 variations of the query for semantic search, corrected for typos. Clean list, no numbers."
        if history:
            system_msg = "The user is asking a follow-up. Using the history, generate 3 search variations that capture the deeper technical details of the topic being discussed. Clean list, no numbers."

        resp = await async_anthropic_client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=60,
            system=system_msg,
            messages=[
                {"role": "user", "content": query}
            ],
            temperature=0,
            timeout=5
        )
        variants = resp.content[0].text.strip().split("\n")
        return [query] + [v.strip("- ").strip() for v in variants[:3]]
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

async def generate_answer_stream(query: str, context: str, history: list = None, voice_mode: bool = False):
    """
    Divine Response Generator:
    - Primary Engine: Anthropic Claude 3.5 Haiku (God-tier speed & precision)
    - Fallback Engine: OpenAI GPT-4o (100% Reliability backup)
    - Voice Mode: Enforces extreme brevity for faster TTS.
    """
    if not context or "No relevant information" in context:
        yield "Information not found in official security protocols."
        return

    try:
        system_prompt = """You are the AL-TIJARIA "God-Tier" Security Information Assistant. Your mission is to provide comprehensive, high-fidelity information from official manuals with absolute precision.
"""
        if voice_mode:
            system_prompt += "\nVOICE MODE ACTIVE: Be extremely concise. Use a maximum of 3 short bullet points. Do not use complex headers or references in the text. Focus on the most critical information for spoken delivery."
        else:
            system_prompt += """
GOD-TIER STRUCTURING RULES:
1. START WITH BRIEF CONTEXT: You may start with a single, polite sentence like: "The [Topic] at AL-TIJARIA includes the following key points:"
2. CATEGORIZATION: Use bold headers (### Category) to group related points.
3. COMPREHENSIVE BULLETS: Do not be overly brief; explain the 'why' or 'how' if available in the context. If the user asks for "more depth" or "elaborate", provide any additional technical details or secondary protocols found in the documents.
4. ABSOLUTE HONESTY: If the specific answer is not in the context, state "No specific information found in official security protocols for this request."
5. REFERENCES: You MUST end with a section titled "### 📂 References" listing source documents and page numbers.
6. PROFESSIONAL TONE: Maintain a formal, authoritative, and helpful tone.
"""
        # Style Example:
        # The VPN policies at AL-TIJARIA include the following key points:

        # ### Approved VPN Use
        # - All remote access connections to internal AL-TIJARIA networks must be made through approved, AL-TIJARIA-provided virtual private networks (VPNs).

        # ### Authentication
        # - Users must be authenticated using unique IDs and appropriate methods such as security tokens or biometrics.

        # ### 📂 References
        # - [Source: VPN_Access_Manual.pdf | Page: 5]
        system_prompt += """
Style Example:
The VPN policies at AL-TIJARIA include the following key points:

### Approved VPN Use
- All remote access connections to internal AL-TIJARIA networks must be made through approved, AL-TIJARIA-provided virtual private networks (VPNs).

### Authentication
- Users must be authenticated using unique IDs and appropriate methods such as security tokens or biometrics.

### 📂 References
- [Source: VPN_Access_Manual.pdf | Page: 5]"""

        # Robust Message Conversion for Anthropic (Must alternate User/Assistant, start with User)
        raw_msgs = []
        if history:
            for h in history[-3:]: # Minimal history to save balance
                role = "user" if h.sender == "user" else "assistant"
                # Ensure content is a string
                content_text = str(h.content) if h.content is not None else ""
                if content_text.strip():
                    raw_msgs.append({"role": role, "content": content_text})
        
        # Add the current query with context
        current_user_content = f"CONTEXT: {context}\n\nQUERY: {query}"
        raw_msgs.append({"role": "user", "content": current_user_content})

        # Clean up messages: merge consecutive roles, ensure it starts with 'user'
        claude_messages = []
        for m in raw_msgs:
            if not claude_messages:
                if m["role"] == "user":
                    claude_messages.append(m.copy())
                continue
            
            if m["role"] == claude_messages[-1]["role"]:
                # Safe merge
                current_content = claude_messages[-1].get("content", "")
                add_content = m.get("content", "")
                claude_messages[-1]["content"] = f"{current_content}\n\n{add_content}".strip()
            else:
                claude_messages.append(m.copy())

        if not claude_messages:
            claude_messages = [{"role": "user", "content": current_user_content}]

        # Final safety: Anthropic rejects empty content or pure whitespace
        claude_messages = [m for m in claude_messages if m["content"].strip()]
        
        print(f"[CLAUDE_DEBUG] Sending {len(claude_messages)} messages to Claude.")
        # print(f"[CLAUDE_DEBUG] Messages: {claude_messages}")

        async with async_anthropic_client.messages.stream(
            model="claude-3-5-haiku-20241022",
            max_tokens=1024,
            system=system_prompt,
            messages=claude_messages,
            temperature=0
        ) as stream:
            async for event in stream:
                if event.type == "content_block_delta":
                    yield event.delta.text
    except Exception as e:
        print(f"[STREAM_ERR] Claude failed, falling back to OpenAI. Error: {e}")
        try:
            # Fallback to OpenAI GPT-4o if Claude fails for any reason
            fallback_messages = [
                {"role": "system", "content": system_prompt}
            ]
            # Convert Claude format back to OpenAI format
            for m in claude_messages:
                fallback_messages.append({"role": m["role"], "content": m["content"]})
            
            response = await async_openai_client.chat.completions.create(
                model="gpt-4o",
                messages=fallback_messages,
                temperature=0,
                stream=True
            )
            async for chunk in response:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as fallback_err:
            print(f"[STREAM_ERR] BOTH Claude and OpenAI failed: {fallback_err}")
            yield "Error during generation. Please verify the service status."
