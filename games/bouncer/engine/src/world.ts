import { TickSnapshot, toPixels, toWorld, resolveHazardBody } from '@cup/bouncer-shared';
import type {
  Ball,
  CheckpointListener,
  DashEventListener,
  FinishListener,
  HazardListener,
  PickupCollectedListener,
  PlayerEventListener,
  Point,
} from './types.js';
import planck from 'planck';
import type { Body } from 'planck';
import type { LevelDefinition, HazardCatalog } from '@cup/bouncer-shared';
import { createPolygonBody } from './helpers/PhysicsHelpers.js';
import { DEFAULT_PHYSICS_CONFIG, type BouncerPhysicsConfig } from './config.js';

let gravity = { x: 0, y: 10 };

const DASH_GRAVITY_DISABLE_MS = 500;

// Sensor radius for pickup collection zones (pixels → world units).
const PICKUP_SENSOR_RADIUS_PX = 36;

type BallState = {
  body: Body;
  groundSensor: Body;
  grounded: boolean;
  groundContacts: number;
  lastGroundedAtMs: number;
  jumpActive: boolean;
  jumpStartedAtMs: number;
  jumpHoldRemainingMs: number;
  canDash: boolean;
  canDoubleJump: boolean;
  dashGravityUntilMs: number;
  // Pickup effects
  frozenUntilMs: number;          // 0 = not frozen; body is set to 'static' while > 0
  accelMultiplier: number;        // 1 = normal; applied to move impulse + torque
  accelMultiplierUntilMs: number; // 0 = no active boost
};

type PickupBodyEntry = {
  x: number;
  y: number;
  key: string;
  body: Body | null; // null = collected this round, will be restored on reset
};

export class World {
  private timestep = 1 / 30;
  private balls: Map<string, BallState> = new Map<string, BallState>();
  private spawnPoints: Point[] = [];
  private physics: planck.World = new planck.World(gravity);
  private ballRadius = 0.26;
  private groundSensorRadius = 0.08;
  private groundSensorOffset = this.ballRadius + 0.04;
  private moveTorque = 0.6;
  private maxHorizontalSpeed = 10;
  private moveImpulse = DEFAULT_PHYSICS_CONFIG.moveAcceleration;
  private jumpImpulse = DEFAULT_PHYSICS_CONFIG.jumpPower;
  private doubleJumpForce = DEFAULT_PHYSICS_CONFIG.doubleJumpForce;
  private dashXForce = DEFAULT_PHYSICS_CONFIG.dashXForce;
  private jumpHoldImpulse = 0.5;
  private jumpHoldMs = 750;
  private coyoteMs = 200;
  private finishListener: FinishListener | null = null;
  private checkpointListener: CheckpointListener | null = null;
  private hazardListener: HazardListener | null = null;
  private doubleJumpListener: PlayerEventListener | null = null;
  private dashListener: DashEventListener | null = null;
  private pickupListener: PickupCollectedListener | null = null;
  private pickupBodies: Map<number, PickupBodyEntry> = new Map();
  private finishedPlayers = new Set<string>();

  constructor(physics?: Partial<BouncerPhysicsConfig>) {
    if (physics) {
      if (Number.isFinite(physics.jumpPower)) this.jumpImpulse = physics.jumpPower as number;
      if (Number.isFinite(physics.moveAcceleration)) this.moveImpulse = physics.moveAcceleration as number;
      if (Number.isFinite(physics.doubleJumpForce)) this.doubleJumpForce = physics.doubleJumpForce as number;
      if (Number.isFinite(physics.dashXForce)) this.dashXForce = physics.dashXForce as number;
    }
    this.setupContactListeners();
  }

  setupContactListeners() {
    console.log('[DEBUG] setting up contact listenres');
    this.physics.on('begin-contact', (contact) => {
      console.log('contact happened: ');
      const fixtureA = contact.getFixtureA();
      const fixtureB = contact.getFixtureB();
      const bodyA = fixtureA.getBody();
      const bodyB = fixtureB.getBody();
      const aUser = bodyA.getUserData();
      const bUser = bodyB.getUserData();
      const groundSensorA = this.getGroundSensorPlayerId(aUser);
      const groundSensorB = this.getGroundSensorPlayerId(bUser);
      const fixtureAIsSensor = fixtureA.isSensor();
      const fixtureBIsSensor = fixtureB.isSensor();

      const isBallA = typeof aUser === 'string' && aUser.startsWith('Ball-');
      const isBallB = typeof bUser === 'string' && bUser.startsWith('Ball-');
      const isGoalA = aUser === 'Goal';
      const isGoalB = bUser === 'Goal';
      if ((isBallA && isGoalB) || (isBallB && isGoalA)) {
        console.log('goal happened');
        const ballUser = isBallA ? (aUser as string) : (bUser as string);
        const playerId = ballUser.replace('Ball-', '');
        this.onFinish(playerId);
      }

      const isCheckpointA = typeof aUser === 'string' && aUser.startsWith('Checkpoint-');
      const isCheckpointB = typeof bUser === 'string' && bUser.startsWith('Checkpoint-');
      if ((isBallA && isCheckpointB) || (isBallB && isCheckpointA)) {
        const ballUser = isBallA ? (aUser as string) : (bUser as string);
        const cpUser = isCheckpointA ? (aUser as string) : (bUser as string);
        const playerId = ballUser.replace('Ball-', '');
        const index = Number.parseInt(cpUser.replace('Checkpoint-', ''), 10);
        if (this.checkpointListener && Number.isFinite(index)) {
          this.checkpointListener(playerId, index);
        }
      }

      const isHazardA = aUser === 'Hazard';
      const isHazardB = bUser === 'Hazard';
      if ((isBallA && isHazardB) || (isBallB && isHazardA)) {
        const ballUser = isBallA ? (aUser as string) : (bUser as string);
        const playerId = ballUser.replace('Ball-', '');
        this.hazardListener?.(playerId);
      }

      const isPickupA = typeof aUser === 'string' && aUser.startsWith('Pickup-');
      const isPickupB = typeof bUser === 'string' && bUser.startsWith('Pickup-');
      if ((isBallA && isPickupB) || (isBallB && isPickupA)) {
        const ballUser = isBallA ? (aUser as string) : (bUser as string);
        const pickupUser = isPickupA ? (aUser as string) : (bUser as string);
        const playerId = ballUser.replace('Ball-', '');
        const instanceId = Number.parseInt(pickupUser.replace('Pickup-', ''), 10);
        if (this.pickupListener && Number.isFinite(instanceId)) {
          this.pickupListener(playerId, instanceId);
        }
      }

      if (groundSensorA && !fixtureBIsSensor && !this.isBallUser(bUser, groundSensorA)) {
        this.addGroundContact(groundSensorA);
      }

      if (groundSensorB && !fixtureAIsSensor && !this.isBallUser(aUser, groundSensorB)) {
        this.addGroundContact(groundSensorB);
      }
    });

    this.physics.on('end-contact', (contact) => {
      const fixtureA = contact.getFixtureA();
      const fixtureB = contact.getFixtureB();
      const bodyA = fixtureA.getBody();
      const bodyB = fixtureB.getBody();
      const aUser = bodyA.getUserData();
      const bUser = bodyB.getUserData();
      const groundSensorA = this.getGroundSensorPlayerId(aUser);
      const groundSensorB = this.getGroundSensorPlayerId(bUser);
      const fixtureAIsSensor = fixtureA.isSensor();
      const fixtureBIsSensor = fixtureB.isSensor();

      if (groundSensorA && !fixtureBIsSensor && !this.isBallUser(bUser, groundSensorA)) {
        this.removeGroundContact(groundSensorA);
      }

      if (groundSensorB && !fixtureAIsSensor && !this.isBallUser(aUser, groundSensorB)) {
        this.removeGroundContact(groundSensorB);
      }
    });
  }

  applyMoveInput(ballId: string, move: -1 | 0 | 1) {
    if (this.finishedPlayers.has(ballId)) return;
    if (move === 0) return;

    const ballState = this.balls.get(ballId);
    if (!ballState) {
      console.error("[Engine.World.applyMoveInput] Tried applying input to ball that doesn't exist: ", ballId, move);
      return;
    }
    if (ballState.frozenUntilMs > 0) return;

    const body = ballState.body;
    const mult = ballState.accelMultiplier;
    const groundMult = ballState.grounded ? 3 : 1;
    const xVel = body.getLinearVelocity().x;
    const pushingSameDir = (move > 0 && xVel > 0) || (move < 0 && xVel < 0);
    // Don't add more speed past the cap — but braking (opposite dir) always applies.
    if (pushingSameDir && Math.abs(xVel) >= this.maxHorizontalSpeed * mult) return;
    const brakeMult = (move > 0 && xVel < 0) || (move < 0 && xVel > 0) ? 2 : 1;
    body.setAwake(true);
    body.applyTorque(move * this.moveTorque * mult, true);
    body.applyLinearImpulse(new planck.Vec2(move * this.moveImpulse * mult * groundMult * brakeMult, 0), body.getWorldCenter(), true);
  }

  /** Returns true iff a jump was actually applied (grounded or within coyote time). */
  applyJump(ballId: string): boolean {
    if (this.finishedPlayers.has(ballId)) return false;

    const ballState = this.balls.get(ballId);
    if (!ballState) {
      console.error("[Engine.World.applyJump] Tried jumping with ball that doesn't exist: ", ballId);
      return false;
    }
    if (ballState.frozenUntilMs > 0) return false;

    const now = this.nowMs();
    const groundedOrCoyote = ballState.grounded || now - ballState.lastGroundedAtMs <= this.coyoteMs;
    if (!groundedOrCoyote) {
      return false;
    }

    const body = ballState.body;
    body.setAwake(true);
    body.applyLinearImpulse(new planck.Vec2(0, -this.jumpImpulse), body.getWorldCenter(), true);
    ballState.jumpActive = true;
    ballState.jumpStartedAtMs = now;
    ballState.jumpHoldRemainingMs = this.jumpHoldMs;
    ballState.lastGroundedAtMs = 0;
    console.log(`[Engine.World.applyJump] Jumped: ${ballId} grounded=${ballState.grounded}`);
    return true;
  }

  applyJumpHold(ballId: string, jumpHeld: boolean) {
    if (this.finishedPlayers.has(ballId)) return;

    const ballState = this.balls.get(ballId);
    if (!ballState) return;
    if (ballState.frozenUntilMs > 0) return;

    if (!jumpHeld || !ballState.jumpActive || ballState.jumpHoldRemainingMs <= 0) {
      ballState.jumpActive = false;
      ballState.jumpHoldRemainingMs = 0;
      return;
    }

    const body = ballState.body;
    body.setAwake(true);
    const dtMs = this.timestep * 1000;
    const impulseScale = dtMs / this.jumpHoldMs;
    body.applyLinearImpulse(new planck.Vec2(0, -this.jumpHoldImpulse * impulseScale), body.getWorldCenter(), true);
    ballState.jumpHoldRemainingMs = Math.max(0, ballState.jumpHoldRemainingMs - dtMs);
  }

  applyDoubleJump(ballId: string) {
    if (this.finishedPlayers.has(ballId)) return;

    const ballState = this.balls.get(ballId);
    if (!ballState) return;
    if (ballState.frozenUntilMs > 0) return;
    if (ballState.grounded) return;
    if (!ballState.canDoubleJump) return;

    const body = ballState.body;
    body.setAwake(true);
    const vel = body.getLinearVelocity();
    if (vel.y > 0) {
      body.setLinearVelocity(new planck.Vec2(vel.x, 0));
    }
    body.applyLinearImpulse(new planck.Vec2(0, -this.doubleJumpForce), body.getWorldCenter(), true);

    ballState.canDoubleJump = false;
    this.doubleJumpListener?.(ballId);
  }

  applyDash(ballId: string, dirX: number) {
    if (this.finishedPlayers.has(ballId)) return;

    const ballState = this.balls.get(ballId);
    if (!ballState) {
      console.error("[Engine.World.applyDash] Tried dashing with ball that doesn't exist: ", ballId);
      return;
    }
    if (ballState.frozenUntilMs > 0) return;
    if (ballState.grounded) return;
    if (!ballState.canDash) return;

    const body = ballState.body;
    body.setAwake(true);
    const vel = body.getLinearVelocity();

    if (dirX === 0) {
      body.setLinearVelocity(new planck.Vec2(0, 0));
    } else {
      body.setLinearVelocity(new planck.Vec2(vel.x, 0));
      body.applyLinearImpulse(new planck.Vec2(dirX * this.dashXForce, 0), body.getWorldCenter(), true);
      body.setGravityScale(0);
      ballState.dashGravityUntilMs = this.nowMs() + DASH_GRAVITY_DISABLE_MS;
      this.dashListener?.(ballId, dirX);
    }

    ballState.canDash = false;
  }

  /** Freezes a player in place for durationMs: zeroes velocity, sets body static. */
  freezePlayer(playerId: string, durationMs: number) {
    const ballState = this.balls.get(playerId);
    if (!ballState || this.finishedPlayers.has(playerId)) return;
    ballState.body.setLinearVelocity(planck.Vec2(0, 0));
    ballState.body.setAngularVelocity(0);
    ballState.body.setType('static');
    ballState.frozenUntilMs = this.nowMs() + durationMs;
  }

  /** Applies an acceleration multiplier to a player for durationMs. */
  setAccelMultiplier(playerId: string, multiplier: number, durationMs: number) {
    const ballState = this.balls.get(playerId);
    if (!ballState || this.finishedPlayers.has(playerId)) return;
    ballState.accelMultiplier = multiplier;
    ballState.accelMultiplierUntilMs = this.nowMs() + durationMs;
  }

  /**
   * Enables or disables a pickup sensor body by instanceId.
   * Disabling destroys the body (collected); enabling recreates it (round reset).
   */
  setPickupActive(instanceId: number, active: boolean) {
    const entry = this.pickupBodies.get(instanceId);
    if (!entry) return;
    if (!active && entry.body) {
      this.physics.destroyBody(entry.body);
      entry.body = null;
    } else if (active && !entry.body) {
      entry.body = this.createPickupSensorBody(instanceId, entry.x, entry.y);
    }
  }

  /** Restores all collected pickup sensors (call at round start). */
  resetPickups() {
    this.pickupBodies.forEach((entry, instanceId) => {
      if (!entry.body) {
        entry.body = this.createPickupSensorBody(instanceId, entry.x, entry.y);
      }
    });
  }

  spawnPlayer(playerId: string): boolean {
    for (const spawn of this.spawnPoints) {
      const occupied = Array.from(this.balls.values()).some((ballState) => {
        const p = ballState.body.getPosition();
        const x = toPixels(p.x);
        const y = toPixels(p.y);
        return x === spawn.x && y === spawn.y;
      });

      if (occupied) continue;

      const spawnPos = new planck.Vec2(toWorld(spawn.x), toWorld(spawn.y));

      const body = this.physics.createBody({
        type: 'dynamic',
        position: spawnPos,
        fixedRotation: false,
        bullet: false,
        linearDamping: 0.18,
        angularDamping: 0.18,
      });
      body.setUserData('Ball-' + playerId);
      const shape = new planck.Circle(this.ballRadius);

      body.createFixture({
        shape,
        density: 0.8,
        friction: 0.3,
        restitution: 0,
      });

      const sensorPos = new planck.Vec2(spawnPos.x, spawnPos.y + this.groundSensorOffset);
      const groundSensor = this.physics.createBody({
        type: 'dynamic',
        position: sensorPos,
        fixedRotation: true,
        gravityScale: 0,
      });
      groundSensor.setUserData('GroundSensor-' + playerId);
      const sensorShape = new planck.Circle(this.groundSensorRadius);
      groundSensor.createFixture({
        shape: sensorShape,
        isSensor: true,
      });

      this.balls.set(playerId, {
        body,
        groundSensor,
        grounded: false,
        groundContacts: 0,
        lastGroundedAtMs: 0,
        jumpActive: false,
        jumpStartedAtMs: 0,
        jumpHoldRemainingMs: 0,
        canDash: true,
        canDoubleJump: true,
        dashGravityUntilMs: 0,
        frozenUntilMs: 0,
        accelMultiplier: 1,
        accelMultiplierUntilMs: 0,
      });
      return true;
    }

    return false;
  }

  setPlayerPosition(playerId: string, xPixels: number, yPixels: number): boolean {
    const ballState = this.balls.get(playerId);
    if (!ballState) {
      return false;
    }

    // Unfreeze if currently frozen so the body can move again.
    if (ballState.frozenUntilMs > 0) {
      ballState.body.setType('dynamic');
      ballState.frozenUntilMs = 0;
    }

    const worldPos = new planck.Vec2(toWorld(xPixels), toWorld(yPixels));
    ballState.body.setTransform(worldPos, ballState.body.getAngle());
    ballState.body.setLinearVelocity(planck.Vec2(0, 0));
    ballState.body.setAngularVelocity(0);

    const sensorPos = new planck.Vec2(worldPos.x, worldPos.y + this.groundSensorOffset);
    ballState.groundSensor.setTransform(sensorPos, 0);
    ballState.groundSensor.setLinearVelocity(planck.Vec2(0, 0));
    ballState.groundSensor.setAngularVelocity(0);

    ballState.grounded = false;
    ballState.groundContacts = 0;
    ballState.lastGroundedAtMs = 0;
    ballState.jumpActive = false;
    ballState.jumpHoldRemainingMs = 0;
    ballState.canDash = true;
    ballState.canDoubleJump = true;
    ballState.dashGravityUntilMs = 0;
    ballState.body.setGravityScale(1);
    ballState.accelMultiplier = 1;
    ballState.accelMultiplierUntilMs = 0;

    return true;
  }

  getSnapshot(tick: number): TickSnapshot {
    const balls = Array.from(this.balls.entries()).map(([id, ballState]) => {
      const pos = ballState.body.getPosition();
      const vel = ballState.body.getLinearVelocity();
      const angle = ballState.body.getAngle();

      return {
        id,
        x: toPixels(pos.x),
        y: toPixels(pos.y),
        angle: angle,
        xVel: toPixels(vel.x),
        yVel: toPixels(vel.y),
      };
    });

    return { tick, balls };
  }

  step() {
    this.updateGroundSensors();
    this.updateDashGravity();
    this.updateFreeze();
    this.updateAccelMultiplier();
    this.physics.step(this.timestep);
  }

  private updateDashGravity() {
    const now = this.nowMs();
    this.balls.forEach((ballState) => {
      if (ballState.dashGravityUntilMs > 0 && now >= ballState.dashGravityUntilMs) {
        ballState.body.setGravityScale(1);
        ballState.dashGravityUntilMs = 0;
      }
    });
  }

  private updateFreeze() {
    const now = this.nowMs();
    this.balls.forEach((ballState) => {
      if (ballState.frozenUntilMs > 0 && now >= ballState.frozenUntilMs) {
        ballState.body.setType('dynamic');
        ballState.frozenUntilMs = 0;
      }
    });
  }

  private updateAccelMultiplier() {
    const now = this.nowMs();
    this.balls.forEach((ballState) => {
      if (ballState.accelMultiplierUntilMs > 0 && now >= ballState.accelMultiplierUntilMs) {
        ballState.accelMultiplier = 1;
        ballState.accelMultiplierUntilMs = 0;
      }
    });
  }

  setTimestep(val: number) {
    this.timestep = val;
  }

  loadLevel(level: LevelDefinition, hazardCatalog?: HazardCatalog) {
    this.spawnPoints = [];
    let checkpointIndex = 0;
    let pickupIndex = 0;

    level.objects.forEach((obj) => {
      if (obj.type === 'hazard') {
        const entry = hazardCatalog?.[obj.hazardKey];
        if (!entry) return;
        const body = resolveHazardBody(entry);
        const cx = obj.x + body.offsetX;
        const cy = obj.y + body.offsetY;
        const hazardBody = this.physics.createBody({
          type: 'static',
          position: new planck.Vec2(toWorld(cx), toWorld(cy)),
        });
        hazardBody.setUserData('Hazard');
        const shape =
          body.shape === 'circle'
            ? new planck.Circle(toWorld(body.radius))
            : new planck.Box(toWorld(body.width / 2), toWorld(body.height / 2));
        hazardBody.createFixture({ shape, isSensor: entry.isSensor ?? true });
        return;
      }

      if (obj.type === 'pickup') {
        const instanceId = pickupIndex++;
        const body = this.createPickupSensorBody(instanceId, obj.x, obj.y);
        this.pickupBodies.set(instanceId, { x: obj.x, y: obj.y, key: obj.pickupKey, body });
        return;
      }

      if (obj.type === 'checkpoint') {
        const body = this.physics.createBody({
          type: 'static',
          position: new planck.Vec2(toWorld(obj.rect.x), toWorld(obj.rect.y)),
        });
        body.setUserData('Checkpoint-' + checkpointIndex);
        body.createFixture({
          shape: new planck.Box(toWorld(obj.rect.width / 2), toWorld(obj.rect.height / 2)),
          isSensor: true,
        });
        checkpointIndex++;
        return;
      }

      if (obj.type === 'platform') {
        const body = this.physics.createBody({
          type: 'static',
          position: new planck.Vec2(toWorld(obj.x), toWorld(obj.y)),
        });
        body.setUserData(obj.name);
        const box = new planck.Box(toWorld(obj.width / 2), toWorld(obj.height / 2));

        body.createFixture(box, { friction: 0.8, restitution: 0 });
        return;
      }

      if (obj.type === 'polygon') {
        const friction = obj.friction ?? 0.8;
        const restitution = 0;

        createPolygonBody(this.physics, obj.vertices, obj.name, friction, restitution);
        return;
      }

      if (obj.type === 'spawnPoint') {
        this.spawnPoints.push({ x: obj.x, y: obj.y });
      }

      if (obj.type === 'goal') {
        const body = this.physics.createBody({
          type: 'static',
          position: new planck.Vec2(toWorld(obj.x), toWorld(obj.y)),
        });
        body.setUserData('Goal');
        const shape = new planck.Circle(toWorld(obj.size));
        body.createFixture({
          shape,
          isSensor: true,
        });
      }
    });
  }

  onFinish(playerId: string) {
    if (this.finishedPlayers.has(playerId)) return;
    this.finishedPlayers.add(playerId);

    const body = this.balls.get(playerId);
    if (!body) return;

    const ballBody = body.body;
    ballBody.setLinearVelocity(planck.Vec2(0, 0));
    ballBody.setAngularVelocity(0);
    ballBody.setAwake(false);

    ballBody.setType('static');
    let fixture = ballBody.getFixtureList();
    while (fixture) {
      const next = fixture.getNext();
      ballBody.destroyFixture(fixture);
      fixture = next;
    }

    body.grounded = false;
    body.groundContacts = 0;
    body.jumpActive = false;
    body.jumpHoldRemainingMs = 0;
    body.frozenUntilMs = 0;
    body.groundSensor.setType('static');

    if (this.finishListener) {
      this.finishListener(playerId);
    }
  }

  setFinishListener(listener: FinishListener) {
    this.finishListener = listener;
  }

  setCheckpointListener(listener: CheckpointListener) {
    this.checkpointListener = listener;
  }

  setHazardListener(listener: HazardListener) {
    this.hazardListener = listener;
  }

  setDoubleJumpListener(listener: PlayerEventListener) {
    this.doubleJumpListener = listener;
  }

  setDashListener(listener: DashEventListener) {
    this.dashListener = listener;
  }

  setPickupListener(listener: PickupCollectedListener) {
    this.pickupListener = listener;
  }

  dumpBodies() {
    let body = this.physics.getBodyList();

    while (body) {
      const p = body.getPosition();
      const userData = typeof body.getUserData === 'function' ? body.getUserData() : undefined;

      let fixture = body.getFixtureList();
      while (fixture) {
        fixture = fixture.getNext();
      }

      body = body.getNext();
    }
  }

  resetWorld() {
    this.balls = new Map<string, BallState>();
    this.spawnPoints = [];
    this.pickupBodies = new Map();
    this.physics = new planck.World(gravity);
    this.finishListener = null;
    this.checkpointListener = null;
    this.hazardListener = null;
    this.doubleJumpListener = null;
    this.dashListener = null;
    this.pickupListener = null;

    this.setupContactListeners();
  }

  private updateGroundSensors() {
    this.balls.forEach((ballState) => {
      const pos = ballState.body.getPosition();
      const sensorPos = new planck.Vec2(pos.x, pos.y + this.groundSensorOffset);
      ballState.groundSensor.setTransform(sensorPos, 0);
      ballState.groundSensor.setAwake(true);
    });
  }

  private getGroundSensorPlayerId(userData: unknown): string | null {
    if (typeof userData !== 'string') return null;
    if (!userData.startsWith('GroundSensor-')) return null;
    return userData.replace('GroundSensor-', '');
  }

  private isBallUser(userData: unknown, playerId: string): boolean {
    return userData === `Ball-${playerId}`;
  }

  private addGroundContact(playerId: string) {
    const ballState = this.balls.get(playerId);
    if (!ballState) return;
    ballState.groundContacts += 1;
    ballState.grounded = ballState.groundContacts > 0;
    if (ballState.grounded) {
      ballState.lastGroundedAtMs = this.nowMs();
      ballState.jumpActive = false;
      ballState.jumpHoldRemainingMs = 0;
      ballState.canDash = true;
      ballState.canDoubleJump = true;
      if (ballState.dashGravityUntilMs > 0) {
        ballState.body.setGravityScale(1);
        ballState.dashGravityUntilMs = 0;
      }
    }
  }

  private removeGroundContact(playerId: string) {
    const ballState = this.balls.get(playerId);
    if (!ballState) return;
    ballState.groundContacts = Math.max(0, ballState.groundContacts - 1);
    ballState.grounded = ballState.groundContacts > 0;
    if (ballState.grounded) {
      ballState.lastGroundedAtMs = this.nowMs();
    }
  }

  private createPickupSensorBody(instanceId: number, x: number, y: number): Body {
    const body = this.physics.createBody({
      type: 'static',
      position: new planck.Vec2(toWorld(x), toWorld(y)),
    });
    body.setUserData(`Pickup-${instanceId}`);
    body.createFixture({
      shape: new planck.Circle(toWorld(PICKUP_SENSOR_RADIUS_PX)),
      isSensor: true,
    });
    return body;
  }

  private nowMs() {
    return Date.now();
  }
}
