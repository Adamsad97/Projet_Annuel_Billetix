import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { RmqPoisonMessageFilter } from './rmq-poison-message.filter';

describe('RmqPoisonMessageFilter', () => {
  const filter = new RmqPoisonMessageFilter();

  it('acquitte un message invalide pour qu’il ne bloque pas la file', () => {
    const ack = jest.fn();
    const message = { content: 'x' };
    const host = {
      getType: () => 'rpc',
      switchToRpc: () => ({
        getContext: () => ({ getPattern: () => 'notification.welcome', getChannelRef: () => ({ ack }), getMessage: () => message }),
      }),
    } as unknown as ArgumentsHost;

    filter.catch(new BadRequestException(['email must be an email']), host);
    expect(ack).toHaveBeenCalledWith(message);
  });

  it('répond en JSON au serveur HTTP de santé au lieu de laisser la requête suspendue', () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = { getType: () => 'http', switchToHttp: () => ({ getResponse: () => ({ status }) }) } as unknown as ArgumentsHost;

    filter.catch(new NotFoundException('Route inconnue'), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ statusCode: 404, message: 'Route inconnue' });
  });

  it('ne divulgue pas le détail d’une erreur interne en HTTP', () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = { getType: () => 'http', switchToHttp: () => ({ getResponse: () => ({ status }) }) } as unknown as ArgumentsHost;

    filter.catch(new TypeError('secret interne'), host);
    expect(json).toHaveBeenCalledWith({ statusCode: 500, message: 'Erreur interne du service.' });
  });
});
