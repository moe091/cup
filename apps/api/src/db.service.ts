import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DbService {
    private readonly pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    async getHelloMessage(): Promise<string | null> {
        const res = await this.pool.query<{ hello: string }>(
            'SELECT hello FROM message ORDER BY id DESC LIMIT 1',
        );
        return res.rows[0]?.hello ?? null;
    }
}
