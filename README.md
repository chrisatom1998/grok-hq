# Grok HQ

A live status dashboard for my Grok Bots. One self-contained `index.html` (no build step, no external scripts).

Open it with your private ntfy topic in the URL hash:

    https://chrisatom1998.github.io/grok-hq/#your-topic

The topic is never stored in this repo. Bots post JSON status, roster and usage messages to the topic on ntfy.sh; the page reads recent history and stays live over SSE. Switch between Cards and a 3D view in the header.
