"use client";

import { useEffect, useState } from "react";
import { getRegistrationPolicy } from "@/lib/api/auth";

export interface RegistrationPolicy {
  passwordMinLength: number;
  minimumAge: number;
}

// Valeurs de repli uniquement (API injoignable ou chargement en cours) —
// identiques au FALLBACK d'auth-service. Les vraies valeurs viennent de
// platform_settings (password_min_length, minimum_signup_age), réglables
// par l'admin.
const FALLBACK: RegistrationPolicy = { passwordMinLength: 12, minimumAge: 18 };

// Une seule requête par chargement de page, partagée entre les formulaires.
let cached: Promise<RegistrationPolicy> | null = null;

function loadPolicy(): Promise<RegistrationPolicy> {
  cached ??= getRegistrationPolicy()
    .then((policy) => ({
      passwordMinLength: policy.password_min_length,
      minimumAge: policy.minimum_age,
    }))
    .catch(() => {
      cached = null; // retentera au prochain montage
      return FALLBACK;
    });
  return cached;
}

export function useRegistrationPolicy(): RegistrationPolicy {
  const [policy, setPolicy] = useState(FALLBACK);

  useEffect(() => {
    let active = true;
    loadPolicy().then((value) => {
      if (active) setPolicy(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return policy;
}
