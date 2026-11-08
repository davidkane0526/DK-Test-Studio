#!/usr/bin/env python3
"""Reject blank Android WebView screenshots, even when an Activity PID exists.

Uses only Python standard library. Samples the first 20% of a standard RGB(A)
PNG, excluding the Android navigation bar, which can mask an empty WebView.
"""
import struct
import sys
import zlib
from pathlib import Path


def verify(filename):
    data = Path(filename).read_bytes()
    if data[:8] != b'\\x89PNG\\r\\n\\x1a\\n':
        raise ValueError('not PNG')
    offset, width, height, channels, idats = 8, 0, 0, 0, []
    while offset < len(data):
        if offset + 8 > len(data):
            raise ValueError('truncated chunk header')
        length = struct.unpack_from('>I', data, offset)[0]
        name = data[offset + 4:offset + 8]
        offset += 8
        if offset + length + 4 > len(data):
            raise ValueError('truncated chunk')
        chunk = data[offset:offset + length]
        offset += length + 4
        if name == b'IHDR':
            width, height, bits, kind, comp, flt, interlace = struct.unpack('>IIBBBBB', chunk)
            if bits != 8 or kind not in (2, 6) or comp or flt or interlace:
                raise ValueError('unsupported PNG screenshot format')
            channels = 3 if kind == 2 else 4
        elif name == b'IDAT':
            idats.append(chunk)
        elif name == b'IEND':
            break
    if width < 200 or height < 400 or not idats:
        raise ValueError('invalid Android screenshot dimensions')
    stride = width * channels
    rows = memoryview(zlib.decompress(b''.join(idats)))
    if len(rows) != height * (stride + 1):
        raise ValueError('PNG decompression size mismatch')
    prev = bytearray(stride)
    dark = total = 0
    for y in range(min(height // 5, 480)):
        start = y * (stride + 1)
        kind = rows[start]
        row = bytearray(rows[start + 1:start + 1 + stride])
        if kind == 1:
            for i in range(channels, stride):
                row[i] = (row[i] + row[i-channels]) & 255
        elif kind == 2:
            for i in range(stride):
                row[i] = (row[i] + prev[i]) & 255
        elif kind == 3:
            for i in range(stride):
                left = row[i-channels] if i >= channels else 0
                row[i] = (row[i] + (left + prev[i]) // 2) & 255
        elif kind == 4:
            for i in range(stride):
                a = row[i-channels] if i >= channels else 0
                b = prev[i]
                c = prev[i-channels] if i >= channels else 0
                p = a + b - c
                da, db, dc = abs(p-a), abs(p-b), abs(p-c)
                predictor = a if da <= db and da <= dc else b if db <= dc else c
                row[i] = (row[i] + predictor) & 255
        elif kind != 0:
            raise ValueError('invalid PNG row filter')
        for x in range(0, width, 4):
            pixel = x * channels
            total += 1
            if min(row[pixel:pixel+3]) < 225:
                dark += 1
        prev = row
    print(f'Android PNG {width}x{height}: top-UI contrast pixels={dark}/{total}')
    if dark < max(300, total // 1000):
        raise ValueError('blank white WebView: UI did not visibly render')


if __name__ == '__main__':
    try:
        verify(sys.argv[1])
    except Exception as error:
        print(f'FS-Pro screenshot failed: {error}', file=sys.stderr)
        sys.exit(1)
