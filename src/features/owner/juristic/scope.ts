import "server-only";

import { kindOf, KIND_TRAITS, type KindTraits, type PropertyKind } from "@/domain/juristic/vocabulary";
import type { Schemas } from "@/lib/api/types";

import { param, type OwnerContext } from "../shared/server";

/**
 * The part of the estate a juristic page shows: one property (a condominium, a housing estate…) and, inside it, one
 * building (a condo tower, or a soi of an estate). Chosen by `?property=` / `?building=`, else the rail's building
 * switcher, else the first property with a kind. The property's kind decides the words and the register's layout
 * (J-DESIGN §1.3); the API checks every id itself.
 */
export interface JuristicScope {
  property: Schemas["PropertyDto"] | null;
  /** Properties the tenant runs, in the API's order. */
  properties: Schemas["PropertyDto"][];
  /** The buildings of the chosen property. */
  buildings: Schemas["BuildingDto"][];
  building: Schemas["BuildingDto"] | null;
  kind: PropertyKind;
  traits: KindTraits;
}

export function juristicScope(
  context: OwnerContext,
  searchParams: Record<string, string | string[] | undefined> = {},
): JuristicScope {
  const focus = context.building;
  const wantedBuilding = context.buildings.find((candidate) => candidate.id === param(searchParams.building));
  const wantedProperty =
    context.properties.find((candidate) => candidate.id === param(searchParams.property)) ??
    context.properties.find((candidate) => candidate.id === (wantedBuilding ?? focus)?.propertyId);
  const property =
    wantedProperty ?? context.properties.find((candidate) => candidate.kind) ?? context.properties[0] ?? null;
  const buildings = property ? context.buildings.filter((candidate) => candidate.propertyId === property.id) : [];
  const building =
    (wantedBuilding && wantedBuilding.propertyId === property?.id ? wantedBuilding : null) ??
    (focus && focus.propertyId === property?.id ? focus : null) ??
    buildings[0] ??
    null;
  const kind = kindOf(property);
  return { property, properties: context.properties, buildings, building, kind, traits: KIND_TRAITS[kind] };
}
