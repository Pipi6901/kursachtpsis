import {HotelTypeType} from "../../../types/hotel-type.type";

export class HotelTypeUtil {
  static getHotelType(status: HotelTypeType | undefined | null): { name: string } {
    let name = 'Стандарт';

    switch (status) {
      case HotelTypeType.STANDARD:
        name = 'Стандарт';
        break;
      case HotelTypeType.ECONOMY:
        name = 'Эконом';
        break;
      case HotelTypeType.VIP:
        name = 'ВИП';
        break;
    }

    return {name};
  }
}
