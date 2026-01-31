import { TickSnapshot, toPixels, toWorld } from '@cup/bouncer-shared';
import type { Ball, FinishListener, Point } from './types.js';
import planck from 'planck';
import type { Body } from 'planck';
import type { LevelDefinition } from '@cup/bouncer-shared';
import { createPolygonBody } from './helpers/PhysicsHelpers.js';

let gravity = { x: 0, y: 10 };

export class World {
  private timestep = 1 / 30;
  private balls: Map<string, Body> = new Map<string, Body>();
  private spawnPoints: Point[] = [];
  private physics: planck.World = new planck.World(gravity);
  private launchPower = 0.6;
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
    });
  }


  launchBall(ballId: string, dx: number, dy: number) {
    if (this.finishedPlayers.has(ballId)) return;
    
    const body = this.balls.get(ballId);
    if (!body) {
      console.error("[Engine.World.launchBall] Tried launching ball with an ID that doesn't exist: ", ballId, dx, dy);
      return;
    }

    const impulse = new planck.Vec2(toWorld(dx) * this.launchPower, toWorld(dy) * this.launchPower);
    body.setAwake(true);
    body.applyLinearImpulse(impulse, body.getWorldCenter(), true);
    this.dumpBodies();
  }

  spawnPlayer(playerId: string): boolean {
    for (const spawn of this.spawnPoints) {
      const occupied = Array.from(this.balls.values()).some((body) => {
        const p = body.getPosition(); // meters
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
      const shape = new planck.Circle(0.26);

      body.createFixture({
        shape,
        density: 0.8,
        friction: 0.4,
        restitution: 0.3,
      });

      this.balls.set(playerId, body);
      return true;
    }

    return false; // unable to find an open spawn point.
  }

  getSnapshot(tick: number): TickSnapshot {
    const balls = Array.from(this.balls.entries()).map(([id, body]) => {
      const pos = body.getPosition();
      const vel = body.getLinearVelocity();
      const angle = body.getAngle();
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
    
    body.setLinearVelocity(planck.Vec2(0, 0));
    body.setAngularVelocity(0);
    body.setAwake(false);
    
    body.setType('static');
    let fixture = body.getFixtureList();
    while (fixture) {
      const next = fixture.getNext();
      body.destroyFixture(fixture);
      fixture = next;
    }

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
    this.balls = new Map<string, Body>();
    this.spawnPoints = [];
    this.physics = new planck.World(gravity);
    this.finishListener = null;

    this.setupContactListeners();

  }
}
