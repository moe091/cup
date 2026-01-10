import { TickSnapshot } from '@cup/bouncer-shared';
import type { Ball, Point } from './types.js';

export class World {
    private balls: Map<string, Ball> = new Map<string, Ball>();
    private spawnPoints: Point[] = [{x: 400, y: 100}, {x: 560, y: 400}];


    

    spawnPlayer(playerId: string): boolean {
        for (var i = 0; i < this.spawnPoints.length; i++) {
            let spawn = this.spawnPoints[i];
            let occupied = false;
        
            this.balls.forEach(b => {
                if (b.x === spawn.x && b.y === spawn.y) {  // a ball exists at spawn point already
                    occupied = true;
                    return;
                }
            });

            if (!occupied) {
                this.balls.set(playerId, {id: playerId, x: spawn.x, y: spawn.y, yVel: 2});
                return true; // successfully spawned
            }
        }

        return false; // unable to find an open spawn point.
    }

    getSnapshot(tick: number): TickSnapshot {
        return {
            tick: tick,
            balls: [...this.balls.values()]
        }
    }

    step() {
        this.balls.forEach(ball => {
            ball.x += ball.xVel ?? 0;
            ball.y += ball.yVel ?? 0;
        })
    }


}