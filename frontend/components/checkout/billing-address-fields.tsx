"use client";

// Bloc « adresse de facturation » commun à l'achat et à la revente.
// Bugs corrigés : le champ Adresse n'avait aucune proposition, la liste des
// pays se limitait à 5 (FR, BE, CH, SN, CI — la Guinée, entre autres,
// impossible à choisir) et le code postal était obligatoire alors que de
// nombreux pays n'en utilisent pas. Les champs gardent leurs attributs
// `name` : les formulaires parents continuent de lire via FormData.

import { useState } from "react";
import { AddressAutocomplete } from "@/components/create-event/address-autocomplete";
import { COUNTRY_OPTIONS, countryName, isKnownCountryCode } from "@/lib/geo/countries";

export function BillingAddressFields({ fieldClassName }: { fieldClassName: string }) {
  const [address1, setAddress1] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("FR");

  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-accent/80">Adresse</span>
        <AddressAutocomplete
          name="address1"
          value={address1}
          onChangeText={setAddress1}
          country={countryName(country)}
          placeholder="Commencez à taper votre adresse…"
          onSelect={(suggestion) => {
            setAddress1(suggestion.addressLine1);
            setCity(suggestion.city);
            setPostalCode(suggestion.postalCode);
            if (isKnownCountryCode(suggestion.countryCode)) setCountry(suggestion.countryCode);
          }}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-accent/80">
          Complément d&apos;adresse (facultatif)
        </span>
        <input type="text" name="address2" autoComplete="address-line2" className={fieldClassName} />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_160px]">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">Ville</span>
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
          <span className="text-sm font-medium text-accent/80">
            Code postal <span className="font-normal text-ink-5">(si applicable)</span>
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
        <span className="text-sm font-medium text-accent/80">Pays</span>
        <select
          name="country"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          className={fieldClassName}
        >
          {COUNTRY_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
