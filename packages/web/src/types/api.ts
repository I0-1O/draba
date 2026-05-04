/**
 * Named re-exports of API wire-format types generated from packages/shared/openapi.yaml.
 *
 * Import these in components and hooks instead of reaching into the raw
 * generated file — this layer insulates callers from openapi-typescript's
 * internal schema path syntax.
 */
import type { components } from "@draba/shared";

type Schemas = components["schemas"];

export type User = Schemas["User"];
export type Team = Schemas["Team"];
export type TeamMember = Schemas["TeamMember"];
/** Team member extended with user display fields (email, displayName, avatarUrl). */
export type TeamMemberWithUser = Schemas["TeamMemberWithUser"];
export type Invite = Schemas["Invite"];
/**
 * API event — a scheduled work item assigned to a team.
 *
 * Named `Event` to mirror the server model; note this shadows the global DOM
 * `Event` type. If both are needed in the same file, alias one at the import site.
 */
export type Event = Schemas["Event"];
export type AuthResponse = Schemas["AuthResponse"];
export type RefreshResponse = Schemas["RefreshResponse"];
export type ApiError = Schemas["ApiError"];
