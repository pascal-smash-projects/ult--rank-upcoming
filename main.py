import json
import time
from datetime import datetime, timezone

from player_data.startgg import DATA_DIR, weekend_window, fetch_tournaments, filter_events, save_tournaments
from player_data.tier import tier_event
from player_data.players import add_player_metadata

SECONDS_BETWEEN_FETCHES = 4 

def discovery_fields(tournament, event):
    images = tournament["images"] or []
    return {
        "slug": event["slug"],
        "tournament": tournament["name"],
        "event": event["name"],
        "country": tournament["countryCode"],
        "city": tournament["city"],
        "start_at": event["startAt"],
        "timezone": tournament["timezone"],
        "logo_url": images[0]["url"] if images else None,
        "entrants": event["numEntrants"],
    }

def tier_all_events(tournaments):
    events = []
    for t in tournaments:
        for event in t["events"]:
            print(f"Now Tiering {event['slug']}...")
            entry = discovery_fields(t, event)
            try:
                entry.update(tier_event(event["slug"]))
            except Exception as e:
                print(f"Error tiering {event['slug']}: {e}")
                entry["error"] = str(e)
            events.append(entry)
            time.sleep(SECONDS_BETWEEN_FETCHES)
    events.sort(key=lambda e: e.get("score", -1), reverse=True)
    return events

def save_tiered_events(events, path=DATA_DIR / "merged_and_tiered.json"):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(events, f, indent=2, ensure_ascii=False)

def main():
    print("Beginning startgg discovery...")
    thursday, monday = weekend_window()
    tournaments = filter_events(fetch_tournaments(thursday, monday), thursday, monday)
    save_tournaments(tournaments)
    print(len(tournaments), "tournaments found from startgg discovery")
    events = tier_all_events(tournaments)
    print(len(events), "events tiered and merged")
    print("Now fetching player metadata...")
    add_player_metadata(events)
    save_tiered_events({
        "window": {"start": thursday.isoformat(), "end": monday.isoformat()},
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "events": events,
    })

if __name__ == "__main__":
    main()