#!/usr/bin/env python3
"""Generate Furmosa LINE Rich Menu + card hero illustrations (handcrafted feel)."""
from __future__ import annotations

import math
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'line')
FONT = '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc'


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT, size)


def round_rect(draw, xy, r, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)


def draw_jar(draw, cx, cy, scale, glass='#A8D5BA', lid='#2D6A4F'):
    w, h = int(70 * scale), int(90 * scale)
    # jar body
    round_rect(draw, [cx - w // 2, cy - h // 2 + 10, cx + w // 2, cy + h // 2], 18, glass, lid, 4)
    # lid
    round_rect(draw, [cx - w // 2 - 6, cy - h // 2 - 8, cx + w // 2 + 6, cy - h // 2 + 18], 10, lid)
    # highlight
    draw.ellipse([cx - w // 3, cy - 10, cx - w // 8, cy + 30], fill='#FFFFFF55')


def draw_cycle(draw, cx, cy, color='#2D6A4F'):
    bbox = [cx - 40, cy - 40, cx + 40, cy + 40]
    draw.arc(bbox, 40, 300, fill=color, width=7)
    # arrow tip
    draw.polygon([(cx + 28, cy - 30), (cx + 48, cy - 18), (cx + 22, cy - 10)], fill=color)


def draw_sticky(draw, x, y, w, h, fill='#FFE8A3', pin='#C45C26'):
    round_rect(draw, [x, y, x + w, y + h], 8, fill, '#E6C86A', 2)
    # pin
    draw.ellipse([x + w // 2 - 8, y - 6, x + w // 2 + 8, y + 10], fill=pin)
    # lines
    for i in range(3):
        yy = y + 28 + i * 16
        draw.line([x + 16, yy, x + w - 16, yy], fill='#D4B56A', width=2)


def draw_paw(draw, cx, cy, color='#C45C26'):
    draw.ellipse([cx - 18, cy - 8, cx + 18, cy + 22], fill=color)
    for dx, dy in [(-22, -18), (-8, -26), (8, -26), (22, -18)]:
        draw.ellipse([cx + dx - 9, cy + dy - 9, cx + dx + 9, cy + dy + 9], fill=color)


def draw_leaf(draw, cx, cy, color='#3A5A40'):
    draw.ellipse([cx - 28, cy - 40, cx + 28, cy + 40], fill=color)
    draw.line([cx, cy - 36, cx, cy + 36], fill='#1E2A1F', width=3)
    draw.line([cx, cy, cx + 18, cy - 12], fill='#1E2A1F', width=2)
    draw.line([cx, cy + 8, cx - 16, cy + 20], fill='#1E2A1F', width=2)


def draw_compass(draw, cx, cy):
    draw.ellipse([cx - 42, cy - 42, cx + 42, cy + 42], outline='#3A5A40', width=5)
    draw.ellipse([cx - 30, cy - 30, cx + 30, cy + 30], outline='#8A9A86', width=2)
    draw.polygon([(cx, cy - 28), (cx + 8, cy), (cx, cy + 10), (cx - 8, cy)], fill='#C45C26')
    draw.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill='#1E2A1F')


def draw_footprints(draw, x, y, color='#3A5A40'):
    for i, (dx, dy) in enumerate([(0, 0), (28, -22), (55, 4), (85, -18)]):
        ox, oy = x + dx, y + dy
        draw.ellipse([ox, oy, ox + 14, oy + 22], fill=color)
        draw.ellipse([ox + 2, oy - 10, ox + 12, oy], fill=color)


def make_rich_menu():
    W, H = 2500, 1686
    img = Image.new('RGB', (W, H), '#F7F3EC')
    draw = ImageDraw.Draw(img)
    rows = [
        ('#2D6A4F', '#D8F3DC', '♻️', '換罐計畫', '一罐一罐累積。', 'jar'),
        ('#C45C26', '#FFE8CC', '🔥', '一起搞事', '最近又有什麼新鮮事。', 'chaos'),
        ('#3A5A40', '#E6F0E4', '🌿', '野放中', '看看匠寵最近跑去哪。', 'wild'),
    ]
    rh = H // 3
    title_f = font(92)
    sub_f = font(48)
    for i, (accent, hero, emoji, title, sub, kind) in enumerate(rows):
        y0 = i * rh
        # card inset
        pad = 36
        round_rect(
            draw,
            [pad, y0 + pad // 2, W - pad, y0 + rh - pad // 2],
            48,
            '#FFFFFF',
            accent,
            8,
        )
        # left color stripe
        draw.rectangle([pad, y0 + pad // 2, pad + 28, y0 + rh - pad // 2], fill=accent)
        # illustration zone
        ix0, iy0 = 120, y0 + 70
        round_rect(draw, [ix0, iy0, ix0 + 320, iy0 + rh - 140], 36, hero)
        cx, cy = ix0 + 160, iy0 + (rh - 140) // 2
        if kind == 'jar':
            draw_jar(draw, cx - 30, cy, 1.4)
            draw_cycle(draw, cx + 70, cy + 10)
        elif kind == 'chaos':
            draw_sticky(draw, cx - 90, cy - 50, 120, 120)
            draw_paw(draw, cx + 70, cy + 10)
        else:
            draw_leaf(draw, cx - 50, cy)
            draw_compass(draw, cx + 70, cy)
            draw_footprints(draw, cx - 20, cy + 70, '#6B8F71')

        tx = 500
        draw.text((tx, y0 + rh // 2 - 70), f'{emoji}  {title}', fill='#1F1A14', font=title_f)
        draw.text((tx, y0 + rh // 2 + 40), sub, fill='#6B6358', font=sub_f)
        # CTA chevron
        draw.text((W - 160, y0 + rh // 2 - 30), '→', fill=accent, font=title_f)

    out = os.path.join(ROOT, 'rich-menu-three-worlds.png')
    os.makedirs(ROOT, exist_ok=True)
    img.save(out, 'PNG', optimize=True)
    print('rich menu', out, img.size)


def make_card_heroes():
    cards_dir = os.path.join(ROOT, 'cards')
    os.makedirs(cards_dir, exist_ok=True)
    specs = [
        ('jar-explain', '#D8F3DC', '#2D6A4F', 'cycle'),
        ('jar-reg', '#D8F3DC', '#2D6A4F', 'paw_jar'),
        ('jar-enter', '#D8F3DC', '#2D6A4F', 'sticker'),
        ('jar-vault', '#D8F3DC', '#2D6A4F', 'stack'),
        ('jar-history', '#D8F3DC', '#2D6A4F', 'stack'),
        ('jar-stores', '#D8F3DC', '#2D6A4F', 'cycle'),
        ('jar-faq', '#D8F3DC', '#2D6A4F', 'cycle'),
        ('chaos-aowu', '#FFE8CC', '#C45C26', 'paw'),
        ('chaos-frog', '#FFE8CC', '#C45C26', 'sticky'),
        ('chaos-guide', '#FFE8CC', '#C45C26', 'sticky'),
        ('chaos-reward', '#FFE8CC', '#C45C26', 'sticky'),
        ('chaos-month', '#FFE8CC', '#C45C26', 'sticky'),
        ('chaos-bundle', '#FFE8CC', '#C45C26', 'paw'),
        ('wild-web', '#E6F0E4', '#3A5A40', 'leaf'),
        ('wild-ig', '#E6F0E4', '#3A5A40', 'compass'),
        ('wild-threads', '#E6F0E4', '#3A5A40', 'foot'),
        ('wild-fb', '#E6F0E4', '#3A5A40', 'leaf'),
        ('wild-news', '#E6F0E4', '#3A5A40', 'compass'),
        ('wild-stores', '#E6F0E4', '#3A5A40', 'foot'),
        ('wild-story', '#E6F0E4', '#3A5A40', 'leaf'),
        ('world-jar', '#D8F3DC', '#2D6A4F', 'cycle'),
        ('world-chaos', '#FFE8CC', '#C45C26', 'sticky'),
        ('world-wild', '#E6F0E4', '#3A5A40', 'compass'),
        ('gate', '#D8F3DC', '#2D6A4F', 'paw_jar'),
    ]
    for name, hero, accent, kind in specs:
        img = Image.new('RGB', (800, 420), hero)
        draw = ImageDraw.Draw(img)
        # paper texture dots
        for i in range(40):
            x = (i * 97) % 800
            y = (i * 53) % 420
            draw.ellipse([x, y, x + 3, y + 3], fill=accent + '22' if False else hero)
            draw.point((x, y), fill=accent)
        cx, cy = 400, 210
        if kind == 'cycle':
            draw_jar(draw, cx - 50, cy, 1.6)
            draw_cycle(draw, cx + 80, cy)
        elif kind == 'paw_jar':
            draw_jar(draw, cx - 40, cy + 10, 1.5)
            draw_paw(draw, cx + 90, cy - 10, accent)
        elif kind == 'sticker':
            round_rect(draw, [cx - 120, cy - 70, cx + 120, cy + 70], 20, '#FFFDF8', accent, 5)
            draw.text((cx, cy - 10), '8 DIGITS', fill=accent, font=font(48), anchor='mm')
            draw.text((cx, cy + 40), '序號貼紙', fill='#1F1A14', font=font(36), anchor='mm')
        elif kind == 'stack':
            for j, dx in enumerate((-60, -20, 20)):
                draw_jar(draw, cx + dx, cy + j * 8, 1.1 + j * 0.1)
        elif kind == 'sticky':
            draw_sticky(draw, cx - 70, cy - 70, 140, 150, '#FFE8A3', accent)
        elif kind == 'paw':
            draw_paw(draw, cx, cy, accent)
        elif kind == 'leaf':
            draw_leaf(draw, cx, cy, accent)
        elif kind == 'compass':
            draw_compass(draw, cx, cy)
        elif kind == 'foot':
            draw_footprints(draw, cx - 60, cy, accent)
        out = os.path.join(cards_dir, f'{name}.png')
        img.save(out, 'PNG', optimize=True)
        print('card', out)


if __name__ == '__main__':
    make_rich_menu()
    make_card_heroes()
