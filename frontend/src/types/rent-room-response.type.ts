import {HotelTypeType} from "./hotel-type.type";
import {BedsTypeType} from "./beds-type.type";
import {StatusTypeType} from "./status-type.type";

export type RentRoomResponseType = {
  id: string,
  name: string,
  price: number,
  photo: string,
  free: boolean,
  days: number,
  type: HotelTypeType,
  beds: BedsTypeType,
  number: number,
  description: string,
  floor: number,
  comments?: string,
  status?: StatusTypeType,
  owner?: string,

  typeRus?: string,
  bedsTypeRus?: string,
  statusRus?: string
  color: string
}
