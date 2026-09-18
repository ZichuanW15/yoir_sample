"""Serve the real Web export/API with an exclusively owned temporary database.

Never reads DATABASE_URL from the caller, resets an existing DB, contacts a
deployment, or changes product sources. The seed is the application's fixture,
not mocked API responses. Playwright terminates this owned server after the run.
"""
import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[2]


def main():
    port = int(os.environ.get("WEB_QA_PORT", "43117"))
    if not 1024 <= port <= 65535:
        raise ValueError("Invalid WEB_QA_PORT")
    dist = Path(os.environ.get("WEB_QA_DIST_DIR", ROOT / "frontend/dist/web")).resolve()
    if not (dist / "index.html").is_file():
        raise SystemExit("Build first: EXPO_PUBLIC_API_URL=/api/v1 EXPO_PUBLIC_USE_DEMO_API=false npm run build:web")
    with TemporaryDirectory(prefix="yoir-web-qa-") as temporary:
        os.environ.update(
            DATABASE_URL=f"sqlite:///{temporary}/web_test.db",
            SEED_ON_STARTUP="true",
            STRIPE_SECRET_KEY="",
            MAILGUN_API_KEY="",
            ADMIN_EMAIL="",
            ADMIN_PASSWORD="",
            JWT_SECRET="isolated-browser-qa-secret-at-least-32-characters",
            CORS_ALLOW_ORIGINS=f"http://127.0.0.1:{port}",
            FRONTEND_DIST=str(dist),
        )
        os.environ.pop("YOIR_QA_ALLOW_DATABASE_RESET", None)
        sys.path.insert(0, str(ROOT / "backend"))
        import uvicorn
        uvicorn.run("app.main:app", host="127.0.0.1", port=port, log_level="warning")


if __name__ == "__main__":
    main()
