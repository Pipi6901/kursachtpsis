import {RoleTypeType} from "../../../types/role-type.type";

export class RoleTypeUtil {
  static getRoleType(status: RoleTypeType | undefined | null): { name: string } {
    let name = 'Пользователь';

    switch (status) {
      case RoleTypeType.ROLE_USER:
        name = 'Пользователь';
        break;
      case RoleTypeType.ROLE_ADMIN:
        name = 'Владелец';
        break;
      case RoleTypeType.ROLE_MANAGER:
        name = 'Управляющий';
        break;
    }

    return {name};
  }
}
