Netcode Implementation Details:

┌─────────────────────────────────────────────────────────┐
  │                     GameplayScene                        │
  │   - Renders what PredictionManager tells it              │
  │   - Sends inputs to PredictionManager                    │
  └─────────────────────────────────────────────────────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
  ┌──────────────────────┐        ┌──────────────────────────┐
  │   InputBuffer        │        │   SnapshotBuffer         │
  │                      │        │                          │
  │ - record(tick,input) │        │ - add(snapshot)          │
  │ - getSince(tick)     │        │ - getInterpolated(time)  │
  │ - prune(tick)        │        │ - getLatest()            │
  └──────────────────────┘        └──────────────────────────┘
            │                                 │
            └────────────────┬────────────────┘
                             ▼
  ┌─────────────────────────────────────────────────────────┐
  │                  PredictionManager                       │
  │   (netcode brain - operates on Engine)                   │
  │                                                          │
  │   - applyInput(input)      → record + send + predict     │
  │   - receiveSnapshot(snap)  → buffer + reconcile          │
  │   - update()               → returns render states       │
  │                                                          │
  │   Owns: localEngine, inputBuffer, snapshotBuffer         │
  └─────────────────────────────────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────┐
  │                       Engine                             │
  │   (pure game logic - NO network awareness)               │
  │                                                          │
  │   - step(inputs)                                         │
  │   - getSnapshot()                                        │
  │   - getPlayerState(id)     ← new                         │
  │   - setPlayerState(id, s)  ← new (for reconciliation)    │
  │   - spawnPlayer(id)                                      │
  │   - loadLevel(level)                                     │
  └─────────────────────────────────────────────────────────┘

  Contact surface between netcode and engine: just 6 methods. Engine remains completely network-agnostic.

  ---
  Implementation Plan

  Phase 1: Engine Additions (Small)

  Add two methods to Engine/World for state manipulation:

  // Get single player's physics state
  getPlayerState(playerId: string): PlayerPhysicsState | null

  // Set single player's physics state (for reconciliation)
  setPlayerState(playerId: string, state: PlayerPhysicsState): void

  type PlayerPhysicsState = {
    x: number;
    y: number;
    angle: number;
    xVel: number;
    yVel: number;
    angularVel: number;
  }

  Phase 2: Shared Types

  Add to shared types:

  // Input now includes tick number
  type TimestampedInput = InputState & {
    tick: number;
  }

  // Snapshot now includes which input tick was last processed per player
  type TickSnapshot = {
    tick: number;
    lastProcessedInputs: Record<string, number>;  // playerId → inputTick
    balls: BallState[];
  }

  Phase 3: Server Changes (Small)

  1. Accept tick on inputs, store it
  2. Track lastProcessedInputTick per player
  3. Include it in snapshots

  The server loop stays essentially the same - it just tracks what it processed.

  Phase 4: Client Netcode Layer (New Files)

  Create in client/src/netcode/:

  InputBuffer.ts
  - Ring buffer of inputs with tick numbers
  - record(tick, input) - store input
  - getInputsSince(tick) - for replay after reconciliation
  - prune(beforeTick) - garbage collect old inputs

  SnapshotBuffer.ts
  - Stores last N server snapshots
  - add(snapshot) - add new one
  - getInterpolated(renderTick) - interpolate between two snapshots for smooth remote player rendering

  PredictionManager.ts
  - The brain of client-side prediction
  - Owns: local Engine instance, InputBuffer, SnapshotBuffer
  - Key methods:
    - applyInput(input) - apply locally, buffer, return for sending
    - receiveSnapshot(snapshot) - buffer, check for reconciliation
    - update() - returns { localPlayer: State, remotePlayers: State[] }

  Phase 5: Client Integration

  Modify GameplayScene:
  - On input: call predictionManager.applyInput(), send to server
  - On snapshot: call predictionManager.receiveSnapshot()
  - On render: call predictionManager.update(), render returned states

  ---
  Reconciliation Logic (The Core Algorithm)

  receiveSnapshot(serverSnapshot) {
    // 1. What tick did server process our last input?
    const serverTick = serverSnapshot.tick;
    const lastInputTick = serverSnapshot.lastProcessedInputs[myId];

    // 2. Get our predicted state at that tick (we stored it)
    const predictedState = this.getPredictedStateAt(lastInputTick);
    const serverState = serverSnapshot.balls.find(b => b.id === myId);

    // 3. Compare
    const error = distance(predictedState, serverState);

    if (error < SNAP_THRESHOLD) {
      // Small error: just nudge toward server
      this.nudgeToward(serverState);
    } else {
      // Large error: full reconciliation
      this.engine.setPlayerState(myId, serverState);

      // Replay all inputs from lastInputTick+1 to now
      const inputs = this.inputBuffer.getInputsSince(lastInputTick + 1);
      for (const input of inputs) {
        this.engine.step([input]);
      }
    }
  }
