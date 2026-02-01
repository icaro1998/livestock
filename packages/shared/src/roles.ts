export type Role = "admin" | "manager" | "viewer";

export const ROLE_ORDER: Role[] = ["viewer", "manager", "admin"];

export const roleAllows = (role: Role, required: Role) => {
  const idx = ROLE_ORDER.indexOf(role);
  const reqIdx = ROLE_ORDER.indexOf(required);
  return idx >= reqIdx;
};
