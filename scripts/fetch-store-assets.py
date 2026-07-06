#!/usr/bin/env python3
"""Fetch App Store screenshots + facts for every Midgar landing page.

Source of truth is the App Store Connect API (real, original-resolution store
screenshots + the exact submitted localization) merged with the public iTunes
lookup (ratings, price, full marketing description, release date) for live apps.
In-review apps that iTunes does not yet serve fall back to ASC localization text
and the repo's marketing AppIcon.

Outputs:
  - public/screenshots/<slug>/<device>-<n>.webp  (optimized, self-hosted)
  - public/screenshots/<slug>/icon.png + icon.webp
  - src/data/landing-facts.json                  (manifest consumed at build)

Requires ASC creds in env (source ~/.config/midgar/credentials.env first):
  ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY_PATH
Tools: cwebp on PATH. Run from repo root: python3 scripts/fetch-store-assets.py
"""

import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
import urllib.error

import jwt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS_DIR = os.path.join(ROOT, "public", "screenshots")
FACTS_PATH = os.path.join(ROOT, "src", "data", "landing-facts.json")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"

# slug -> identity. color is a seed accent (refined later by content/design).
APPS = [
    {"slug": "dreameater", "trackId": 6661019277, "shortName": "Dream Eater", "color": "#6366F1", "status": "live"},
    {"slug": "psywave", "trackId": 6727000827, "shortName": "Psywave", "color": "#8B5CF6", "status": "live"},
    {"slug": "doublekick", "trackId": 6736581403, "shortName": "Double Kick", "color": "#F43F5E", "status": "live"},
    {"slug": "pixiepocket", "trackId": 6751730339, "shortName": "PixiePocket", "color": "#EC4899", "status": "live"},
    {"slug": "appofthedead", "trackId": 6746733380, "shortName": "App of the Dead", "color": "#A855F7", "status": "live"},
    {"slug": "masterofflags", "trackId": 1484270248, "shortName": "Master of Flags", "color": "#EF4444", "status": "live"},
    {"slug": "masterofinventory", "trackId": 1523538855, "shortName": "Master of Inventory", "color": "#10B981", "status": "live"},
    {"slug": "sforesight", "trackId": 6736438070, "shortName": "SForesight", "color": "#38BDF8", "status": "live"},
    {"slug": "solarbeam", "trackId": 6705124497, "shortName": "Solar Beam", "color": "#F59E0B", "status": "live"},
    {"slug": "psybeam", "trackId": 6777952645, "shortName": "Psybeam", "color": "#06B6D4", "status": "live"},
    {"slug": "payday", "trackId": 6779927672, "shortName": "Pay Day", "color": "#22C55E", "status": "review"},
    {"slug": "helia", "trackId": 6785542220, "shortName": "Helia", "color": "#F5A623", "status": "review"},
    {"slug": "embr", "trackId": 6784940198, "shortName": "Embr", "color": "#9147FF", "status": "live"},
]

# Per-slug fallbacks for in-review apps iTunes does not serve yet.
REVIEW_FALLBACK = {
    "psybeam": {
        "category": "Travel",
        "price": "Free",
        "repoIcon": os.path.expanduser("~/Dev/ios/psybeam"),
    },
    "payday": {
        "category": "Business",
        "price": "Free",
        "repoIcon": os.path.expanduser("~/Dev/ios/PayDay"),
    },
    "helia": {
        "category": "Health & Fitness",
        "price": "Free",
        "repoIcon": os.path.expanduser("~/Dev/ios/Helia"),
    },
}

DEVICE_PREF = {
    "iphone": ["APP_IPHONE_69", "APP_IPHONE_67", "APP_IPHONE_65", "APP_IPHONE_61",
               "APP_IPHONE_58", "APP_IPHONE_55", "APP_IPHONE_47"],
    "ipad": ["APP_IPAD_PRO_3GEN_129", "APP_IPAD_PRO_129", "APP_IPAD_105", "APP_IPAD_97"],
    "tv": ["APP_APPLE_TV"],
    "mac": ["APP_DESKTOP"],
}

# Pin a slug to specific screenshot buckets when ASC retains platform versions the
# public storefront no longer surfaces. Solar Beam still has READY_FOR_SALE
# tvOS/visionOS records and an in-review iOS build in ASC, but the live US listing
# is a free Mac app — the landing page must match what a visitor can actually get.
DEVICE_ALLOW = {
    "solarbeam": {"mac"},
}
# Cap the stored webp width per device class (display never exceeds this @2x).
WIDTH_CAP = {"iphone": 1290, "ipad": 1600, "tv": 1920, "mac": 1920}


def asc_token():
    key = open(os.path.expanduser(os.environ["ASC_PRIVATE_KEY_PATH"])).read()
    now = int(time.time())
    return jwt.encode(
        {"iss": os.environ["ASC_ISSUER_ID"], "iat": now, "exp": now + 1100, "aud": "appstoreconnect-v1"},
        key, algorithm="ES256", headers={"kid": os.environ["ASC_KEY_ID"], "typ": "JWT"},
    )


TOKEN = None


def asc_get(path):
    global TOKEN
    req = urllib.request.Request("https://api.appstoreconnect.apple.com" + path,
                                 headers={"Authorization": "Bearer " + TOKEN})
    for attempt in range(3):
        try:
            return json.loads(urllib.request.urlopen(req, timeout=45).read())
        except urllib.error.HTTPError as e:
            if e.code == 401:
                TOKEN = asc_token()
                req.headers["Authorization"] = "Bearer " + TOKEN
                continue
            if e.code >= 500 and attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            raise
    raise RuntimeError("asc_get failed: " + path)


def itunes(track_id):
    url = f"https://itunes.apple.com/lookup?id={track_id}&country=us"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    d = json.loads(urllib.request.urlopen(req, timeout=45).read())
    return d["results"][0] if d.get("resultCount") else None


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)


def to_webp(src_png, dest_webp, cap_width):
    """Resize-to-cap (keep aspect) and encode webp via cwebp."""
    subprocess.run(
        ["cwebp", "-quiet", "-q", "80", "-resize", str(cap_width), "0", src_png, "-o", dest_webp],
        check=True,
    )


def template_url(image_asset, fmt="png"):
    return (image_asset["templateUrl"]
            .replace("{w}", str(image_asset["width"]))
            .replace("{h}", str(image_asset["height"]))
            .replace("{f}", fmt))


def canonical_store_url(track_view_url, track_id):
    """Bare US-storefront App Store link with tracking params (uo/mt/platform) stripped."""
    url = track_view_url or f"https://apps.apple.com/us/app/id{track_id}"
    url = url.replace("https://apps.apple.com/app/", "https://apps.apple.com/us/app/")
    return url.split("?", 1)[0]


def label_from_filename(name, idx):
    """dreameater_iphone_1_interpret.png -> 'interpret'."""
    stem = re.sub(r"\.(png|jpe?g)$", "", name or "", flags=re.I)
    parts = re.split(r"[_\-\.]", stem)
    words = [p for p in parts if p and not p.isdigit()
             and p.lower() not in {"iphone", "ipad", "tv", "appletv", "mac", "desktop"}]
    # drop a leading brand token if present
    tail = words[-3:] if len(words) > 3 else words
    pretty = " ".join(tail).strip()
    return pretty.title() if pretty else f"Screen {idx + 1}"


def collect_versions(track_id):
    """Return {platform: versionRecord} choosing live state, else newest."""
    data = asc_get(
        f"/v1/apps/{track_id}/appStoreVersions?limit=30"
        "&fields[appStoreVersions]=versionString,appStoreState,platform,createdDate"
    )["data"]
    by_plat = {}
    rank = {"READY_FOR_SALE": 3, "PENDING_DEVELOPER_RELEASE": 2, "PENDING_APPLE_RELEASE": 2}
    for v in data:
        plat = v["attributes"]["platform"]
        cur = by_plat.get(plat)
        score = (rank.get(v["attributes"]["appStoreState"], 0), v["attributes"].get("createdDate") or "")
        if cur is None or score > cur["_score"]:
            v["_score"] = score
            by_plat[plat] = v
    return by_plat


def screenshots_for_version(version_id):
    """{device_bucket: [imageAsset...]} for the en-US (or first) localization."""
    locs = asc_get(
        f"/v1/appStoreVersions/{version_id}/appStoreVersionLocalizations"
        "?limit=40&fields[appStoreVersionLocalizations]=locale,description,whatsNew,keywords,promotionalText,marketingUrl,supportUrl"
    )["data"]
    loc = next((l for l in locs if l["attributes"]["locale"] == "en-US"),
               next((l for l in locs if l["attributes"]["locale"].startswith("en")), locs[0] if locs else None))
    if not loc:
        return {}, {}
    sets = asc_get(f"/v1/appStoreVersionLocalizations/{loc['id']}/appScreenshotSets?limit=40")["data"]
    have = {s["attributes"]["screenshotDisplayType"]: s["id"] for s in sets}
    buckets = {}
    for bucket, prefs in DEVICE_PREF.items():
        chosen = next((have[p] for p in prefs if p in have), None)
        if not chosen:
            continue
        shots = asc_get(
            f"/v1/appScreenshotSets/{chosen}/appScreenshots?limit=20"
            "&fields[appScreenshots]=imageAsset,fileName,sourceFileChecksum"
        )["data"]
        assets = [s["attributes"] for s in shots if s["attributes"].get("imageAsset")]
        if assets:
            buckets[bucket] = assets  # each item: {"imageAsset": {...}, "fileName": str}
    return buckets, loc["attributes"]


def process_app(app):
    slug, track_id = app["slug"], app["trackId"]
    print(f"\n=== {slug} ({track_id}) [{app['status']}] ===")
    out_dir = os.path.join(SHOTS_DIR, slug)
    os.makedirs(out_dir, exist_ok=True)
    tmp = os.path.join(out_dir, "_tmp.png")

    by_plat = collect_versions(track_id)
    print("  versions:", {p: f"{v['attributes']['versionString']}/{v['attributes']['appStoreState']}" for p, v in by_plat.items()})

    # Merge screenshot buckets across the chosen platform versions.
    merged, loc_attrs = {}, {}
    plat_order = ["IOS", "MAC_OS", "TV_OS", "VISION_OS"]
    for plat in plat_order + [p for p in by_plat if p not in plat_order]:
        if plat not in by_plat:
            continue
        buckets, attrs = screenshots_for_version(by_plat[plat]["id"])
        if attrs and not loc_attrs:
            loc_attrs = attrs
        for bucket, assets in buckets.items():
            merged.setdefault(bucket, assets)

    allow = DEVICE_ALLOW.get(slug)
    if allow:
        merged = {b: a for b, a in merged.items() if b in allow}

    shots_manifest = {}
    for bucket, assets in merged.items():
        cap = WIDTH_CAP[bucket]
        items = []
        for i, attrs in enumerate(assets):
            asset = attrs["imageAsset"]
            src = template_url(asset, "png")
            try:
                download(src, tmp)
            except Exception as e:
                print(f"  ! {bucket} #{i} download failed: {e}")
                continue
            dest_name = f"{bucket}-{i + 1}.webp"
            dest = os.path.join(out_dir, dest_name)
            try:
                to_webp(tmp, dest, min(asset["width"], cap))
            except Exception as e:
                print(f"  ! {bucket} #{i} webp failed: {e}")
                continue
            scale = min(asset["width"], cap) / asset["width"]
            items.append({
                "src": f"/screenshots/{slug}/{dest_name}",
                "w": round(asset["width"] * scale),
                "h": round(asset["height"] * scale),
                "label": label_from_filename(attrs.get("fileName"), i),
            })
        if items:
            shots_manifest[bucket] = items
            print(f"  {bucket}: {len(items)} shots")
    if os.path.exists(tmp):
        os.remove(tmp)

    # Facts: iTunes for live, ASC localization + constants for review.
    it = itunes(track_id) if app["status"] == "live" else None
    fact = {
        "slug": slug,
        "trackId": track_id,
        "shortName": app["shortName"],
        "status": app["status"],
        "primaryColor": app["color"],
        "screenshots": shots_manifest,
    }
    if it:
        fact.update({
            "name": it.get("trackName"),
            "appStoreUrl": canonical_store_url(it.get("trackViewUrl"), track_id),
            "description": it.get("description", "").strip(),
            "releaseNotes": (it.get("releaseNotes") or "").strip(),
            "category": it.get("primaryGenreName"),
            "genres": it.get("genres", []),
            "price": "Free" if not it.get("price") else f"${it['price']:.2f}",
            "rating": round(it.get("averageUserRating") or 0, 2),
            "ratingCount": it.get("userRatingCount") or 0,
            "version": it.get("version"),
            "releaseDate": it.get("releaseDate"),
            "currentVersionReleaseDate": it.get("currentVersionReleaseDate"),
            "minimumOsVersion": it.get("minimumOsVersion"),
            "contentRating": it.get("contentAdvisoryRating") or it.get("trackContentRating"),
            "languages": it.get("languageCodesISO2A", []),
            "supportedDevices": it.get("supportedDevices", []),
            "sellerName": it.get("sellerName"),
            "bundleId": it.get("bundleId"),
            "icon": (it.get("artworkUrl512") or "").replace("512x512bb", "1024x1024bb"),
        })
    else:
        fb = REVIEW_FALLBACK.get(slug, {})
        app_info = asc_get(f"/v1/apps/{track_id}?fields[apps]=name,bundleId")["data"]
        fact.update({
            "name": app_info["attributes"]["name"],
            "appStoreUrl": f"https://apps.apple.com/us/app/id{track_id}",
            "description": (loc_attrs.get("description") or "").strip(),
            "releaseNotes": (loc_attrs.get("whatsNew") or "").strip(),
            "promotionalText": (loc_attrs.get("promotionalText") or "").strip(),
            "category": fb.get("category"),
            "price": fb.get("price", "Free"),
            "rating": 0,
            "ratingCount": 0,
            "version": by_plat.get("IOS", {}).get("attributes", {}).get("versionString"),
            "bundleId": app_info["attributes"]["bundleId"],
            "sellerName": "Midgar Oy",
            "icon": None,
        })

    fact["marketingUrl"] = loc_attrs.get("marketingUrl")
    fact["supportUrl"] = loc_attrs.get("supportUrl")
    fact["keywords"] = (loc_attrs.get("keywords") or "")

    # Icon: iTunes 1024 for live, repo AppIcon for review.
    icon_png = os.path.join(out_dir, "icon.png")
    icon_src = fact.get("icon")
    if not icon_src and slug in REVIEW_FALLBACK:
        icon_src = find_repo_icon(REVIEW_FALLBACK[slug]["repoIcon"])
    if icon_src:
        try:
            if icon_src.startswith("http"):
                download(icon_src, icon_png)
            else:
                shutil.copyfile(icon_src, icon_png)
            to_webp(icon_png, os.path.join(out_dir, "icon.webp"), 512)
            fact["iconLocal"] = f"/screenshots/{slug}/icon.webp"
        except Exception as e:
            print(f"  ! icon failed: {e}")

    devices = []
    if "iphone" in shots_manifest:
        devices.append("iPhone")
    if "ipad" in shots_manifest:
        devices.append("iPad")
    if "tv" in shots_manifest:
        devices.append("Apple TV")
    if "mac" in shots_manifest:
        devices.append("Mac")
    fact["platforms"] = devices or ["iPhone"]
    return fact


def find_repo_icon(repo):
    best = None
    for dirpath, _dirs, files in os.walk(repo):
        if "DerivedData" in dirpath or "/.build" in dirpath:
            continue
        if "AppIcon.appiconset" in dirpath:
            for f in files:
                if f.lower().endswith(".png"):
                    p = os.path.join(dirpath, f)
                    sz = os.path.getsize(p)
                    if best is None or sz > best[1]:
                        best = (p, sz)
    return best[0] if best else None


def keep_pinned_description(fact, slug, existing):
    """Preserve a pinned app's curated description against a stale iTunes cache.

    DEVICE_ALLOW apps are mid platform-transition: the public listing leads (e.g.
    Solar Beam is already a Mac app) but the iTunes lookup intermittently serves
    the previous-platform description. For these, keep the committed description
    so a flaky lookup can't revert the page to wrong-platform copy.
    """
    if slug in DEVICE_ALLOW and existing.get(slug, {}).get("description"):
        fact["description"] = existing[slug]["description"]
        print(f"  kept curated description for pinned {slug}")


def main():
    global TOKEN
    for var in ("ASC_KEY_ID", "ASC_ISSUER_ID", "ASC_PRIVATE_KEY_PATH"):
        if not os.environ.get(var):
            sys.exit(f"missing env {var} — source ~/.config/midgar/credentials.env")
    TOKEN = asc_token()
    argv = sys.argv[1:]
    if "--live-only" in argv:
        only = {a["slug"] for a in APPS if a["status"] == "live"}
    else:
        only = set(argv)
    existing = {}
    if os.path.exists(FACTS_PATH):
        existing = {a["slug"]: a for a in json.load(open(FACTS_PATH))["apps"]}
    facts = []
    for app in APPS:
        if only and app["slug"] not in only:
            continue
        try:
            f = process_app(app)
        except Exception as e:
            print(f"  !! {app['slug']} FAILED: {e}")
            continue
        keep_pinned_description(f, app["slug"], existing)
        facts.append(f)
    merged = dict(existing)
    for f in facts:
        merged[f["slug"]] = f
    known = [a["slug"] for a in APPS]
    extras = [s for s in merged if s not in known]
    facts = [merged[s] for s in known + extras if s in merged]
    with open(FACTS_PATH, "w") as fh:
        json.dump({"apps": facts}, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print(f"\n✓ wrote {FACTS_PATH} ({len(facts)} apps)")


if __name__ == "__main__":
    main()
