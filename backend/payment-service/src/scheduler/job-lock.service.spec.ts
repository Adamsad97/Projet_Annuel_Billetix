import type Redis from 'ioredis';
import { JobLock } from './job-lock.service';

describe('JobLock — une seule exécution par créneau dans le cluster', () => {
  let redis: { set: jest.Mock };
  let lock: JobLock;
  let taken: Set<string>;

  beforeEach(() => {
    taken = new Set();
    // SET NX simulé : seul le premier exemplaire à poser la clé l'obtient.
    redis = {
      set: jest.fn(async (key: string) => {
        if (taken.has(key)) return null;
        taken.add(key);
        return 'OK';
      }),
    };
    lock = new JobLock(redis as unknown as Redis);
  });

  afterEach(() => jest.restoreAllMocks());

  it('exécute la tâche et garde le verrou deux créneaux, sans le libérer', async () => {
    const job = jest.fn().mockResolvedValue(undefined);
    await expect(lock.runOncePerPeriod('purge', 3600, job)).resolves.toBe(true);
    expect(job).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^job-lock:payment-service:purge:\d+$/),
      expect.any(String),
      'EX',
      7200,
      'NX',
    );
  });

  it('un second exemplaire au même créneau ne rejoue pas la tâche', async () => {
    const job = jest.fn().mockResolvedValue(undefined);
    await lock.runOncePerPeriod('purge', 3600, job);
    await expect(lock.runOncePerPeriod('purge', 3600, job)).resolves.toBe(false);
    expect(job).toHaveBeenCalledTimes(1);
  });

  it("horloges décalées de part et d'autre de l'heure de déclenchement : même créneau, une seule exécution", async () => {
    const tenAm = Date.UTC(2026, 9, 2, 10, 0, 0);
    const job = jest.fn().mockResolvedValue(undefined);
    const now = jest.spyOn(Date, 'now');

    now.mockReturnValue(tenAm - 2000);
    await lock.runOncePerPeriod('purge', 24 * 3600, job);
    now.mockReturnValue(tenAm + 3000);
    await lock.runOncePerPeriod('purge', 24 * 3600, job);

    expect(job).toHaveBeenCalledTimes(1);
  });

  it('le créneau suivant est de nouveau exécuté', async () => {
    const job = jest.fn().mockResolvedValue(undefined);
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(Date.UTC(2026, 9, 2, 10, 0, 0));
    await lock.runOncePerPeriod('purge', 3600, job);
    now.mockReturnValue(Date.UTC(2026, 9, 2, 11, 0, 0));
    await lock.runOncePerPeriod('purge', 3600, job);
    expect(job).toHaveBeenCalledTimes(2);
  });

  it('Redis indisponible : tâche sautée plutôt que risquer un doublon', async () => {
    redis.set.mockRejectedValue(new Error('ECONNREFUSED'));
    const job = jest.fn();
    await expect(lock.runOncePerPeriod('purge', 3600, job)).resolves.toBe(false);
    expect(job).not.toHaveBeenCalled();
  });
});
