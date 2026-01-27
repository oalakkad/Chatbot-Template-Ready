import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.getcwd())

from knowledge_base import search_knowledge_base

async def test():
    print("\n--- TESTING TYPO: policeis ---")
    query = "what are the social media policeis"
    answer = await search_knowledge_base(query)
    print(f"QUERY: {query}")
    print(f"ANSWER:\n{answer}")

if __name__ == "__main__":
    asyncio.run(test())
