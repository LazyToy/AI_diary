"""
Image Service
Gemini를 사용한 이미지 생성 서비스
"""

import base64
from pathlib import Path
from datetime import datetime
from typing import Optional

from google import genai
from google.genai import types
from app.config.settings import settings

# Configure Gemini
# genai.configure(api_key=settings.GEMINI_API_KEY)

client = genai.Client(api_key=settings.GEMINI_API_KEY)


class ImageService:
    """Service for generating images using Gemini"""
    
    STYLE_PROMPTS = {
        "watercolor": "in beautiful watercolor painting style, soft colors, artistic brush strokes",
        "pixel": "in retro pixel art style, 16-bit aesthetic, vibrant colors",
        "realistic": "photorealistic, high quality photograph, natural lighting",
        "anime": "in anime illustration style, vibrant colors, expressive",
        "oil_painting": "in classical oil painting style, rich textures, dramatic lighting",
        "sketch": "in pencil sketch style, detailed line work, artistic",
    }
    
    def __init__(self):
        self.images_dir = settings.IMAGES_DIR
        # Gemini 2.5 Flash with image generation capability
        self.model_name = "gemini-2.5-flash-image"
    
    async def generate_image(
        self, 
        prompt: str, 
        diary_id: str,
        style: str = "watercolor"
    ) -> Optional[str]:
        """
        Generate an image based on the prompt
        Returns the saved image path or None if generation fails
        """
        # Add style to prompt
        style_suffix = self.STYLE_PROMPTS.get(style, self.STYLE_PROMPTS["watercolor"])
        full_prompt = f"Generate an artistic image: {prompt}, {style_suffix}. Create a single beautiful image without any text."
        
        try:
            # Generate image using Gemini 2.5 Flash Image
            response = client.models.generate_content(
                model=self.model_name,
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE", "TEXT"]
                )
            )
            
            # Extract image from response
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'inline_data') and part.inline_data is not None:
                    image_data = part.inline_data.data
                    mime_type = part.inline_data.mime_type
                    
                    # Determine file extension
                    ext = "png"
                    if "jpeg" in mime_type or "jpg" in mime_type:
                        ext = "jpg"
                    elif "webp" in mime_type:
                        ext = "webp"
                    
                    # Save image
                    filename = f"{diary_id}_{datetime.now().strftime('%H%M%S')}.{ext}"
                    image_path = self.images_dir / filename
                    
                    with open(image_path, "wb") as f:
                        f.write(image_data)
                    
                    print(f"Image saved to: {image_path}")
                    return str(image_path)
            
            print(f"No image in response: {response.text if hasattr(response, 'text') else 'No text'}")
            return None
                
        except Exception as e:
            print(f"Image generation error: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def get_placeholder_message(self) -> str:
        """Return a message when image generation is not available"""
        return "이미지 생성에 실패했습니다. 잠시 후 다시 시도해주세요."


# Global service instance
image_service = ImageService()
