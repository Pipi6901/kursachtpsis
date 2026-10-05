"""Формирует демонстрационный набор данных для серверной части.

Запуск из каталога ml-service:
    python -m tools.generate_demo_data            # файл backend/src/main/resources/demo/forecast-demo-data.json

Набор содержит каналы, маркетинговые кампании (история и план на 26 недель) и еженедельные
продажи гостиницы (бронирования и выручка). Данные синтетические; параметры порождающего
процесса известны, поэтому на них проверяется интеллектуальный компонент (см. tests/).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from tools.synthetic import generate

DESCRIPTIONS = {
    "search": "Реклама в поисковых системах: показ по запросам о гостиницах и отдыхе в городе",
    "social": "Таргетированная реклама в социальных сетях и мессенджерах",
    "email": "Email-рассылки и сообщения в мессенджерах по базе гостей и подписчиков",
    "ota": "Размещение и продвижение номеров на онлайн-площадках бронирования",
    "partners": "Договоры с турфирмами, корпоративными клиентами и организаторами мероприятий",
    "outdoor": "Наружная реклама, радио и печатные издания",
}

DEFAULT_TARGET = Path(__file__).resolve().parents[2] / "backend" / "src" / "main" / "resources" / "demo" / "forecast-demo-data.json"


def build() -> dict:
    d = generate()
    return {
        "description": "Синтетические демонстрационные данные для модуля прогнозирования продаж",
        "generated_by": "ml-service/tools/generate_demo_data.py",
        "seed": d.meta["seed"],
        "history_from": d.weeks[0].isoformat(),
        "history_to": d.weeks[d.n_hist - 1].isoformat(),
        "channels": [{"code": c.code, "name": c.name, "type": c.kind, "description": DESCRIPTIONS[c.code]}
                     for c in d.channels],
        "campaigns": [{"channel": c.channel, "name": c.name, "start_date": c.start.isoformat(),
                       "end_date": c.end.isoformat(), "budget": c.budget}
                      for c in sorted(d.campaigns, key=lambda c: (c.start, c.channel))],
        "sales": [{"week_start": d.weeks[i].isoformat(), "bookings": int(d.bookings[i]),
                   "revenue": float(d.revenue[i])} for i in range(d.n_hist)],
    }


def main() -> None:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_TARGET
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = build()
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{target}: каналов {len(payload['channels'])}, кампаний {len(payload['campaigns'])}, "
          f"недель продаж {len(payload['sales'])}")


if __name__ == "__main__":
    main()
