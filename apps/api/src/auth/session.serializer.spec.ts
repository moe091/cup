// apps/api/src/auth/session.serializer.spec.ts
import { SessionSerializer } from './session.serializer';
import { PrismaService } from 'src/prisma/prisma.service';

describe('SessionSerializer', () => {
  let serializer: SessionSerializer;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    serializer = new SessionSerializer(prismaMock);
  });

  describe('serializeUser', () => {
    it('serializes to user id', () => {
      const done = jest.fn();

      serializer.serializeUser({ id: 'user-id-123', username: 'alice', email: 'a@b.com', displayName: 'Alice' }, done);

      expect(done).toHaveBeenCalledWith(null, 'user-id-123');
    });
  });

  describe('deserializeUser', () => {
    it('deserializes id into SessionUser when found', async () => {
      prismaMock.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-id-123',
        username: 'alice',
        email: 'a@b.com',
        displayName: 'Alice',
      });

      const done = jest.fn();

      await serializer.deserializeUser('user-id-123', done);

      expect(done).toHaveBeenCalledWith(null, {
        id: 'user-id-123',
        username: 'alice',
        email: 'a@b.com',
        displayName: 'Alice',
      });
    });

    it('calls done(null, null) when user not found', async () => {
      prismaMock.user.findUnique = jest.fn().mockResolvedValue(null);

      const done = jest.fn();

      await serializer.deserializeUser('missing-id', done);

      expect(done).toHaveBeenCalledWith(null, null);
    });

    it('passes errors to done(err, null) when prisma throws', async () => {
      prismaMock.user.findUnique = jest.fn().mockRejectedValue(new Error('db failed'));

      const done = jest.fn();

      await serializer.deserializeUser('user-id-123', done);

      expect(done).toHaveBeenCalledWith(expect.any(Error), null);
    });
  });
});
