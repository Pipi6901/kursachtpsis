"""Вторая процентовка: введение, разделы 1–4 (разделы 3 и 4 – проектирование, реализация, тестирование)."""
import docx_engine as E
import sec_intro
import sec_1
import sec_2
import sec_3a
import sec_3b
import sec_3c
import sec_4
from sources_data import SRC


def build():
    d = E.Doc()
    d.sources_db_all = SRC
    sec_intro.add(d)
    sec_1.add(d)
    sec_2.add(d)
    sec_3a.add(d)
    sec_3b.add(d)
    sec_3c.add(d)
    sec_4.add(d)
    d.h1('Список использованных источников', numbered=False)
    d.sources(SRC)
    return d
