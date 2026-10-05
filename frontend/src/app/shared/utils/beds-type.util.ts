import {BedsTypeType} from "../../../types/beds-type.type";

export class BedsTypeUtil {
  static getBedsType(status: BedsTypeType | undefined | null): { name: string } {
    let name = 'Один';

    switch (status) {
      case BedsTypeType.ONE:
        name = 'Один';
        break;
      case BedsTypeType.TWO:
        name = 'Два';
        break;
      case BedsTypeType.FOUR:
        name = 'Четыре';
        break;
      case BedsTypeType.SIX:
        name = 'Шесть';
        break;
      case BedsTypeType.EIGHT:
        name = 'Восемь';
        break;
    }

    return {name};
  }
}
