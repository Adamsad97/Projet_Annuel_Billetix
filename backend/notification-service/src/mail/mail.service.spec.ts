import { Test } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;
  let mailer: { sendMail: jest.Mock };

  const opts = { to: 'jean@example.com', subject: 'Sujet', template: 'welcome', context: {} };

  beforeEach(async () => {
    mailer = { sendMail: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [MailService, { provide: MailerService, useValue: mailer }],
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
});
