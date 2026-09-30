import { ibanError, isValidIban, normalizeIban } from './iban';

describe('contrôle des IBAN', () => {
  it('accepte des IBAN valides de plusieurs pays', () => {
    for (const iban of ['FR76 3000 6000 0112 3456 7890 189', 'BE71 0961 2345 6769', 'DE89 3704 0044 0532 0130 00', 'NO93 8601 1117 947']) {
      expect(isValidIban(normalizeIban(iban))).toBe(true);
    }
  });

  it('refuse un IBAN français qui ne fait pas 27 caractères, avec un message précis', () => {
    expect(ibanError(normalizeIban('FR76 5778 7757 6849 4970 6857 4779 7974 75'))).toBe(
      'IBAN invalide : un IBAN FR comporte 27 caractères (34 saisis).',
    );
  });

  it('refuse une clé de contrôle fausse à la bonne longueur', () => {
    expect(ibanError('FR7630006000011234567890188')).toBe('IBAN invalide : vérifiez les caractères saisis.');
  });

  it('refuse un début qui ne suit pas le format pays + clé', () => {
    expect(ibanError('7630006000011234567890189')).toMatch(/2 lettres/);
  });
});
