import {RoleTypeType} from "./role-type.type";

export type SignupResponseType = {
  id: string,
  name: string,
  username: string,
  email: string,
  phone: string,
  balance: number,
  roles?: RoleTypeType,
  photo?: string,

  rolesTypeRus?: string
}
