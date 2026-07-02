#!/usr/bin/env python3
"""Sync landing-facts.json app versions with their latest GitHub release.

App Store apps are refreshed by fetch-store-assets.py via the ASC API; apps
distributed through GitHub releases (githubUrl set) drift silently unless this
script reconciles them. Exits 0 with no changes when everything is in sync.
"""

import json
import sys
import urllib.request
from pathlib import Path

FACTS = Path(__file__).resolve().parent.parent / "src/data/landing-facts.json"


def latest_release(repo: str) -> tuple[str, str] | None:
    url = f"https://api.github.com/repos/{repo}/releases/latest"
    request = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.load(response)
    except Exception as error:
        print(f"::warning::{repo}: {error}", file=sys.stderr)
        return None
    tag = data.get("tag_name", "").lstrip("v")
    published = data.get("published_at", "")
    return (tag, published) if tag else None


def main() -> int:
    facts = json.loads(FACTS.read_text())
    changed = []
    for app in facts["apps"]:
        github_url = app.get("githubUrl", "")
        if not github_url.startswith("https://github.com/"):
            continue
        repo = "/".join(github_url.removeprefix("https://github.com/").split("/")[:2])
        release = latest_release(repo)
        if release is None:
            continue
        version, published = release
        if app.get("version") != version:
            changed.append(f"{app['name']}: {app.get('version')} -> {version}")
            app["version"] = version
            if published:
                app["currentVersionReleaseDate"] = published
    if changed:
        FACTS.write_text(json.dumps(facts, indent=2, ensure_ascii=False) + "\n")
        print("\n".join(changed))
    else:
        print("All GitHub-release app versions in sync")
    return 0


if __name__ == "__main__":
    sys.exit(main())
