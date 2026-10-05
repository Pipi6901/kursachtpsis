import {RoleTypeType} from "./role-type.type";

export type LoginResponseType = {
  token: string,
  roles: RoleTypeType[]
}
