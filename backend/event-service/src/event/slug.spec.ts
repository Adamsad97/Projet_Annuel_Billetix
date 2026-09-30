import { firstFreeSlug, slugify, SLUG_MAX_LENGTH } from './slug';

describe('slugify', () => {
  it('produit une adresse lisible depuis le titre', () => {
    expect(slugify('Afro Vibes Festival 2026 !')).toBe('afro-vibes-festival-2026');
    expect(slugify('Nuit Électronique — La Défense Arena')).toBe('nuit-electronique-la-defense-arena');
    expect(slugify("L'Œuvre d'été")).toBe('l-oeuvre-d-ete');
  });

  it('ne renvoie jamais une adresse vide', () => {
    expect(slugify('!!! ???')).toBe('evenement');
  });

  it('reste sous la longueur maximale, sans tiret final', () => {
    const slug = slugify('mot '.repeat(60));
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH - 10);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('firstFreeSlug', () => {
  it('garde la base si elle est libre', () => {
    expect(firstFreeSlug('concert', ['concert-live'])).toBe('concert');
  });

  it('ajoute le premier suffixe libre', () => {
    expect(firstFreeSlug('concert', ['concert'])).toBe('concert-2');
    expect(firstFreeSlug('concert', ['concert', 'concert-2', 'concert-4'])).toBe('concert-3');
  });
});
