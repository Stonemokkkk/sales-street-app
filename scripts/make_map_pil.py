#!/usr/bin/env python3

"""
make_map_pil.py
Renders a district scatter map PNG of premium toilets
Uses PIL with Noto CJK font for Chinese characters
"""

import json
import math
import os
from pathlib import Path

# Try to import PIL, provide helpful error if not installed
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("❌ PIL/Pillow not installed. Run: pip install Pillow")
    exit(1)

# Paths
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / "data"
OUTPUT_FILE = SCRIPT_DIR.parent / "icons" / "district-map.png"

# Hong Kong bounding box (approximate)
HK_BOUNDS = {
    "min_lat": 22.15,
    "max_lat": 22.56,
    "min_lng": 113.84,
    "max_lng": 114.40
}

# Image dimensions
IMG_WIDTH = 800
IMG_HEIGHT = 600
PADDING = 60

# Colors
COLORS = {
    "bg": (245, 246, 248),
    "water": (200, 220, 240),
    "land": (230, 235, 240),
    "border": (200, 200, 200),
    "text": (31, 41, 55),
    "text_light": (107, 114, 128),
    "star": (245, 158, 11),
    "high_rating": (22, 163, 74),   # Green
    "mid_rating": (234, 88, 12),    # Orange
    "low_rating": (220, 38, 38),    # Red
}

# District center coordinates (approximate)
DISTRICT_CENTERS = {
    "中西區": (22.285, 114.150),
    "灣仔區": (22.278, 114.172),
    "東區": (22.284, 114.224),
    "南區": (22.247, 114.158),
    "油尖旺區": (22.310, 114.170),
    "深水埗區": (22.331, 114.163),
    "九龍城區": (22.328, 114.183),
    "黃大仙區": (22.342, 114.195),
    "觀塘區": (22.313, 114.226),
    "葵青區": (22.354, 114.130),
    "荃灣區": (22.371, 114.114),
    "屯門區": (22.391, 113.973),
    "元朗區": (22.445, 114.035),
    "北區": (22.496, 114.138),
    "大埔區": (22.451, 114.164),
    "沙田區": (22.381, 114.195),
    "西貢區": (22.381, 114.270),
    "離島區": (22.261, 113.946),
}


def lat_lng_to_pixel(lat, lng, img_width, img_height):
    """Convert lat/lng to pixel coordinates"""
    x = PADDING + (lng - HK_BOUNDS["min_lng"]) / (HK_BOUNDS["max_lng"] - HK_BOUNDS["min_lng"]) * (img_width - 2 * PADDING)
    y = PADDING + (HK_BOUNDS["max_lat"] - lat) / (HK_BOUNDS["max_lat"] - HK_BOUNDS["min_lat"]) * (img_height - 2 * PADDING)
    return int(x), int(y)


def get_rating_color(rating):
    """Get color based on rating"""
    if rating >= 4.5:
        return COLORS["high_rating"]
    elif rating >= 3.5:
        return COLORS["star"]
    else:
        return COLORS["low_rating"]


def get_rating_radius(rating):
    """Get dot radius based on rating"""
    return max(4, int(rating * 3))


def find_font():
    """Find a CJK font that supports Chinese characters"""
    font_paths = [
        # WenQuanYi (most likely to be available)
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/wqy-zenhei/wqy-zenhei.ttc",
        # Noto Sans CJK (common on Linux)
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/google-noto-cjk/NotoSansCJK-Regular.ttc",
        # Noto Sans HK
        "/usr/share/fonts/opentype/noto/NotoSansHK-Regular.otf",
        # Droid Sans Fallback
        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
    ]

    for path in font_paths:
        if os.path.exists(path):
            return path

    return None


def draw_label_with_leader(draw, text, x, y, target_x, target_y, font, color, offsets):
    """Draw label with leader line to avoid collision"""
    for dx, dy in offsets:
        label_x = x + dx
        label_y = y + dy

        # Get text bbox
        bbox = draw.textbbox((label_x, label_y), text, font=font)

        # Check if within bounds
        if (bbox[0] >= 0 and bbox[2] <= IMG_WIDTH and
            bbox[1] >= 0 and bbox[3] <= IMG_HEIGHT):

            # Draw leader line
            draw.line([(target_x, target_y), (label_x, label_y)],
                     fill=color, width=1)

            # Draw label
            draw.text((label_x, label_y), text, fill=color, font=font)
            return True

    return False


def render_map():
    """Render the district scatter map"""
    print("🗺️  Rendering district map...")

    # Load premium toilet data
    premium_file = DATA_DIR / "premium_toilets.json"
    if not premium_file.exists():
        print(f"❌ {premium_file} not found")
        return

    with open(premium_file, "r", encoding="utf-8") as f:
        premium_toilets = json.load(f)

    if not premium_toilets:
        print("⚠️  No premium toilet data found")
        return

    # Create image
    img = Image.new("RGB", (IMG_WIDTH, IMG_HEIGHT), COLORS["bg"])
    draw = ImageDraw.Draw(img)

    # Load font
    font_path = find_font()
    if font_path:
        try:
            # For .ttc files, try different indices
            if font_path.endswith(".ttc"):
                # Try indices 0-4 to find CJK font
                for idx in range(5):
                    try:
                        font = ImageFont.truetype(font_path, 12, index=idx)
                        title_font = ImageFont.truetype(font_path, 16, index=idx)
                        small_font = ImageFont.truetype(font_path, 10, index=idx)
                        # Test if it can render Chinese
                        font.getbbox("中")
                        print(f"✅ Loaded font: {font_path} (index={idx})")
                        break
                    except:
                        continue
                else:
                    raise Exception("No CJK font found in .ttc file")
            else:
                font = ImageFont.truetype(font_path, 12)
                title_font = ImageFont.truetype(font_path, 16)
                small_font = ImageFont.truetype(font_path, 10)
                print(f"✅ Loaded font: {font_path}")
        except Exception as e:
            print(f"⚠️  Failed to load font: {e}")
            font = ImageFont.load_default()
            title_font = font
            small_font = font
    else:
        print("⚠️  No CJK font found, using default (Chinese may not render)")
        font = ImageFont.load_default()
        title_font = font
        small_font = font

    # Draw title
    title = "★ 靚廁所分佈圖"
    draw.text((PADDING, 15), title, fill=COLORS["text"], font=title_font)

    # Draw district labels
    label_positions = []
    for district, (lat, lng) in DISTRICT_CENTERS.items():
        x, y = lat_lng_to_pixel(lat, lng, IMG_WIDTH, IMG_HEIGHT)

        # Find non-overlapping position
        offsets = [(10, -5), (10, 5), (-60, -5), (-60, 5), (10, -20), (-60, -20)]
        draw_label_with_leader(draw, district, x, y, x, y, small_font, COLORS["text_light"], offsets)

    # Draw premium toilet markers
    for toilet in premium_toilets:
        lat = toilet.get("lat")
        lng = toilet.get("lng")
        rating = toilet.get("rating", 3.0)

        if not lat or not lng:
            continue

        x, y = lat_lng_to_pixel(lat, lng, IMG_WIDTH, IMG_HEIGHT)
        radius = get_rating_radius(rating)
        color = get_rating_color(rating)

        # Draw outer ring
        draw.ellipse(
            [x - radius - 2, y - radius - 2, x + radius + 2, y + radius + 2],
            fill="white",
            outline=color,
            width=2
        )

        # Draw filled circle
        draw.ellipse(
            [x - radius, y - radius, x + radius, y + radius],
            fill=color
        )

        # Draw name label
        name = toilet.get("name", "")
        if name:
            bbox = draw.textbbox((x + radius + 5, y - 6), name, font=font)
            if bbox[2] <= IMG_WIDTH - 10:
                draw.text((x + radius + 5, y - 6), name, fill=COLORS["text"], font=font)

    # Draw legend
    legend_y = IMG_HEIGHT - 80
    legend_x = PADDING

    draw.text((legend_x, legend_y), "評分:", fill=COLORS["text"], font=font)

    legend_items = [
        ("4.5+ ★", COLORS["high_rating"]),
        ("3.5-4.4 ★", COLORS["star"]),
        ("< 3.5 ★", COLORS["low_rating"]),
    ]

    for i, (label, color) in enumerate(legend_items):
        x = legend_x + 50 + i * 100
        draw.ellipse([x, legend_y + 2, x + 10, legend_y + 12], fill=color)
        draw.text((x + 15, legend_y), label, fill=COLORS["text"], font=small_font)

    # Draw Top-5 box
    top5 = sorted(premium_toilets, key=lambda t: t.get("rating", 0), reverse=True)[:5]

    box_x = IMG_WIDTH - 180
    box_y = 15
    box_width = 160
    box_height = 20 + len(top5) * 18

    draw.rectangle(
        [box_x, box_y, box_x + box_width, box_y + box_height],
        fill="white",
        outline=COLORS["border"],
        width=1
    )

    draw.text((box_x + 10, box_y + 5), "Top 5 靚廁所", fill=COLORS["text"], font=font)

    for i, toilet in enumerate(top5):
        name = toilet.get("name", "")[:8]
        rating = toilet.get("rating", 0)
        y = box_y + 25 + i * 18
        draw.text((box_x + 10, y), f"{i+1}. {name}", fill=COLORS["text"], font=small_font)
        draw.text((box_x + 100, y), f"{rating}★", fill=COLORS["star"], font=small_font)

    # Draw source footer
    footer = "數據來源: FEHD, Open Data | Sales Street Kit"
    draw.text((PADDING, IMG_HEIGHT - 25), footer, fill=COLORS["text_light"], font=small_font)

    # Save
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUTPUT_FILE, "PNG")
    print(f"✅ Map saved to {OUTPUT_FILE}")
    print(f"   Size: {IMG_WIDTH}x{IMG_HEIGHT} pixels")


if __name__ == "__main__":
    render_map()
