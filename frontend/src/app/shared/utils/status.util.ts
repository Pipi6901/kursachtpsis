import {StatusTypeType} from "../../../types/status-type.type";

export class StatusUtil {
  static getStatus(status: StatusTypeType | undefined | null): { name: string, color: string } {
    let name = 'Ожидание';
    let color = "gray";

    switch (status) {
      case StatusTypeType.DONE:
        name = 'Подтверждено';
        color = 'green';
        break;
      case StatusTypeType.REJECT:
        name = 'Отказано';
        color = 'red';
        break;
      case StatusTypeType.COMPLETED:
        name = 'Завершено';
        color = '#3b6ea5';
        break;
    }

    return {name, color};

  }
}
