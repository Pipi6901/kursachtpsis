#!/usr/bin/env python3
"""Сжатие рисунков для записки: палитра без размытия краёв, чтобы файл Word оставался небольшим (подписи не страдают)."""
import glob
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, '..', 'img')


def main():
    total_before = total_after = 0
    for path in sorted(glob.glob(os.path.join(IMG, '*.png'))):
        name = os.path.basename(path)
        before = os.path.getsize(path)
        im = Image.open(path)
        if im.mode == 'P':
            continue
        colors = 64 if name.startswith('fig_') else 256
        im = im.convert('RGB').quantize(colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        im.save(path, optimize=True)
        after = os.path.getsize(path)
        total_before += before
        total_after += after
        print(f'{name}: {before // 1024} КБ -> {after // 1024} КБ')
    print(f'итого: {total_before // 1024} КБ -> {total_after // 1024} КБ')


if __name__ == '__main__':
    sys.exit(main())
