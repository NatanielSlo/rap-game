import json

with open("rhyming_pairs.json", encoding="utf-8") as f:
    pairs = json.load(f)

filtered = []
seen = set()

for pair in pairs:
    w1, w2 = pair[0].lower(), pair[1].lower()
    if len(w1) < 2 or len(w2) < 2:
        continue
    if w1 == w2:
        continue
    if w1[-2:] != w2[-2:]:
        continue
    key = frozenset([w1, w2])
    if key in seen:
        continue
    seen.add(key)
    filtered.append(pair)

with open("rhyming_pairs.json", "w", encoding="utf-8") as f:
    json.dump(filtered, f, ensure_ascii=False, indent=2)

print(f"Przed: {len(pairs)}, po: {len(filtered)}, usunięto: {len(pairs) - len(filtered)}")
