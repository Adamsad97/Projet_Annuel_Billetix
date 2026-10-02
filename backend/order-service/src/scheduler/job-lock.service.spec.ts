import { RedisService } from '../redis/redis.service';
import { JobLock } from './job-lock.service';

describe('JobLock — une seule exécution par créneau dans le cluster', () => {
  let redis: { setnx: jest.Mock };
  let lock: JobLock;
  let taken: Set<string>;

  beforeEach(() => {
    taken = new Set();
    // SET NX simulé : seul le premier exemplaire à poser la clé l'obtient.
    redis = {
      setnx: jest.fn(async (key: string) => {
        if (taken.has(key)) return false;
        taken.add(key);
        return true;
      }),
    };
    lock = new JobLock(redis as unknown as RedisService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('exécute la tâche et garde le verrou deux créneaux, sans le libérer', async () => {
    const job = jest.fn().mockResolvedValue(undefined);
    await expect(lock.runOncePerPeriod('rappels', 3600, job)).resolves.toBe(true);
    expect(job).toHaveBeenCalledTimes(1);
    expect(redis.setnx).toHaveBeenCalledWith(expect.stringMatching(/^job-lock:order-service:rappels:\d+$/), expect.any(String), 7200);
  });

  it('un second exemplaire au même créneau ne rejoue pas la tâche', async () => {
    const job = jest.fn().mockResolvedValue(undefined);
    await lock.runOncePerPeriod('rappels', 3600, job);
    await expect(lock.runOncePerPeriod('rappels', 3600, job)).resolves.toBe(false);
    expect(job).toHaveBeenCalledTimes(1);
  });

  it("horloges décalées de part et d'autre de l'heure de déclenchement : même créneau, une seule exécution", async () => {
    const nineAm = Date.UTC(2026, 9, 2, 9, 0, 0);
    const job = jest.fn().mockResolvedValue(undefined);
    const now = jest.spyOn(Date, 'now');

    now.mockReturnValue(nineAm - 2000);
    await lock.runOncePerPeriod('rappels', 24 * 3600, job);
    now.mockReturnValue(nineAm + 3000);
    await lock.runOncePerPeriod('rappels', 24 * 3600, job);

    expect(job).toHaveBeenCalledTimes(1);
  });

  it('le créneau suivant est de nouveau exécuté', async () => {
    const job = jest.fn().mockResolvedValue(undefined);
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(Date.UTC(2026, 9, 2, 9, 0, 0));
    await lock.runOncePerPeriod('rappels', 24 * 3600, job);
    now.mockReturnValue(Date.UTC(2026, 9, 3, 9, 0, 0));
    await lock.runOncePerPeriod('rappels', 24 * 3600, job);
    expect(job).toHaveBeenCalledTimes(2);
  });

  it('Redis indisponible : tâche sautée plutôt que risquer un doublon', async () => {
    redis.setnx.mockRejectedValue(new Error('ECONNREFUSED'));
    const job = jest.fn();
    await expect(lock.runOncePerPeriod('reversements', 3600, job)).resolves.toBe(false);
    expect(job).not.toHaveBeenCalled();
  });
});
