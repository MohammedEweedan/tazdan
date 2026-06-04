# Hero screen recordings

Drop your phone **screen recordings** here and the landing-page hero plays them
inside the iPhone mock automatically. Until a file exists, the hero gracefully
falls back to the existing screenshots — so the page never breaks.

Expected files (MP4, portrait, muted; they're played `autoplay loop muted playsInline`):

| File            | Shown when…                                  |
|-----------------|----------------------------------------------|
| `lock.mp4`      | the first **locked phone** screen            |
| `dashboard.mp4` | base layer / wallet dashboard                |
| `chat.mp4`      | payment messages chapter                     |
| `buy.mp4`       | buy-flow chapter                             |
| `markets.mp4`   | market-detail chapter                        |
| `pay.mp4`       | pay-with-balance chapter                     |
| `cards.mp4`     | cards chapter                                |

Tips
- Record in portrait at the phone's aspect ratio (~9:19.5). Content is
  `object-fit: cover`, so anything slightly off-ratio is center-cropped.
- Keep them short and loopable (5–12s). Muted is required for autoplay.
- H.264 MP4 is the safest for cross-browser autoplay. Keep each file lean
  (ideally < 4–5 MB) so the hero stays fast.
- `lock.mp4` is optional — without it the hero shows a clean rendered lock
  screen (clock + lock + swipe-up cue).
