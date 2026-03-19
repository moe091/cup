# TODOS

#### Quick and small improvements:
- make topbar bg black, add a subtle warm glow coming out the bottom, as if it's soft overhead light for the page
- Profile customization, especially profile pics and name color to make chat look less bland
- Image/video/link embedding: at first, just for embedding external links(e.g. YT or an image link). Uploading comes later


### OPTIMIZATIONS!
- Use caching for some db requests, e.g. the user->emoji access check. 
    - can simply cache in-memory, but should probably wait until next step(implementing redis) and using that
- Redis to cache a lot of repeated DB requests, such as emoji checks, probably chat history, and likely channel auth checks