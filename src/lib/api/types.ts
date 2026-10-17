import type { components, paths } from "./schema";

/**
 * Named views of the generated contract (`schema.d.ts`, `pnpm gen:api`). Nothing here declares a
 * shape of its own: every type is an index into the generated file, so a contract change surfaces
 * as a type error where it matters.
 */
export type { components, paths };
export type Schemas = components["schemas"];
export type Problem = Schemas["ProblemDetails"];
export type ProblemFieldError = Schemas["ProblemFieldError"];
export type TokenPair = Schemas["TokenPairDto"];
export type OperatorMe = Schemas["OperatorMeDto"];
export type AdminMe = Schemas["AdminMeDto"];

/**
 * A contract enum when the backend publishes it, the planned values until then. Lets
 * `src/domain/status` be typed against an enum the backend has designed (schema-design v2) but not
 * yet exposed: once `pnpm gen:api` brings the named component in, the generated type wins and a
 * difference between the two fails the build at the status map.
 */
export type ContractEnum<Name extends string, Planned extends string> = Name extends keyof Schemas
  ? Schemas[Name] extends string
    ? Schemas[Name]
    : Planned
  : Planned;
