import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { RoomResponseType } from "../../../types/room-response.type";
import { RoomService } from "../../shared/services/room.service";
import { BedsTypeUtil } from "../../shared/utils/beds-type.util";
import { HotelTypeUtil } from "../../shared/utils/hotel-type.util";
import { DateRangeUtil } from "../../shared/utils/date-range.util";

/** Отзыв гостя для блока «Что говорят клиенты». */
type Testimonial = { author: string, text: string, room?: string };

@Component({
    selector: 'app-main',
    templateUrl: './main.component.html',
    styleUrls: ['./main.component.scss'],
    standalone: false
})
export class MainComponent implements OnInit, OnDestroy {

  readonly heroSlides = [
    'assets/img/hero/hero-1.jpg',
    'assets/img/hero/hero-2.jpg',
    'assets/img/hero/hero-3.jpg',
  ];
  heroIndex = 0;
  private timer?: ReturnType<typeof setInterval>;

  readonly services = [
    {icon: 'map', title: 'План путешествия', text: 'Предложим маршруты по городу и окрестностям, которые позволят насладиться уникальными достопримечательностями.'},
    {icon: 'utensils', title: 'Кейтеринг', text: 'Вкусная и разнообразная еда на любом мероприятии. Индивидуальное меню с учётом диетических ограничений.'},
    {icon: 'baby', title: 'Присмотр за детьми', text: 'Профессиональные няни обеспечат безопасность и интересные занятия, пока вы заняты своими делами.'},
    {icon: 'shirt', title: 'Прачечная', text: 'Быстрая стирка и глажка с индивидуальным подходом к каждому гостю и каждой вещи.'},
    {icon: 'car', title: 'Водитель и трансфер', text: 'Безопасные и комфортные поездки: встреча в аэропорту, короткие и дальние маршруты.'},
    {icon: 'wine', title: 'Бар и напитки', text: 'Коктейли, вина и безалкогольные напитки. Уютная атмосфера для вас и ваших гостей.'},
  ];

  /** Строка быстрого бронирования: даты передаются на страницу номеров. */
  checkIn = '';
  checkOut = '';
  readonly today = DateRangeUtil.today();
  dateError = '';

  rooms: RoomResponseType[] = [];
  testimonials: Testimonial[] = [];

  private readonly fallbackTestimonial: Testimonial = {
    author: 'Александр Васкес',
    text: 'После того, как строительный проект затянулся дольше, чем ожидалось, моему мужу, моей дочери и мне нужно было где остановиться на несколько ночей. Мы много знаем о нашем городе и типах доступных вариантов жилья и просто в восторге от нашего отпуска в отеле HotelMariot.'
  };

  constructor(private roomService: RoomService, private router: Router) { }

  /** Три номера для главной: сначала с фотографиями, затем дорогие (витрина выглядит лучше всего). */
  get featuredRooms(): RoomResponseType[] {
    const hasPhoto = (r: RoomResponseType) => (r.images?.length ?? 0) > 0 || !!r.photo;
    return [...this.rooms]
      .sort((a, b) => Number(hasPhoto(b)) - Number(hasPhoto(a)) || b.price - a.price)
      .slice(0, 3);
  }

  get minCheckOut(): string {
    return this.checkIn ? DateRangeUtil.addDays(this.checkIn, 1) : DateRangeUtil.addDays(this.today, 1);
  }

  ngOnInit(): void {
    this.timer = setInterval(() => this.heroIndex = (this.heroIndex + 1) % this.heroSlides.length, 6000);

    this.roomService.getRooms()
      .subscribe((data: RoomResponseType[]) => {
        this.rooms = data.map(item => {
          item.bedsTypeRus = BedsTypeUtil.getBedsType(item.beds).name;
          item.typeRus = HotelTypeUtil.getHotelType(item.type).name;
          return item;
        });
        this.testimonials = this.latestReviews(data);
      });
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  setSlide(i: number): void {
    this.heroIndex = i;
  }

  /** Три последних отзыва гостей по всем номерам; если отзывов ещё нет – прежний образец отзыва. */
  private latestReviews(rooms: RoomResponseType[]): Testimonial[] {
    const all = rooms.flatMap(room => (room.comments ?? []).map(c => ({c, room: room.name})));
    all.sort((a, b) => (b.c.createdAt ?? '').localeCompare(a.c.createdAt ?? ''));
    const list = all.slice(0, 3).map(x => ({author: x.c.author, text: x.c.text, room: x.room}));
    return list.length ? list : [this.fallbackTestimonial];
  }

  /** «Найти номер»: переход к списку номеров с выбранными датами. */
  search(): void {
    this.dateError = '';
    if (this.checkIn || this.checkOut) {
      if (!this.checkIn || !this.checkOut) {
        this.dateError = 'Укажите обе даты: заезда и выезда';
        return;
      }
      if (this.checkIn < this.today) {
        this.dateError = 'Дата заезда не может быть в прошлом';
        return;
      }
      if (this.checkOut <= this.checkIn) {
        this.dateError = 'Дата выезда должна быть позже даты заезда';
        return;
      }
      this.router.navigate(['/rooms'], {queryParams: {from: this.checkIn, to: this.checkOut}});
    } else {
      this.router.navigate(['/rooms']);
    }
  }

  initial(author: string): string {
    return (author ?? '?').trim().charAt(0).toUpperCase() || '?';
  }
}
