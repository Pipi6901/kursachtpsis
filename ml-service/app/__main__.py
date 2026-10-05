"""Запуск: python -m app  (параметры — переменные окружения ML_*)."""
import uvicorn

from .config import get_settings


def main() -> None:
    s = get_settings()
    tls = {"ssl_certfile": s.ssl_certfile, "ssl_keyfile": s.ssl_keyfile} if s.ssl_certfile and s.ssl_keyfile else {}
    uvicorn.run("app.main:app", host=s.host, port=s.port, log_level=s.log_level.lower(), **tls)


if __name__ == "__main__":
    main()
