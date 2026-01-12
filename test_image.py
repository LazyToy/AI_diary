"""Test image generation"""
import asyncio
from app.services.image_service import image_service

async def test():
    print("Testing image generation with gemini-2.5-flash-image...")
    result = await image_service.generate_image(
        prompt="A peaceful sunset over the ocean with gentle waves",
        diary_id="test_001",
        style="watercolor"
    )
    print(f"Result: {result}")
    if result:
        print("✅ Image generation successful!")
    else:
        print("❌ Image generation failed")

if __name__ == "__main__":
    asyncio.run(test())
