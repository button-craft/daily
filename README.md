# BUTTON Daily

The pool in `data/messages.json` (44,585 messages) was pre-filtered from the full export:
- 20–180 characters long (long enough to have some voice, short enough to fit a bubble)
- At least 12 alphabetic characters (filters out emoji-only/junk messages)
- No links
- Does **not** contain the sender's own name or common nickname (so the message can't
  give away its own answer) — mentioning *other* people's names is fine and left in