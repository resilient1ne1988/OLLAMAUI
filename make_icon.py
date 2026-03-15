from PIL import Image, ImageDraw, ImageFont
import os

sizes = [16, 32, 48, 64, 128, 256]
images = []

for size in sizes:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Dark background circle
    margin = int(size * 0.04)
    draw.ellipse([margin, margin, size - margin, size - margin], fill=(13, 17, 23, 255))

    # Orange ring
    ring = max(1, int(size * 0.06))
    draw.ellipse([margin, margin, size - margin, size - margin], outline=(247, 147, 26, 255), width=ring)

    # Bitcoin B symbol
    font_size = int(size * 0.55)
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", font_size)
    except Exception:
        font = ImageFont.load_default()

    text = "B"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1]
    draw.text((x, y), text, fill=(247, 147, 26, 255), font=font)

    images.append(img)

out_path = r"C:\Users\keith\Documents\OLLAMAUI\src\icon.ico"
os.makedirs(os.path.dirname(out_path), exist_ok=True)

# Save with 256x256 as the largest size (electron-builder requires it)
# Save largest first, then others
images[-1].save(
    out_path,
    format='ICO',
    sizes=[(s, s) for s in sizes],
    append_images=images[:-1]
)

# Verify
check = Image.open(out_path)
print(f"Icon saved: {out_path}")
print(f"Sizes in ICO: {check.info.get('sizes', 'unknown')}")
