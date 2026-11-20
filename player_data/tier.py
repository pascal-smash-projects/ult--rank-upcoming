import csv
import os
import sys
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parent.parent / "vendor" / "ultrank-scoring"

# kenniky's engine reads its CSVs and smashgg.key from the working directory on import
_cwd = os.getcwd()
os.chdir(ENGINE_DIR)
sys.path.insert(0, str(ENGINE_DIR))
try:
    import ultrank_tiering
finally:
    os.chdir(_cwd)

TIERS = [
    (9000, "P"),
    (6500, "S+"),
    (5000, "S"),
    (4000, "A+"),
    (3000, "A"),
    (2000, "B+"),
    (1000, "B"),
    (500, "C"),
]


def score_to_tier(score, counts):
    for threshold, label in TIERS:
        if score >= threshold:
            return label
    return "D" if counts else None


# UltRank tag -> alternative tags; the first alternative is usually the romanised name (あcola -> acola)
with open(ENGINE_DIR / "ultrank_tags.csv", newline="", encoding="utf-8") as f:
    ALT_TAGS = {row[0]: [tag for tag in row[1:] if tag] for row in csv.reader(f)}


def is_latin(tag):
    return all(ord(char) < 0x250 for char in tag)


# the name to show on the graphic: the UltRank tag if it's Latin, otherwise a romanised version
def display_tag(tag):
    if is_latin(tag):
        return tag
    for alt in ALT_TAGS.get(tag, []):
        if is_latin(alt):
            return alt
    # tags like "たいけい/Taikei" carry their own romanisation
    for part in reversed(tag.split("/")):
        if is_latin(part.strip()):
            return part.strip()
    return tag


# tier one start.gg event slug and return plain data for merged_and_tiered.json
def tier_event(event_slug, is_invitational=False):
    result = ultrank_tiering.Tournament(event_slug, is_invitational).calculate_tier()
    counts = result.should_count()
    return {
        "score": result.score,
        "tier": score_to_tier(result.score, counts),
        "counts": counts,
        "multiplier": result.region.multiplier,
        "players": [
            {
                "startgg_id": value.id_,
                "tag": display_tag(value.tag),
                "ultrank_tag": value.tag,
                "entrant_tag": value.alt_tag,
                "points": value.points,
                "category": value.player_value.category,
                "note": value.player_value.note,
            }
            for value in result.values
        ],
    }
