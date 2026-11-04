import { Component, OnInit } from '@angular/core';
import {RoomService} from "../../../shared/services/room.service";
import {AuthService} from "../../../core/auth/auth.service";
import {RoomResponseType} from "../../../../types/room-response.type";
import {BedsTypeUtil} from "../../../shared/utils/beds-type.util";
import {HotelTypeUtil} from "../../../shared/utils/hotel-type.util";
import {FormControl} from "@angular/forms";
import {debounceTime} from "rxjs";
import {DateRangeUtil} from "../../../shared/utils/date-range.util";
import {ActivatedRoute} from "@angular/router";
import {HotelTypeType} from "../../../../types/hotel-type.type";

type SortMode = 'default' | 'price-asc' | 'price-desc';

@Component({
    selector: 'app-rooms',
    templateUrl: './rooms.component.html',
    styleUrls: ['./rooms.component.scss'],
    standalone: false
})
export class RoomsComponent implements OnInit {

  searchField = new FormControl();
  rooms: RoomResponseType[] = [];
  isAdmin: boolean = false;
  loaded = false;

  /** Фильтр «свободны на даты»: заезд и выезд; идентификаторы номеров, свободных на весь период. */
  checkIn = '';
  checkOut = '';
  readonly today = DateRangeUtil.today();
  availableIds: Set<string> | null = null;
  availabilityError = '';

  /** Категории для быстрого отбора и порядок показа. */
  readonly categories: { value: HotelTypeType | null, label: string }[] = [
    {value: null, label: 'Все'},
    {value: HotelTypeType.ECONOMY, label: 'Эконом'},
    {value: HotelTypeType.STANDARD, label: 'Стандарт'},
    {value: HotelTypeType.VIP, label: 'ВИП'},
  ];
  category: HotelTypeType | null = null;
  sort: SortMode = 'default';

  constructor(private roomService: RoomService,
              private authService: AuthService,
              private route: ActivatedRoute) {
    this.isAdmin = this.authService.getIsAdminIn();
  }

  /** Номера для показа: если выбраны даты — только свободные на них; затем категория и порядок. */
  get visibleRooms(): RoomResponseType[] {
    const ids = this.availableIds;
    let list = ids ? this.rooms.filter(room => ids.has(String(room.id))) : this.rooms;
    if (this.category) {
      list = list.filter(room => room.type === this.category);
    }
    if (this.sort !== 'default') {
      const k = this.sort === 'price-asc' ? 1 : -1;
      list = [...list].sort((a, b) => k * (a.price - b.price));
    }
    return list;
  }

  /** Подпись периода для строки результатов: «12.11 – 15.11, 3 ночи». */
  get periodLabel(): string {
    if (!this.dateFilterActive) {
      return '';
    }
    const fmt = (iso: string) => iso.slice(8, 10) + '.' + iso.slice(5, 7);
    const nights = DateRangeUtil.nights(this.checkIn, this.checkOut);
    return `${fmt(this.checkIn)} – ${fmt(this.checkOut)}, ${nights} ${this.nightsWord(nights)}`;
  }

  private nightsWord(n: number): string {
    const m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? 'ночь' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'ночи' : 'ночей';
  }

  /** Названия и подписи категории/мест для карточек. */
  private withLabels(data: RoomResponseType[]): RoomResponseType[] {
    return data.map(item => {
      item.bedsTypeRus = BedsTypeUtil.getBedsType(item.beds).name;
      item.typeRus = HotelTypeUtil.getHotelType(item.type).name;
      return item;
    });
  }

  get dateFilterActive(): boolean {
    return this.availableIds !== null;
  }

  get minCheckOut(): string {
    return this.checkIn ? DateRangeUtil.addDays(this.checkIn, 1) : DateRangeUtil.addDays(this.today, 1);
  }

  onDatesChange(): void {
    this.availabilityError = '';
    if (!this.checkIn || !this.checkOut) {
      this.availableIds = null;
      return;
    }
    if (this.checkIn < this.today) {
      this.availabilityError = 'Дата заезда не может быть в прошлом';
      this.availableIds = null;
      return;
    }
    if (this.checkOut <= this.checkIn) {
      this.availabilityError = 'Дата выезда должна быть позже даты заезда';
      this.availableIds = null;
      return;
    }
    this.roomService.getAvailableRooms(this.checkIn, this.checkOut).subscribe({
      next: (data: RoomResponseType[]) => this.availableIds = new Set(data.map(room => String(room.id))),
      error: () => {
        this.availabilityError = 'Не удалось проверить занятость номеров';
        this.availableIds = null;
      }
    });
  }

  resetDates(): void {
    this.checkIn = '';
    this.checkOut = '';
    this.availabilityError = '';
    this.availableIds = null;
  }

  ngOnInit(): void {
    this.authService.isAdmin$.subscribe((isAdminIn: boolean) => {
      this.isAdmin = isAdminIn;
    });

    // даты можно передать из строки бронирования на главной: /rooms?from=гггг-мм-дд&to=гггг-мм-дд
    const params = this.route.snapshot.queryParamMap;
    const from = params.get('from'), to = params.get('to');
    if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      this.checkIn = from;
      this.checkOut = to;
      this.onDatesChange();
    }

    this.loadRooms();

    this.searchField.valueChanges
      .pipe(
        debounceTime(500)
      )
      .subscribe(value => this.loadRooms(value));
  }

  private loadRooms(query?: string): void {
    const request = query && query.length > 0 ? this.roomService.searchRoom(query) : this.roomService.getRooms();
    request.subscribe((data: RoomResponseType[]) => {
      this.rooms = this.withLabels(data);
      this.loaded = true;
    });
  }

}
