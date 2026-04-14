from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "images" / "icon-concepts"
ASSET_DIR = ROOT / "assets" / "images"
SIZE = 1024

BG = "#0D0B09"
BG_WARM = "#17110D"
ORANGE = "#E8640A"
AMBER = "#F2A65A"
CREAM = "#F6E7D8"
SMOKE = "#2C2018"


def hex_rgba(value: str, alpha: int = 255) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def make_canvas() -> Image.Image:
    return Image.new("RGBA", (SIZE, SIZE), hex_rgba(BG))


def add_radial_glow(
    image: Image.Image,
    center: tuple[float, float],
    radius: float,
    color: str,
    alpha: int,
    blur: float,
    aspect: tuple[float, float] = (1.0, 1.0),
) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    cx, cy = center
    rx = radius * aspect[0]
    ry = radius * aspect[1]
    draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=hex_rgba(color, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    image.alpha_composite(layer)


def add_vertical_gradient(image: Image.Image, top: str, bottom: str) -> None:
    top_rgb = hex_rgba(top)
    bottom_rgb = hex_rgba(bottom)
    gradient = Image.new("RGBA", image.size, (0, 0, 0, 0))
    pixels = gradient.load()
    for y in range(SIZE):
        t = y / (SIZE - 1)
        r = int(top_rgb[0] * (1 - t) + bottom_rgb[0] * t)
        g = int(top_rgb[1] * (1 - t) + bottom_rgb[1] * t)
        b = int(top_rgb[2] * (1 - t) + bottom_rgb[2] * t)
        for x in range(SIZE):
            pixels[x, y] = (r, g, b, 255)
    image.alpha_composite(gradient)


def ring_mask(
    outer_bbox: tuple[float, float, float, float],
    width: int,
    start: float = 0,
    end: float = 360,
) -> Image.Image:
    mask = Image.new("L", (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(mask)
    draw.arc(outer_bbox, start=start, end=end, fill=255, width=width)
    return mask


def composite_ring(
    image: Image.Image,
    outer_bbox: tuple[float, float, float, float],
    width: int,
    color: str,
    alpha: int = 255,
    blur: int = 0,
    start: float = 0,
    end: float = 360,
) -> None:
    mask = ring_mask(outer_bbox, width, start, end)
    if blur:
        mask = mask.filter(ImageFilter.GaussianBlur(blur))
    alpha_mask = mask.point(lambda p: int(p * (alpha / 255)))
    layer = Image.new("RGBA", (SIZE, SIZE), hex_rgba(color, 0))
    layer.putalpha(alpha_mask)
    image.alpha_composite(layer)


def add_noise(image: Image.Image, opacity: float = 0.05) -> None:
    noise = Image.effect_noise(image.size, 18).convert("L")
    alpha = noise.point(lambda p: int(p * opacity))
    layer = Image.new("RGBA", image.size, hex_rgba(CREAM, 0))
    layer.putalpha(alpha)
    image.alpha_composite(layer, dest=(0, 0))


def concept_pulse_ring() -> Image.Image:
    image = make_canvas()
    add_vertical_gradient(image, BG_WARM, BG)
    add_radial_glow(image, (512, 520), 360, ORANGE, 54, 120)
    add_radial_glow(image, (492, 430), 250, AMBER, 26, 150, aspect=(1.1, 0.75))

    bbox = (186, 186, 838, 838)
    composite_ring(image, bbox, 110, ORANGE, alpha=120, blur=42, start=22, end=333)
    composite_ring(image, bbox, 86, ORANGE, alpha=255, start=22, end=333)
    composite_ring(image, (214, 214, 810, 810), 16, AMBER, alpha=110, blur=10, start=30, end=316)
    add_radial_glow(image, (656, 302), 84, AMBER, 36, 28)
    add_noise(image, 0.03)
    return image


def concept_vinyl_eclipse() -> Image.Image:
    image = make_canvas()
    add_vertical_gradient(image, "#15100C", BG)
    add_radial_glow(image, (512, 512), 410, ORANGE, 34, 130)
    add_radial_glow(image, (512, 512), 280, "#B64300", 36, 80)

    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    dshadow = ImageDraw.Draw(shadow)
    dshadow.ellipse((220, 220, 804, 804), fill=hex_rgba("#000000", 80))
    shadow = shadow.filter(ImageFilter.GaussianBlur(36))
    image.alpha_composite(shadow)

    record = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(record)
    draw.ellipse((226, 226, 798, 798), fill=hex_rgba("#120E0B", 255))
    draw.ellipse((288, 288, 736, 736), outline=hex_rgba(SMOKE, 150), width=2)
    draw.ellipse((330, 330, 694, 694), outline=hex_rgba(SMOKE, 110), width=2)
    draw.ellipse((390, 390, 634, 634), outline=hex_rgba(SMOKE, 90), width=2)
    image.alpha_composite(record)

    composite_ring(image, (184, 184, 840, 840), 94, ORANGE, alpha=110, blur=36, start=18, end=350)
    composite_ring(image, (198, 198, 826, 826), 68, ORANGE, alpha=255, start=18, end=350)

    label = Image.new("RGBA", image.size, (0, 0, 0, 0))
    dlabel = ImageDraw.Draw(label)
    dlabel.ellipse((454, 454, 570, 570), fill=hex_rgba("#24160F", 255))
    dlabel.ellipse((490, 490, 534, 534), fill=hex_rgba(AMBER, 220))
    dlabel.ellipse((505, 505, 519, 519), fill=hex_rgba(BG, 255))
    image.alpha_composite(label)

    crescent = Image.new("RGBA", image.size, (0, 0, 0, 0))
    dc = ImageDraw.Draw(crescent)
    dc.ellipse((250, 250, 774, 774), fill=hex_rgba(ORANGE, 90))
    dc.ellipse((348, 218, 850, 720), fill=(0, 0, 0, 0))
    crescent = crescent.filter(ImageFilter.GaussianBlur(22))
    image.alpha_composite(crescent)

    add_noise(image, 0.035)
    return image


def orbit_circle(center: tuple[int, int], radius: int, width: int, color: str, glow: int) -> Image.Image:
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    bbox = (center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius)
    draw.ellipse(bbox, outline=hex_rgba(color, 235), width=width)
    glow_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow_layer)
    gdraw.ellipse(bbox, outline=hex_rgba(color, 96), width=width + 20)
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(glow))
    return Image.alpha_composite(glow_layer, layer)


def concept_linked_orbits() -> Image.Image:
    image = make_canvas()
    add_vertical_gradient(image, BG_WARM, BG)
    add_radial_glow(image, (382, 490), 250, ORANGE, 54, 100)
    add_radial_glow(image, (642, 490), 250, AMBER, 32, 100)

    left = orbit_circle((386, 512), 210, 72, ORANGE, 24)
    right = orbit_circle((638, 512), 210, 72, AMBER, 24)
    image.alpha_composite(left)
    image.alpha_composite(right)

    bridge = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(bridge)
    draw.rounded_rectangle((458, 470, 566, 554), radius=40, fill=hex_rgba("#FF7B1A", 210))
    bridge = bridge.filter(ImageFilter.GaussianBlur(10))
    image.alpha_composite(bridge)

    inner = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(inner)
    draw.ellipse((440, 440, 584, 584), fill=hex_rgba(BG, 220))
    draw.ellipse((484, 484, 540, 540), fill=hex_rgba(CREAM, 110))
    inner = inner.filter(ImageFilter.GaussianBlur(2))
    image.alpha_composite(inner)

    add_noise(image, 0.03)
    return image


def make_card(icon: Image.Image, title: str, subtitle: str) -> Image.Image:
    card = Image.new("RGBA", (1240, 1460), hex_rgba("#0A0908"))
    add_vertical_gradient(card, "#15100C", "#090807")
    add_radial_glow(card, (620, 380), 480, ORANGE, 24, 180)

    mask = Image.new("L", (980, 980), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((0, 0, 980, 980), radius=220, fill=255)
    tile = icon.resize((980, 980))

    panel = Image.new("RGBA", (1020, 1020), (0, 0, 0, 0))
    pdraw = ImageDraw.Draw(panel)
    pdraw.rounded_rectangle((0, 0, 1020, 1020), radius=240, fill=hex_rgba("#12100D", 255), outline=hex_rgba("#2C2018", 255), width=2)
    panel = panel.filter(ImageFilter.GaussianBlur(0.3))
    card.alpha_composite(panel, dest=(110, 90))
    card.paste(tile, (130, 110), mask)

    draw = ImageDraw.Draw(card)
    try:
        title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 44)
        body_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 28)
    except OSError:
        title_font = ImageFont.load_default()
        body_font = ImageFont.load_default()
    draw.text((130, 1138), title, fill=hex_rgba(CREAM), font=title_font)
    draw.text((130, 1186), subtitle, fill=hex_rgba("#C4A893"), font=body_font)
    return card


def save(image: Image.Image, name: str) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    image.save(path)
    return path


def save_asset(image: Image.Image, name: str) -> Path:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    path = ASSET_DIR / name
    image.save(path)
    return path


def transparent_pulse_foreground() -> Image.Image:
    image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    bbox = (226, 226, 798, 798)
    composite_ring(image, bbox, 106, ORANGE, alpha=160, blur=28, start=26, end=334)
    composite_ring(image, bbox, 82, ORANGE, alpha=255, start=26, end=334)
    composite_ring(image, (250, 250, 774, 774), 14, AMBER, alpha=120, blur=8, start=36, end=316)
    add_radial_glow(image, (636, 316), 58, AMBER, 32, 18)
    return image


def monochrome_pulse_foreground() -> Image.Image:
    image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    bbox = (226, 226, 798, 798)
    composite_ring(image, bbox, 86, "#FFFFFF", alpha=255, start=26, end=334)
    return image


def adaptive_background() -> Image.Image:
    image = make_canvas()
    add_vertical_gradient(image, "#17120E", BG)
    add_radial_glow(image, (512, 482), 340, ORANGE, 28, 140)
    add_noise(image, 0.02)
    return image


def build_preview_sheet(cards: list[Image.Image]) -> Image.Image:
    sheet = Image.new("RGBA", (3920, 1680), hex_rgba("#070605"))
    add_vertical_gradient(sheet, "#110D0A", "#060504")
    add_radial_glow(sheet, (1960, 280), 1200, ORANGE, 28, 220)
    x = 120
    for card in cards:
        sheet.alpha_composite(card, dest=(x, 110))
        x += 1240
    return sheet


def main() -> None:
    concepts = [
        (
            "chen-pulse-ring.png",
            "Pulse Ring",
            "Warm orange halo with a subtle notch that hints at a lowercase c.",
            concept_pulse_ring(),
        ),
        (
            "chen-vinyl-eclipse.png",
            "Vinyl Eclipse",
            "A darker record-inspired icon with a premium eclipse glow.",
            concept_vinyl_eclipse(),
        ),
        (
            "chen-linked-orbits.png",
            "Linked Orbits",
            "Two glowing circles for friendship, overlap, and shared listening.",
            concept_linked_orbits(),
        ),
    ]

    cards = []
    for filename, title, subtitle, image in concepts:
        save(image, filename)
        cards.append(make_card(image, title, subtitle))

    preview = build_preview_sheet(cards)
    save(preview, "chen-icon-preview-sheet.png")

    live_icon = concept_pulse_ring()
    save_asset(live_icon, "icon-pulse-ring.png")
    save_asset(live_icon, "splash-icon-pulse-ring.png")
    save_asset(live_icon.resize((256, 256), Image.Resampling.LANCZOS), "favicon-pulse-ring.png")
    save_asset(transparent_pulse_foreground(), "android-icon-foreground-pulse-ring.png")
    save_asset(adaptive_background(), "android-icon-background-pulse-ring.png")
    save_asset(monochrome_pulse_foreground(), "android-icon-monochrome-pulse-ring.png")


if __name__ == "__main__":
    main()
