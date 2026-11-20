import requests
import os
import json
import time
from datetime import date, datetime, timedelta, timezone, time as dt_time
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from dotenv import load_dotenv

PROJECT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_DIR / "data"
load_dotenv(PROJECT_DIR / ".env")

STARTGG_BASE_URL = "https://api.start.gg/gql/alpha"
with open(PROJECT_DIR / "queries" / "get_events.graphql", "r") as f:
    STARTGG_QUERY = f.read()


# which weekend: the Thursday of the current week and the Monday after it (the end of Sunday)
def weekend_window(day=None):
    day = day or date.today()
    monday = day - timedelta(days=day.weekday())
    return monday + timedelta(days=3), monday + timedelta(days=7)


# the weekend's start and end as timestamps in a given timezone, so a US bracket on Sunday evening
# still counts even though it's Monday morning in Europe; falls back to UTC if the timezone is unknown
def local_window(thursday, monday, tz_name):
    try:
        tz = ZoneInfo(tz_name)
    except (TypeError, ValueError, ZoneInfoNotFoundError):
        tz = timezone.utc
    local_start = datetime.combine(thursday, dt_time(), tz)
    local_end = datetime.combine(monday, dt_time(), tz)
    return int(local_start.timestamp()), int(local_end.timestamp())


# startgg queries check the end of the event but i wanted to check the start was in the window, so we pad the query by 2 days on either side to make sure we get all events that start in the window
QUERY_PADDING = 2 * 86400


# pull all ult tournaments worldwide from startgg for the weekend
def fetch_tournaments(thursday, monday):
    headers = {"Authorization": f"Bearer {os.environ['STARTGG_TOKEN']}"}
    start, end = local_window(thursday, monday, "UTC")
    variables = {"after": start - QUERY_PADDING, "before": end + QUERY_PADDING}

    tournaments = []
    page = 1
    while True:
        response = requests.post(
            STARTGG_BASE_URL,
            json={"query": STARTGG_QUERY, "variables": {**variables, "page": page}},
            headers=headers,
            timeout=30)
        response.raise_for_status()
        data = response.json()
        if "errors" in data:
            raise RuntimeError(data["errors"])

        result = data["data"]["tournaments"]
        tournaments.extend(result["nodes"])

        if page >= result["pageInfo"]["totalPages"]:
            break
        page += 1
        time.sleep(0.8)

    return tournaments


# keep only offline events above min_entrants whose bracket starts in the window (in the tournament's timezone)
def filter_events(tournaments, thursday, monday, min_entrants=32):
    for tournament in tournaments:
        local_start, local_end = local_window(thursday, monday, tournament["timezone"])
        tournament["events"] = [
            event for event in tournament["events"] or []
            if not event["isOnline"]
            and (event["numEntrants"] or 0) > min_entrants
            and event["startAt"] is not None
            and local_start <= event["startAt"] < local_end
        ]
    return [tournament for tournament in tournaments if tournament["events"]]


def save_tournaments(tournaments, path=DATA_DIR / "discovery.json"):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(tournaments, f, indent=2, ensure_ascii=False)


# fetch and filter this weekend's tournaments
def get_weekend_tournaments(day=None, min_entrants=32):
    thursday, monday = weekend_window(day)
    return filter_events(fetch_tournaments(thursday, monday), thursday, monday, min_entrants)


if __name__ == "__main__":
    tournaments = get_weekend_tournaments()
    print(len(tournaments), "tournaments with more than 32 entrants this weekend")
    save_tournaments(tournaments)
