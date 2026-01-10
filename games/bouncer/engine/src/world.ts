import { TickSnapshot, toPixels, toWorld } from '@cup/bouncer-shared';
import type { Ball, Point } from './types.js';
import planck from 'planck';
import type { Body } from 'planck';
import { LevelDefinition } from '../../shared/dist/level.js';

export class World {
    private timestep = 1 / 30;
    private balls: Map<string, Body> = new Map<string, Body>();
    private spawnPoints: Point[] = [{x: 400, y: 100}, {x: 560, y: 400}];
    private physics: planck.World = new planck.World({x: 0, y: 10});

    launchBall(ballId: string, dx: number, dy: number) {
        const body = this.balls.get(ballId);

        if (!body) {
            console.error("[Engine.World.launchBall] Tried launching ball with an ID that doesn't exist: ", ballId, dx, dy);
            return;
        }

        const impulse = new planck.Vec2(toWorld(dx) / 2, toWorld(dy) / 2);

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
                linearDamping: 0.2,
                angularDamping: 0.2,
            });
            body.setUserData("Ball-" + playerId);
            const shape = new planck.Circle(0.2);

            body.createFixture({
                shape,
                density: 1.0,
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
            //TODO:: Add rotation to tickSnapshot

            return {
                id,
                x: toPixels(pos.x),
                y: toPixels(pos.y),
                xVel: toPixels(vel.x),
                yVel: toPixels(vel.y),
            }
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
        level.objects.forEach(go => {
            const body = this.physics.createBody({
                type: 'static',
                position: new planck.Vec2(toWorld(go.x), toWorld(go.y)),
            });
            body.setUserData(go.name);
            const box = new planck.Box(toWorld(go.width / 2), toWorld(go.height / 2));

            body.createFixture(box, {friction: 0.8, restitution: 0.5});
        });
    }

    dumpBodies() {
        let body = this.physics.getBodyList();

        while (body) {
            const p = body.getPosition();
            const userData =
            typeof body.getUserData === 'function' ? body.getUserData() : undefined;

            console.log('Body', {
                type: body.getType?.(),
                x: p.x,
                y: p.y,
                userData,
            });

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


}