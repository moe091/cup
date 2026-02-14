# TODO
living todo list(and other notes) to help organize my brain

### Bouncer
**Ideas**: instead of a simple 'race to the finish line' level, create levels that don't really have a finish line and instead are just a big arena full of collectibles(like stars in Sonic) that give points. The match can either be a timed thing where it's whoever has the most points at the end, or a point target where it's first to 100 points or something similar(I'm thinking the latter sounds more fun and exciting to play against other ppl). Can have different star types/colors that are worth different point values, with higher value stars being in hard to reach places. Can also have a 'Golden Snitch' that is super tiny and fast but ends the game immediately if someone catches it

**TODO**:
- Client-side prediction:
    - add engine to client side
    - keep a circular buffer of state updates from server on client side, keep client 1-2 ticks behind
    - interpolate positions between current state and next state instead of snapping