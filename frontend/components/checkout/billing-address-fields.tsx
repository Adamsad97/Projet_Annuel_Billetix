"use client";

// Adresse de facturation commune à l'achat et à la revente : suggestions, tous les pays, code postal facultatif.

import { useState } from "react";
import { AddressAutocomplete } from "@/components/create-event/address-autocomplete";
import { countryOptions, countryName, isKnownCountryCode } from "@/lib/geo/countries";
import { t } from "@/lib/i18n/translate";

export function BillingAddressFields({ fieldClassName }: { fieldClassName: string }) {
  const [address1, setAddress1] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("FR");

  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-accent/80">{t("Adresse")}</span>
        <AddressAutocomplete
          name="address1"
          value={address1}
          onChangeText={setAddress1}
          country={countryName(country)}
          placeholder={t("Commencez à taper votre adresse…")}
          onSelect={(suggestion) => {
            setAddress1(suggestion.addressLine1);
            setCity(suggestion.city);
            setPostalCode(suggestion.postalCode);
            if (isKnownCountryCode(suggestion.countryCode)) setCountry(suggestion.countryCode);
          }}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-accent/80">{t("Complément d'adresse (facultatif)")}</span>
        <input type="text" name="address2" autoComplete="address-line2" className={fieldClassName} />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_160px]">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">{t("Ville")}</span>
          <input
            type="text"
            name="city"
            required
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className={fieldClassName}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">{t("Code postal")}{" "}<span className="font-normal text-ink-5">{t("(si applicable)")}</span>
          </span>
          <input
            type="text"
            name="postalCode"
            value={postalCode}
            onChange={(event) => setPostalCode(event.target.value)}
            className={fieldClassName}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-accent/80">{t("Pays")}</span>
        <select
          name="country"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          className={fieldClassName}
        >
          {countryOptions().map((option) => (
            <option key={option.code} value={option.code}>
              {t(option.name)}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
