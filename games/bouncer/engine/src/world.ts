import { TickSnapshot, toPixels, toWorld } from '@cup/bouncer-shared';
import type { Ball, FinishListener, Point } from './types.js';
import planck from 'planck';
import type { Body } from 'planck';
import type { LevelDefinition } from '@cup/bouncer-shared';
import { createPolygonBody } from './helpers/PhysicsHelpers.js';

let gravity = { x: 0, y: 10 };

type BallState = {
  body: Body;
  groundSensor: Body;
  grounded: boolean;
  groundContacts: number;
  lastGroundedAtMs: number;
  jumpActive: boolean;
  jumpStartedAtMs: number;
  jumpHoldRemainingMs: number;
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
  private moveImpulse = 0.025;
  private jumpImpulse = 1.1;
  private jumpHoldImpulse = 0.5;
  private jumpHoldMs = 750;
  private coyoteMs = 200;
  private finishListener: FinishListener | null = null;
  private finishedPlayers = new Set<string>();

  constructor() {
    this.setupContactListeners();
  }

  setupContactListeners() {
    console.log("[DEBUG] setting up contact listenres");
    this.physics.on('begin-contact', (contact) => {
      console.log("contact happened: ");
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
        console.log("goal happened");
        const ballUser = isBallA ? (aUser as string) : (bUser as string);
        const playerId = ballUser.replace('Ball-', '');
        this.onFinish(playerId);
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

    const body = ballState.body;
    body.setAwake(true);
    body.applyTorque(move * this.moveTorque, true);
    body.applyLinearImpulse(new planck.Vec2(move * this.moveImpulse, 0), body.getWorldCenter(), true);
  }

  applyJump(ballId: string) {
    if (this.finishedPlayers.has(ballId)) return;

    const ballState = this.balls.get(ballId);
    if (!ballState) {
      console.error("[Engine.World.applyJump] Tried jumping with ball that doesn't exist: ", ballId);
      return;
    }

    const now = this.nowMs();
    const groundedOrCoyote = ballState.grounded || now - ballState.lastGroundedAtMs <= this.coyoteMs;
    if (!groundedOrCoyote) {
      console.log(`[Engine.World.applyJump] Not grounded: ${ballId}`);
      return;
    }

    const body = ballState.body;
    body.setAwake(true);
    body.applyLinearImpulse(new planck.Vec2(0, -this.jumpImpulse), body.getWorldCenter(), true);
    ballState.jumpActive = true;
    ballState.jumpStartedAtMs = now;
    ballState.jumpHoldRemainingMs = this.jumpHoldMs;
    console.log(`[Engine.World.applyJump] Jumped: ${ballId} grounded=${ballState.grounded}`);
  }

  applyJumpHold(ballId: string, jumpHeld: boolean) {
    if (this.finishedPlayers.has(ballId)) return;

    const ballState = this.balls.get(ballId);
    if (!ballState) return;

    if (!jumpHeld || !ballState.jumpActive || ballState.jumpHoldRemainingMs <= 0) {
      ballState.jumpActive = false;
      ballState.jumpHoldRemainingMs = 0;
      return;
    }

    const body = ballState.body;
    body.setAwake(true);
    const dtMs = this.timestep * 1000;
    const impulseScale = dtMs / this.jumpHoldMs;
    body.applyLinearImpulse(
      new planck.Vec2(0, -this.jumpHoldImpulse * impulseScale),
      body.getWorldCenter(),
      true,
    );
    ballState.jumpHoldRemainingMs = Math.max(0, ballState.jumpHoldRemainingMs - dtMs);
  }

  spawnPlayer(playerId: string): boolean {
    for (const spawn of this.spawnPoints) {
      const occupied = Array.from(this.balls.values()).some((ballState) => {
        const p = ballState.body.getPosition(); // meters
        const x = toPixels(p.x);
        const y = toPixels(p.y);
        return x === spawn.x && y === spawn.y; // just checking if exact position is used(not collision). Good enough
      });

      if (occupied) continue;

      const spawnPos = new planck.Vec2(toWorld(spawn.x), toWorld(spawn.y));

      const body = this.physics.createBody({
        type: 'dynamic',
        position: spawnPos,
        fixedRotation: false,
        bullet: false,
        linearDamping: 0.3,
        angularDamping: 0.3,
      });
      body.setUserData('Ball-' + playerId);
      const shape = new planck.Circle(this.ballRadius);

      body.createFixture({
        shape,
        density: 0.8,
        friction: 0.4,
        restitution: 0.3,
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
      });
      return true;
    }

    return false; // unable to find an open spawn point.
  }

  getSnapshot(tick: number): TickSnapshot {
    const balls = Array.from(this.balls.entries()).map(([id, ballState]) => {
      const pos = ballState.body.getPosition();
      const vel = ballState.body.getLinearVelocity();
      const angle = ballState.body.getAngle();
      //TODO:: Add rotation to tickSnapshot

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
    this.physics.step(this.timestep);
  }

  setTimestep(val: number) {
    this.timestep = val;
  }

  loadLevel(level: LevelDefinition) {
    this.spawnPoints = [];

    level.objects.forEach((obj) => {
      if (obj.type === 'platform') {
        const body = this.physics.createBody({
          type: 'static',
          position: new planck.Vec2(toWorld(obj.x), toWorld(obj.y)),
        });
        body.setUserData(obj.name);
        const box = new planck.Box(toWorld(obj.width / 2), toWorld(obj.height / 2));

        body.createFixture(box, { friction: 0.8, restitution: 0.5 });
        return;
      }

      if (obj.type === 'polygon') {
        const friction = obj.friction ?? 0.8;
        const restitution = obj.restitution ?? 0.5;

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
    body.groundSensor.setType('static');

    if (this.finishListener) {
      this.finishListener(playerId);
    }
  }

  setFinishListener(listener: FinishListener) {
    this.finishListener = listener;
  }

  dumpBodies() {
    let body = this.physics.getBodyList();

    while (body) {
      const p = body.getPosition();
      const userData = typeof body.getUserData === 'function' ? body.getUserData() : undefined;

      let fixture = body.getFixtureList();
      while (fixture) {
        const shape = fixture.getShape();
        const shapeType = shape.getType();

        // if (shapeType === 'circle') {
        //     console.log('  Fixture', { shape: 'circle', r: shape.getRadius() });
        // } else if (shapeType === 'polygon') {
        //     // Often used for boxes; vertices are in body-local coordinates
        //     const verts = (shape as any).m_vertices ?? (shape as any).getVertices?.();
        //     console.log('  Fixture', { shape: 'polygon', vertsCount: verts?.length, verts });
        // } else {
        //     console.log('  Fixture', { shape: shapeType });
        // }

        fixture = fixture.getNext();
      }

      body = body.getNext();
    }
  }

  resetWorld() {
    this.balls = new Map<string, BallState>();
    this.spawnPoints = [];
    this.physics = new planck.World(gravity);
    this.finishListener = null;

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

  private nowMs() {
    return Date.now();
  }
}
