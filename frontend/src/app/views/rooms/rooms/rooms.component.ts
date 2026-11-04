import { Component, OnDestroy, OnInit } from '@angular/core';
import {RoomService} from "../../../shared/services/room.service";
import {AuthService} from "../../../core/auth/auth.service";
import {RoomResponseType} from "../../../../types/room-response.type";
import {BedsTypeUtil} from "../../../shared/utils/beds-type.util";
import {HotelTypeUtil} from "../../../shared/utils/hotel-type.util";
import {debounceTime, Subject, Subscription} from "rxjs";
import {DateRangeUtil} from "../../../shared/utils/date-range.util";
import {ActivatedRoute, Router} from "@angular/router";
import {HotelTypeType} from "../../../../types/hotel-type.type";
import {EMPTY_CRITERIA, RoomCriteria, RoomFilterUtil, RoomSort} from "../../../shared/utils/room-filter.util";
import {AMENITIES, Amenity} from "../../../shared/utils/amenities.util";

/** Плашка применённого условия отбора с кнопкой «убрать». */
type Chip = { label: string, remove: () => void };

@Component({
    selector: 'app-rooms',
    templateUrl: './rooms.component.html',
    styleUrls: ['./rooms.component.scss'],
    standalone: false
})
export class RoomsComponent implements OnInit, OnDestroy {

  /** Сколько удобств показывается в панели до нажатия «Показать все». */
  static readonly AMENITIES_SHOWN = 7;

  rooms: RoomResponseType[] = [];
  visible: RoomResponseType[] = [];
  loaded = false;
  isAdmin: boolean = false;

  /** Условия отбора. */
  query = '';
  categories: HotelTypeType[] = [];
  minGuests = 0;
  priceLow: number | null = null;
  priceHigh: number | null = null;
  amenities: string[] = [];
  onlyFree = false;
  sort: RoomSort = 'default';

  /** Фильтр «свободны на даты»: идентификаторы номеров, свободных на весь период (проверяет сервер). */
  checkIn = '';
  checkOut = '';
  readonly today = DateRangeUtil.today();
  availableIds: Set<string> | null = null;
  availabilityError = '';

  /** Данные для панели фильтров. */
  bounds = {min: 0, max: 0};
  amenityCounts = new Map<string, number>();
  amenityOptions: Amenity[] = [];
  showAllAmenities = false;
  chips: Chip[] = [];
  /** панель фильтров открыта (на телефонах – выдвижная) */
  filtersOpen = false;

  readonly categoryOptions = [
    {value: HotelTypeType.ECONOMY, label: 'Эконом'},
    {value: HotelTypeType.STANDARD, label: 'Стандарт'},
    {value: HotelTypeType.VIP, label: 'ВИП'},
  ];
  readonly guestOptions = [
    {value: 0, label: 'Любая'},
    {value: 2, label: '2+'},
    {value: 4, label: '4+'},
    {value: 6, label: '6+'},
  ];
  readonly sortOptions: { value: RoomSort, label: string }[] = [
    {value: 'default', label: 'По умолчанию'},
    {value: 'price-asc', label: 'Сначала дешевле'},
    {value: 'price-desc', label: 'Сначала дороже'},
    {value: 'area-desc', label: 'Больше площадь'},
    {value: 'reviews-desc', label: 'Больше отзывов'},
  ];

  private urlSync = new Subject<void>();
  private subscription = new Subscription();

  constructor(private roomService: RoomService,
              private authService: AuthService,
              private route: ActivatedRoute,
              private router: Router) {
    this.isAdmin = this.authService.getIsAdminIn();
  }

  get minCheckOut(): string {
    return this.checkIn ? DateRangeUtil.addDays(this.checkIn, 1) : DateRangeUtil.addDays(this.today, 1);
  }

  get dateFilterActive(): boolean {
    return this.availableIds !== null;
  }

  /** Подпись периода: «12.11 – 15.11, 3 ночи». */
  get periodLabel(): string {
    if (!this.dateFilterActive) {
      return '';
    }
    const nights = DateRangeUtil.nights(this.checkIn, this.checkOut);
    return `${this.shortDate(this.checkIn)} – ${this.shortDate(this.checkOut)}, ${nights} ${this.nightsWord(nights)}`;
  }

  get priceStep(): number {
    return this.bounds.max - this.bounds.min > 150 ? 5 : 1;
  }

  /** Значения бегунков цены: не выбранные границы равны пределам. */
  get sliderLow(): number {
    return this.priceLow ?? this.bounds.min;
  }

  get sliderHigh(): number {
    return this.priceHigh ?? this.bounds.max;
  }

  get criteria(): RoomCriteria {
    return {
      ...EMPTY_CRITERIA,
      query: this.query,
      categories: this.categories,
      minGuests: this.minGuests,
      priceMin: this.priceLow !== null && this.priceLow > this.bounds.min ? this.priceLow : null,
      priceMax: this.priceHigh !== null && this.priceHigh < this.bounds.max ? this.priceHigh : null,
      amenities: this.amenities,
      onlyFree: this.onlyFree,
    };
  }

  /** Сколько условий применено (для кнопки «Фильтры» на телефоне). */
  get activeCount(): number {
    return this.chips.length;
  }

  get shownAmenityOptions(): Amenity[] {
    return this.showAllAmenities ? this.amenityOptions : this.amenityOptions.slice(0, RoomsComponent.AMENITIES_SHOWN);
  }

  ngOnInit(): void {
    this.subscription.add(this.authService.isAdmin$.subscribe((isAdminIn: boolean) => {
      this.isAdmin = isAdminIn;
    }));

    // запоминаем условия в адресе страницы: ссылкой на отбор можно поделиться, «назад» не теряет выбор
    this.subscription.add(this.urlSync.pipe(debounceTime(300)).subscribe(() => this.writeUrl()));
    this.readUrl();

    this.roomService.getRooms().subscribe((data: RoomResponseType[]) => {
      this.rooms = data.map(item => {
        item.bedsTypeRus = BedsTypeUtil.getBedsType(item.beds).name;
        item.typeRus = HotelTypeUtil.getHotelType(item.type).name;
        return item;
      });
      this.bounds = RoomFilterUtil.priceBounds(this.rooms);
      this.amenityCounts = RoomFilterUtil.amenityCounts(this.rooms);
      this.amenityOptions = AMENITIES.filter(a => this.amenityCounts.has(a.code));
      // выбранное в адресе удобство, скрытое за «Показать все», раскрывает список
      this.showAllAmenities = this.amenities.some(code =>
        this.amenityOptions.findIndex(a => a.code === code) >= RoomsComponent.AMENITIES_SHOWN);
      this.loaded = true;
      this.refresh();
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    document.body.style.overflow = '';
  }

  /** Пересчитывает список и плашки после любого изменения условий. */
  changed(): void {
    this.refresh();
    this.urlSync.next();
  }

  private refresh(): void {
    this.visible = RoomFilterUtil.apply(this.rooms, this.criteria, this.sort, this.availableIds);
    this.chips = this.buildChips();
  }

  count(type: HotelTypeType): number {
    return this.rooms.filter(r => r.type === type).length;
  }

  amenityCount(code: string): number {
    return this.amenityCounts.get(code) ?? 0;
  }

  toggleCategory(type: HotelTypeType): void {
    this.categories = this.categories.includes(type) ? this.categories.filter(c => c !== type) : [...this.categories, type];
    this.changed();
  }

  toggleAmenity(code: string): void {
    this.amenities = this.amenities.includes(code) ? this.amenities.filter(c => c !== code) : [...this.amenities, code];
    this.changed();
  }

  setGuests(value: number): void {
    this.minGuests = value;
    this.changed();
  }

  onPrice(range: { low: number, high: number }): void {
    this.priceLow = range.low;
    this.priceHigh = range.high;
    this.changed();
  }

  onDatesChange(): void {
    this.availabilityError = '';
    if (!this.checkIn || !this.checkOut) {
      this.availableIds = null;
      this.changed();
      return;
    }
    if (this.checkIn < this.today) {
      this.availabilityError = 'Дата заезда не может быть в прошлом';
      this.availableIds = null;
      this.changed();
      return;
    }
    if (this.checkOut <= this.checkIn) {
      this.availabilityError = 'Дата выезда должна быть позже даты заезда';
      this.availableIds = null;
      this.changed();
      return;
    }
    this.roomService.getAvailableRooms(this.checkIn, this.checkOut).subscribe({
      next: (data: RoomResponseType[]) => {
        this.availableIds = new Set(data.map(room => String(room.id)));
        this.changed();
      },
      error: () => {
        this.availabilityError = 'Не удалось проверить занятость номеров';
        this.availableIds = null;
        this.changed();
      }
    });
  }

  resetDates(): void {
    this.checkIn = '';
    this.checkOut = '';
    this.availabilityError = '';
    this.availableIds = null;
    this.changed();
  }

  /** Сбрасывает все условия, даты и сортировку. */
  resetAll(): void {
    this.query = '';
    this.categories = [];
    this.minGuests = 0;
    this.priceLow = null;
    this.priceHigh = null;
    this.amenities = [];
    this.onlyFree = false;
    this.sort = 'default';
    this.checkIn = '';
    this.checkOut = '';
    this.availabilityError = '';
    this.availableIds = null;
    this.changed();
  }

  openFilters(): void {
    this.filtersOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeFilters(): void {
    this.filtersOpen = false;
    document.body.style.overflow = '';
  }

  private buildChips(): Chip[] {
    const chips: Chip[] = [];
    const q = this.query.trim();
    if (q) {
      chips.push({label: `«${q}»`, remove: () => { this.query = ''; this.changed(); }});
    }
    for (const type of this.categories) {
      chips.push({label: HotelTypeUtil.getHotelType(type).name, remove: () => this.toggleCategory(type)});
    }
    if (this.minGuests) {
      chips.push({label: `от ${this.minGuests} гостей`, remove: () => this.setGuests(0)});
    }
    const c = this.criteria;
    if (c.priceMin !== null || c.priceMax !== null) {
      chips.push({
        label: `${c.priceMin ?? this.bounds.min}–${c.priceMax ?? this.bounds.max} $`,
        remove: () => { this.priceLow = null; this.priceHigh = null; this.changed(); }
      });
    }
    for (const code of this.amenities) {
      const a = AMENITIES.find(x => x.code === code);
      chips.push({label: a ? a.label : code, remove: () => this.toggleAmenity(code)});
    }
    if (this.onlyFree) {
      chips.push({label: 'Свободные сейчас', remove: () => { this.onlyFree = false; this.changed(); }});
    }
    if (this.dateFilterActive) {
      chips.push({label: `Свободны ${this.periodLabel}`, remove: () => this.resetDates()});
    }
    return chips;
  }

  /** Читает условия из адреса страницы: /rooms?q=люкс&cat=VIP&guests=2&pmin=50&am=WIFI,AC&free=1&sort=price-asc&from=…&to=… */
  private readUrl(): void {
    const p = this.route.snapshot.queryParamMap;
    this.query = p.get('q') ?? '';
    const known = this.categoryOptions.map(o => o.value as string);
    this.categories = (p.get('cat') ?? '').split(',').filter(v => known.includes(v)) as HotelTypeType[];
    const guests = Number(p.get('guests'));
    this.minGuests = this.guestOptions.some(o => o.value === guests) ? guests : 0;
    const num = (key: string) => p.get(key) !== null && p.get(key) !== '' && !isNaN(Number(p.get(key))) ? Number(p.get(key)) : null;
    this.priceLow = num('pmin');
    this.priceHigh = num('pmax');
    this.amenities = (p.get('am') ?? '').split(',').filter(v => /^[A-Z0-9_]{2,40}$/.test(v));
    this.onlyFree = p.get('free') === '1';
    const sort = p.get('sort') as RoomSort;
    this.sort = this.sortOptions.some(o => o.value === sort) ? sort : 'default';

    // даты можно передать и из строки быстрого бронирования на главной
    const from = p.get('from'), to = p.get('to');
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (from && to && iso.test(from) && iso.test(to)) {
      this.checkIn = from;
      this.checkOut = to;
      this.onDatesChange();
    }
  }

  private writeUrl(): void {
    const c = this.criteria;
    const queryParams: Record<string, string | null> = {
      q: this.query.trim() || null,
      cat: this.categories.length ? this.categories.join(',') : null,
      guests: this.minGuests ? String(this.minGuests) : null,
      pmin: c.priceMin !== null ? String(c.priceMin) : null,
      pmax: c.priceMax !== null ? String(c.priceMax) : null,
      am: this.amenities.length ? this.amenities.join(',') : null,
      free: this.onlyFree ? '1' : null,
      sort: this.sort !== 'default' ? this.sort : null,
      from: this.checkIn && this.checkOut ? this.checkIn : null,
      to: this.checkIn && this.checkOut ? this.checkOut : null,
    };
    this.router.navigate([], {relativeTo: this.route, queryParams, replaceUrl: true});
  }

  private shortDate(iso: string): string {
    return iso.slice(8, 10) + '.' + iso.slice(5, 7);
  }

  private nightsWord(n: number): string {
    const m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? 'ночь' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'ночи' : 'ночей';
  }
}
