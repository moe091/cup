# TODOS

### Quick and small improvements:
- Make username not case sensitive on login
- make topbar bg black, add a subtle warm glow coming out the bottom, as if it's soft overhead light for the page
- Image/video/link embedding: at first, just for embedding external links(e.g. YT or an image link). Uploading comes later
- Add a theme picker and make 'custom-dark' the default theme
- Don't re-render displayName/message time/PFP for messages sent by same user in quick succession.


### Main line features to work on next:
- Profile customization, especially profile pics and name color to make chat look less bland


### Design changes and new features:
- Channel sidebar in chat:
    - Make it collapsible
    - Each channel gets an icon/emoji that shows next to it's name. In collapsed mode, only emoji shows
    - Highlight channels based on status: dark red when notification, slightly illuminated when new messages, normal when nothing new



### OPTIMIZATIONS
- Use caching for some db requests, e.g. the user->emoji access check. 
    - can simply cache in-memory, but should probably wait until next step(implementing redis) and using that
- Redis to cache a lot of repeated DB requests, such as emoji checks, probably chat history, and likely channel auth checks
- Possibly remove some db reads/writes around messaging, e.g. validations that won't cause any real problems if they are violated(reply channel validation for example)