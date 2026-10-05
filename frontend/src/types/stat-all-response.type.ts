import {StatRoomsResponseType} from "./stat-rooms-response.type";

export type StatAllResponseType = {
  totalIncome: number,
  topRoomsByIncome: StatRoomsResponseType[],
  topRoomsByBooking: StatRoomsResponseType[],
}
