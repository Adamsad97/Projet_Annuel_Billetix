import { Test } from '@nestjs/testing';
import { of } from 'rxjs';
import { MailerService } from '@nestjs-modules/mailer';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;
  let mailer: { sendMail: jest.Mock };
  let adminClient: { send: jest.Mock };
  let platformConfig: { get: jest.Mock };

  const opts = { to: 'jean@example.com', subject: 'Sujet', template: 'welcome', context: {} };

  beforeEach(async () => {
    mailer = { sendMail: jest.fn() };
    adminClient = { send: jest.fn().mockReturnValue(of({})) };
    platformConfig = {
      get: jest.fn().mockResolvedValue({
        email_max_retry_attempts: 3,
        email_retry_delay_minutes: 10,
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MailerService, useValue: mailer },
        { provide: 'ADMIN_SERVICE', useValue: adminClient },
        { provide: PlatformConfigCache, useValue: platformConfig },
      ],
    }).compile();

    service = module.get(MailService);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("envoie l'email du premier coup sans retry en cas de succès", async () => {
    mailer.sendMail.mockResolvedValue(undefined);

    await service.send(opts);

    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
  });

  it('retente jusqu\'à réussir (2e tentative)', async () => {
    mailer.sendMail.mockRejectedValueOnce(new Error('SMTP down')).mockResolvedValueOnce(undefined);

    const promise = service.send(opts);
    await jest.runAllTimersAsync();
    await promise;

    expect(mailer.sendMail).toHaveBeenCalledTimes(2);
  });

  it('abandonne après 3 tentatives infructueuses sans lever d\'exception', async () => {
    mailer.sendMail.mockRejectedValue(new Error('SMTP down'));

    const promise = service.send(opts);
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBeUndefined();

    expect(mailer.sendMail).toHaveBeenCalledTimes(3);
  });

  it('espace les tentatives selon le délai configuré par l\'admin (jamais une valeur figée dans le code)', async () => {
    platformConfig.get.mockResolvedValue({
      email_max_retry_attempts: 3,
      email_retry_delay_minutes: 7, // valeur volontairement différente du défaut (10)
    });
    mailer.sendMail.mockRejectedValueOnce(new Error('SMTP down')).mockResolvedValueOnce(undefined);
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    const promise = service.send(opts);
    await jest.runAllTimersAsync();
    await promise;

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 7 * 60 * 1000);
  });

  it('respecte le nombre de tentatives configuré par l\'admin (jamais figé dans le code)', async () => {
    platformConfig.get.mockResolvedValue({
      email_max_retry_attempts: 5, // valeur volontairement différente du défaut (3)
      email_retry_delay_minutes: 10,
    });
    mailer.sendMail.mockRejectedValue(new Error('SMTP down'));

    const promise = service.send(opts);
    await jest.runAllTimersAsync();
    await promise;

    expect(mailer.sendMail).toHaveBeenCalledTimes(5);
  });

  it('déclenche une alerte admin réelle (journal d\'audit) après échec définitif', async () => {
    mailer.sendMail.mockRejectedValue(new Error('SMTP down'));

    const promise = service.send(opts);
    await jest.runAllTimersAsync();
    await promise;

    expect(adminClient.send).toHaveBeenCalledWith(
      'admin.log_action',
      expect.objectContaining({
        entity_type: 'USER',
        metadata: { template: 'welcome', to: 'jean@example.com' },
      }),
    );
  });

  it("n'envoie aucune alerte admin en cas de succès", async () => {
    mailer.sendMail.mockResolvedValue(undefined);

    await service.send(opts);

    expect(adminClient.send).not.toHaveBeenCalled();
  });
});
