#!/usr/bin/env python3
"""Identify the Android SYSTEM launcher-ANR Wait button, not application UI.

Returns integer touchscreen coordinates only when the UIAutomator tree
explicitly contains an ANR title AND a 'Wait' action. Never clicks 'Close app'.
"""
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def coords(xml_path):
    root = ET.fromstring(Path(xml_path).read_text(encoding='utf-8'))
    texts = [(n.attrib.get('text') or '').strip() for n in root.iter('node')]
    if not any(("isn't responding" in t.lower()) or ("isn\u2019t responding" in t.lower())
               or ('not responding' in t.lower()) or ('\u65e0\u54cd\u5e94' in t)
               for t in texts):
        raise ValueError('no Android ANR dialog')
    for node in root.iter('node'):
        if (node.attrib.get('text') or '').strip().lower() not in ('wait', '\u7b49\u5f85'):
            continue
        bounds = node.attrib.get('bounds', '')
        numbers = [int(x) for x in re.findall(r'\d+', bounds)]
        if len(numbers) == 4 and numbers[2] > numbers[0] and numbers[3] > numbers[1]:
            return (numbers[0] + numbers[2]) // 2, (numbers[1] + numbers[3]) // 2
    raise ValueError('ANR dialog without Wait button')


if __name__ == '__main__':
    try:
        print(*coords(sys.argv[1]))
    except Exception as error:
        print('no safe ANR Wait action: ' + str(error), file=sys.stderr)
        sys.exit(1)
