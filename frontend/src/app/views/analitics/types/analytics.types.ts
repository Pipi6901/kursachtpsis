// types/analytics-response.type.ts
export interface AnalyticsMetricsResponse {
  totalRevenue: number;
  totalBookings: number;
  confirmedBookings: number;
  waitingBookings: number;
  rejectedBookings: number;
  totalRooms: number;
  occupiedRooms: number;
  occupancyRate: number;
  totalUsers: number;
}

export interface RevenueByMonthResponse {
  month: string;
  revenue: number;
  bookingsCount: number;
}

export interface RoomTypeStatsResponse {
  type: string;
  bookingsCount: number;
  totalRevenue: number;
  occupancyRate: number;
}

export interface BookingStatusResponse {
  status: string;
  count: number;
  percentage: number;
}

export interface TopClientResponse {
  name: string;
  bookings: number;
  totalSpent: number;
  avgSpent: number;
}

export interface RoomsReportResponse {
  id: number;
  name: string;
  type: string;
  price: number;
  free: boolean;
  beds: string;
  floor: number;
  bookingCount: number;
  revenue: number;
}
