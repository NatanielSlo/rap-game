import librosa
import numpy as np
import json

print("Ładowanie audio...")
y, sr = librosa.load('beat.mp3', sr=None)

onset_env = librosa.onset.onset_strength(y=y, sr=sr)

# Szukaj beatu blisko 100 BPM (tightness=200 mocno trzyma przy start_bpm)
print("Analiza beatów (~100 BPM)...")
tempo, beat_frames = librosa.beat.beat_track(
    onset_envelope=onset_env,
    sr=sr,
    start_bpm=100,
    tightness=200,
)

bpm       = float(tempo) if np.ndim(tempo) == 0 else float(tempo[0])
beat_times = librosa.frames_to_time(beat_frames, sr=sr)

print(f"Znalezione BPM: {bpm:.2f}")

# Znajdź pierwszy moment gdzie beat jest regularny (main groove, nie intro)
beat_dur = 60.0 / bpm
first_beat = float(beat_times[0]) if len(beat_times) > 0 else 0.0

if len(beat_times) > 6:
    intervals = np.diff(beat_times)
    # Szukaj pierwszego miejsca gdzie 4 kolejne beaty mają spójny interwał (±12%)
    for i in range(len(intervals) - 3):
        window = intervals[i:i+4]
        if np.all(np.abs(window - beat_dur) / beat_dur < 0.12):
            first_beat = float(beat_times[i])
            print(f"Groove zaczyna się od beatu #{i} ({first_beat:.3f}s)")
            break

result = {'bpm': round(bpm, 3), 'first_beat': round(first_beat, 4)}

with open('beat_info.json', 'w') as f:
    json.dump(result, f, indent=2)

print(f"BPM:           {bpm:.2f}")
print(f"Pierwszy beat: {first_beat:.4f}s")
print("Zapisano beat_info.json")
