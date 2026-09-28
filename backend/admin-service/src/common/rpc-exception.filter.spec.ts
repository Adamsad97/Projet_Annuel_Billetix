import { ArgumentsHost, NotFoundException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { AllRpcExceptionsFilter } from './rpc-exception.filter';

const rpcHost = { getType: () => 'rpc' } as unknown as ArgumentsHost;
const filter = new AllRpcExceptionsFilter();

function relayed(exception: unknown) {
  return firstValueFrom(filter.catch(exception, rpcHost) as Observable<never>).catch((error) => error);
}

describe('AllRpcExceptionsFilter', () => {
  it("relaie l'erreur d'un service appelé avec son statut (et non un 500)", async () => {
    await expect(relayed({ statusCode: 404, message: 'Commande introuvable' })).resolves.toEqual({
      statusCode: 404,
      message: 'Commande introuvable',
    });
  });

  it('transmet une RpcException telle quelle', async () => {
    await expect(relayed(new RpcException({ statusCode: 403, message: 'Non autorisé' }))).resolves.toEqual({
      statusCode: 403,
      message: 'Non autorisé',
    });
  });

  it('convertit une HttpException levée par erreur dans un service', async () => {
    await expect(relayed(new NotFoundException('Introuvable'))).resolves.toEqual({ statusCode: 404, message: 'Introuvable' });
  });

  it('masque le détail technique d’une erreur inattendue', async () => {
    const error = await relayed(new TypeError("Cannot read properties of undefined (reading 'x')"));
    expect(error).toEqual({ statusCode: 500, message: 'Erreur interne du service.' });
  });

  it('répond en JSON sur le serveur HTTP de santé', () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const httpHost = { getType: () => 'http', switchToHttp: () => ({ getResponse: () => ({ status }) }) } as unknown as ArgumentsHost;
    filter.catch(new NotFoundException('Route inconnue'), httpHost);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ statusCode: 404, message: 'Route inconnue' });
  });
});
