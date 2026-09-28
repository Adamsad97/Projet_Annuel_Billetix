import { ValidationError, ValidationPipe } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

/**
 * Validation des messages reçus des autres services. Une donnée invalide
 * renvoie une erreur 400 lisible (en français) à l'appelant, au lieu d'une
 * erreur HTTP que le transport TCP transformerait en « Internal server error ».
 */
const TRANSLATIONS: Record<string, (field: string) => string> = {
  isDefined: (field) => `Le champ « ${field} » est obligatoire.`,
  isNotEmpty: (field) => `Le champ « ${field} » est obligatoire.`,
  isString: (field) => `Le champ « ${field} » doit être un texte.`,
  isBoolean: (field) => `Le champ « ${field} » doit valoir vrai ou faux.`,
  isInt: (field) => `Le champ « ${field} » doit être un nombre entier.`,
  isNumber: (field) => `Le champ « ${field} » doit être un nombre.`,
  min: (field) => `Le champ « ${field} » est trop petit.`,
  max: (field) => `Le champ « ${field} » est trop grand.`,
  minLength: (field) => `Le champ « ${field} » est trop court.`,
  maxLength: (field) => `Le champ « ${field} » est trop long.`,
  isEmail: () => "L'adresse email n'est pas valide.",
  isUuid: (field) => `Le champ « ${field} » doit être un identifiant valide.`,
  isDateString: (field) => `Le champ « ${field} » doit être une date valide.`,
  isEnum: (field) => `La valeur du champ « ${field} » n'est pas autorisée.`,
  isIn: (field) => `La valeur du champ « ${field} » n'est pas autorisée.`,
  isArray: (field) => `Le champ « ${field} » doit être une liste.`,
  isUrl: (field) => `Le champ « ${field} » doit être une adresse web valide.`,
  isLatitude: (field) => `Le champ « ${field} » doit être une latitude valide.`,
  isLongitude: (field) => `Le champ « ${field} » doit être une longitude valide.`,
};

function isEnglishDefault(message: string): boolean {
  return /^[\x20-\x7E]*$/.test(message) && /\b(must|should|property|exist)\b/i.test(message);
}

function flatten(errors: ValidationError[], parent = ''): string[] {
  const messages: string[] = [];
  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property;
    for (const [constraint, message] of Object.entries(error.constraints ?? {})) {
      const translate = TRANSLATIONS[constraint];
      messages.push(isEnglishDefault(message) ? (translate ? translate(field) : `Le champ « ${field} » n'est pas valide.`) : message);
    }
    if (error.children?.length) messages.push(...flatten(error.children, field));
  }
  return messages;
}

export function rpcValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    // Les champs inconnus sont retirés (sans refus) : un service appelant
    // peut transmettre davantage de contexte que nécessaire.
    whitelist: true,
    transform: true,
    exceptionFactory: (errors) => new RpcException({ statusCode: 400, message: flatten(errors) }),
  });
}
