import os
from PIL import Image

# Path of the generated base icon image
source_path = r"C:\Users\Jaikumar\.gemini\antigravity\brain\abd07106-9f9f-49d2-bcf6-5f7743f18fe8\pwa_icon_1780029146733.png"
output_dir = r"d:\Bar_Accounts\frontend\public"

# Ensure output directory exists
os.makedirs(output_dir, exist_ok=True)

# Definition of icons to generate (filename, width, height)
icons = [
    ("pwa-192x192.png", 192, 192),
    ("pwa-512x512.png", 512, 512),
    ("maskable-icon-512x512.png", 512, 512),
    ("apple-touch-icon.png", 180, 180),
    ("favicon.ico", 32, 32)
]

try:
    with Image.open(source_path) as img:
        # Check source format and sizing
        print(f"Opened base image {source_path} ({img.size[0]}x{img.size[1]})")
        
        for filename, w, h in icons:
            dest_path = os.path.join(output_dir, filename)
            # Resize image
            resized_img = img.resize((w, h), Image.Resampling.LANCZOS)
            resized_img.save(dest_path)
            print(f"Saved: {dest_path} ({w}x{h})")
            
    print("All icons successfully generated and saved to public/ directory!")
except Exception as e:
    print(f"Error during icon generation: {e}")
