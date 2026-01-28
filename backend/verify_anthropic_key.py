import asyncio
from anthropic import AsyncAnthropic

async def test_key():
    client = AsyncAnthropic(api_key="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")
    try:
        print("Testing Claude 3 Haiku...")
        resp = await client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=10,
            messages=[{"role": "user", "content": "hi"}]
        )
        print(f"Haiku Success: {resp.content[0].text}")
    except Exception as e:
        print(f"Haiku Failed: {e}")

    try:
        print("\nTesting Claude 3.5 Sonnet (20241022)...")
        resp = await client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=10,
            messages=[{"role": "user", "content": "hi"}]
        )
        print(f"Sonnet 3.5 Success: {resp.content[0].text}")
    except Exception as e:
        print(f"Sonnet 3.5 Failed: {e}")

    try:
        print("\nTesting Claude 3 Sonnet (20240229)...")
        resp = await client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=10,
            messages=[{"role": "user", "content": "hi"}]
        )
        print(f"Sonnet 3 Success: {resp.content[0].text}")
    except Exception as e:
        print(f"Sonnet 3 Failed: {e}")

    try:
        print("\nTesting Claude 3.5 Haiku (20241022)...")
        resp = await client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=10,
            messages=[{"role": "user", "content": "hi"}]
        )
        print(f"Haiku 3.5 Success: {resp.content[0].text}")
    except Exception as e:
        print(f"Haiku 3.5 Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_key())
