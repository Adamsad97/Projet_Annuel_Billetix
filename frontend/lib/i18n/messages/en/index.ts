// Traductions anglaises, un fichier JSON par partie du site ; clé = texte français exact.

import account from "./account.json";
import admin from "./admin.json";
import auth from "./auth.json";
import common from "./common.json";
import legal from "./legal.json";
import organizer from "./organizer.json";
import publicPages from "./public.json";
import scan from "./scan.json";
import extra from "./extra.json";

export const en: Record<string, string> = {
  ...common,
  ...publicPages,
  ...auth,
  ...account,
  ...organizer,
  ...admin,
  ...scan,
  ...legal,
  ...extra,
};
