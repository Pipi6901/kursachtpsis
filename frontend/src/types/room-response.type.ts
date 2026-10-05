import {HotelTypeType} from "./hotel-type.type";
import {BedsTypeType} from "./beds-type.type";
import {CommentResponseType} from "./comment-response.type";

export type RoomResponseType = {
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
  comments?: CommentResponseType[],

  typeRus?: string,
  bedsTypeRus?: string
}
