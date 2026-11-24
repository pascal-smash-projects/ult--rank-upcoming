import csv
import json
import os
import re
import time
from collections import Counter
from datetime import date

import pycountry
import requests

from .startgg import PROJECT_DIR, STARTGG_BASE_URL
from .tier import ENGINE_DIR

ULTIMATE_ID = 1386


def run_query(name, variables):
    with open(PROJECT_DIR / "queries" / name) as f:
        query = f.read()
    headers = {"Authorization": f"Bearer {os.environ['STARTGG_TOKEN']}"}
    response = requests.post(STARTGG_BASE_URL, json={"query": query, "variables": variables}, headers=headers, timeout=30)
    response.raise_for_status()
    data = response.json()
    if "errors" in data:
        raise RuntimeError(data["errors"])
    time.sleep(0.8)
    return data["data"]


def load_ranks():
    today = date.today().isoformat()
    with open(ENGINE_DIR / "ultrank_players.csv", newline="", encoding="utf-8") as f:
        return {
            int(row["Start.gg Num ID"]): int(re.search(r"#(\d+)", row["Note"]).group(1))
            for row in csv.DictReader(f)
            if row["Category"] == "0 - Ranking" and row["Start.gg Num ID"]
            and row["Start Date"] <= today < (row["End Date"] or "9999")
        }


# up to 3 characters the player picked in at least 10% of their recent singles games
def get_mains(player, player_id, characters):
    picks = Counter()
    for s in player["sets"]["nodes"]:
        if s["event"]["videogame"]["id"] != ULTIMATE_ID:
            continue
        mine = {slot["entrant"]["id"] for slot in s["slots"]
                if slot["entrant"] and [p["player"]["id"] for p in slot["entrant"]["participants"]] == [player_id]}
        picks.update(sel["character"]["id"] for game in s["games"] or [] for sel in game["selections"] or []
                     if sel["character"] and sel["entrant"]["id"] in mine)
    total = sum(picks.values())
    top = [(c, n) for c, n in picks.most_common() if n / total >= 0.1]
    # random only counts when its someones most common char
    top = top[:1] + [(c, n) for c, n in top[1:] if not characters[c]["name"].lower().startswith("random")]
    return [characters[c] for c, n in top[:3]]


# start.gg country names that pycountry doesn't know; GB nations use flagcdn's gb-eng style codes
COUNTRY_ALIASES = {
    "turkey": "tr", "russia": "ru", "korea": "kr", "uk": "gb", "england": "gb-eng", "scotland": "gb-sct",
    "wales": "gb-wls", "northern ireland": "gb-nir", "macau": "mo", "kosovo": "xk", "ivory coast": "ci",
    "palestine": "ps", "brunei": "bn", "cape verde": "cv", "swaziland": "sz", "macedonia": "mk",
    "holland": "nl", "the netherlands": "nl",
}


# start.gg country name -> ISO code for flags, or None if it isn't recognised
def country_code(name):
    if not name:
        return None
    if name.lower() in COUNTRY_ALIASES:
        return COUNTRY_ALIASES[name.lower()]
    try:
        return pycountry.countries.lookup(name).alpha_2.lower()
    except LookupError:
        print(f"  unknown country {name!r}")
        return None


def add_player_metadata(events):
    ranks = load_ranks()
    with open(PROJECT_DIR / "to-site" / "assets" / "characters.json", encoding="utf-8") as f:
        characters = {c["id"]: {"name": c["name"], "icon_url": c["icon_url"]} for c in json.load(f)}

    for event in events:
        print(f"Fetching metadata for {len(event.get('players', []))} players at {event['slug']}:")
        for player in event.get("players", []):
            player_id = player["startgg_id"]
            player["rank"] = ranks.get(player_id)
            # defaults if start.gg fails or the player has no profile data
            player["country"] = event["country"]
            player["mains"] = []
            try:
                data = run_query("get_player.graphql", {"id": player_id, "perPage": 20})["player"]
                if data is None:
                    raise RuntimeError("player not found on start.gg")
                country = ((data["user"] or {}).get("location") or {}).get("country")
                player["country"] = country_code(country) or event["country"]
                player["mains"] = get_mains(data, player_id, characters)
            except Exception as e:
                print(f"  Error fetching metadata for {player['tag']} ({player_id}): {e}")
                player["error"] = str(e)
                continue
            print(f"Fetched metadata for {player['tag']} in {event['slug']}: rank={player['rank']}, country={player['country']}, mains={[m['name'] for m in player['mains']]}")
