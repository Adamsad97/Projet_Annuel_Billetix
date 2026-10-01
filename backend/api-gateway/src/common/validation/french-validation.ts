import { BadRequestException, ValidationError } from "@nestjs/common";

/** Messages de validation en français ; un message déclaré sur le décorateur reste prioritaire. */
const TRANSLATIONS: Record<string, (field: string, error: ValidationError) => string> = {
  isDefined: (field) => `Le champ « ${field} » est obligatoire.`,
  isNotEmpty: (field) => `Le champ « ${field} » est obligatoire.`,
  isString: (field) => `Le champ « ${field} » doit être un texte.`,
  isBoolean: (field) => `Le champ « ${field} » doit valoir vrai ou faux.`,
  isInt: (field) => `Le champ « ${field} » doit être un nombre entier.`,
  isNumber: (field) => `Le champ « ${field} » doit être un nombre.`,
  isPositive: (field) => `Le champ « ${field} » doit être positif.`,
  min: (field, error) => `Le champ « ${field} » est trop petit (minimum ${constraintValue(error, "min")}).`,
  max: (field, error) => `Le champ « ${field} » est trop grand (maximum ${constraintValue(error, "max")}).`,
  minLength: (field, error) => `Le champ « ${field} » est trop court (${constraintValue(error, "minLength")} caractères minimum).`,
  maxLength: (field, error) => `Le champ « ${field} » est trop long (${constraintValue(error, "maxLength")} caractères maximum).`,
  length: (field) => `La longueur du champ « ${field} » n'est pas valide.`,
  isEmail: () => "L'adresse email n'est pas valide.",
  isUUID: (field) => `Le champ « ${field} » doit être un identifiant valide.`,
  isDateString: (field) => `Le champ « ${field} » doit être une date valide.`,
  isISO8601: (field) => `Le champ « ${field} » doit être une date valide.`,
  isEnum: (field) => `La valeur du champ « ${field} » n'est pas autorisée.`,
  isIn: (field) => `La valeur du champ « ${field} » n'est pas autorisée.`,
  isArray: (field) => `Le champ « ${field} » doit être une liste.`,
  arrayNotEmpty: (field) => `La liste « ${field} » ne doit pas être vide.`,
  arrayMinSize: (field) => `La liste « ${field} » contient trop peu d'éléments.`,
  arrayMaxSize: (field) => `La liste « ${field} » contient trop d'éléments.`,
  isObject: (field) => `Le champ « ${field} » n'est pas valide.`,
  matches: (field) => `Le format du champ « ${field} » n'est pas valide.`,
  isUrl: (field) => `Le champ « ${field} » doit être une adresse web valide.`,
  isPhoneNumber: () => "Le numéro de téléphone n'est pas valide.",
  whitelistValidation: (field) => `Le champ « ${field} » n'est pas accepté.`,
};

function constraintValue(error: ValidationError, key: string): string {
  // Le message d'origine contient la valeur (« must not be greater than 100 ») ;
  // on la récupère pour ne pas perdre l'information.
  const raw = error.constraints?.[key] ?? "";
  const match = raw.match(/(-?\d+(?:\.\d+)?)/);
  return match ? match[1] : "";
}

function isEnglishDefault(message: string): boolean {
  // Les messages par défaut de class-validator sont en anglais ; ceux déclarés
  // dans nos DTO sont déjà en français (accents, guillemets, vouvoiement).
  return /^[\x20-\x7E]*$/.test(message) &&/\b(must|should|property|exist)\b/i.test(message);
}

function flatten(errors: ValidationError[], parent = ""): string[] {
  const messages: string[] = [];
  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property;
    for (const [constraint, message] of Object.entries(error.constraints ?? {})) {
      const translate = TRANSLATIONS[constraint];
      messages.push(isEnglishDefault(message) ? (translate ? translate(field, error) : `Le champ « ${field} » n'est pas valide.`) : message);
    }
    if (error.children?.length) messages.push(...flatten(error.children, field));
  }
  return messages;
}

/** exceptionFactory du ValidationPipe global. */
export function frenchValidationException(errors: ValidationError[]): BadRequestException {
  return new BadRequestException(flatten(errors));
}
