import {HotelTypeType} from "./hotel-type.type";
import {BedsTypeType} from "./beds-type.type";
import {CommentResponseType} from "./comment-response.type";

export type RoomImageType = {
  id: number,
  url: string
}

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

  /** Площадь, м²; вид из окна; удобства (коды из каталога AMENITIES); фотографии по порядку, первая – обложка. */
  area?: number | null,
  view?: string | null,
  amenities?: string[],
  images?: RoomImageType[],

  typeRus?: string,
  bedsTypeRus?: string
}
