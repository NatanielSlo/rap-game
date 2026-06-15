import requests
import json

URL = "https://czterycztery.pl/programy/slownik_rymow/backend/api/rhyming_pairs/"

data = requests.get(URL).json()

pairs = sorted(
    data["rhyming_pairs"],
    key=lambda p: len(p["occurrences"]),
    reverse=True
)

output = [[p["first_word"], p["second_word"]] for p in pairs]

with open("rhyming_pairs.json", "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"Zapisano {len(output)} par, top 10:")
for w1, w2 in output[:10]:
    print(f"  {w1} / {w2}")
