import {RoomResponseType} from "../../../types/room-response.type";

declare var $: any;
import { AfterViewInit, Component, ElementRef, OnInit, Renderer2 } from '@angular/core';
import 'owl.carousel';
import {RoomService} from "../../shared/services/room.service";
import {BedsTypeUtil} from "../../shared/utils/beds-type.util";
import {HotelTypeUtil} from "../../shared/utils/hotel-type.util";

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit, AfterViewInit {

  rooms: RoomResponseType[] = [];

  constructor(private renderer: Renderer2, private el: ElementRef,
              private roomService: RoomService) { }

  ngOnInit(): void {
    const elements = this.el.nativeElement.querySelectorAll('.set-bg');
    elements.forEach((element: HTMLElement) => {
      const bg = element.getAttribute('data-setbg');
      if (bg) {
        this.renderer.setStyle(element, 'background-image', `url(${bg})`);
      }
    });

    this.roomService.getRooms()
      .subscribe((data: RoomResponseType[]) => {
        this.rooms = data;

        this.rooms = data.map(item => {
          const bedType = BedsTypeUtil.getBedsType(item.beds);
          const hotelType = HotelTypeUtil.getHotelType(item.type);

          item.bedsTypeRus = bedType.name;
          item.typeRus = hotelType.name;
          return item;
        });
      })
  }

  ngAfterViewInit() {
    if (typeof $ === 'undefined') {
      console.error("jQuery is not loaded!");
      return;
    }

    const heroSlider = $(this.el.nativeElement).find('.hero-slider');

    if (heroSlider.length) {
      heroSlider.owlCarousel({
        loop: true,
        margin: 0,
        items: 1,
        dots: true,
        animateOut: 'fadeOut',
        animateIn: 'fadeIn',
        smartSpeed: 1200,
        autoHeight: false,
        autoplay: true,
        mouseDrag: false
      });
    } else {
      console.error("Owl Carousel element not found!");
    }

    const testimonialSlider = $(this.el.nativeElement).find('.testimonial-slider');

    if (testimonialSlider.length) {
      testimonialSlider.owlCarousel({
        items: 1,
        dots: false,
        autoplay: true,
        loop: true,
        smartSpeed: 1200,
        nav: true,
        navText: ["<i class='arrow_left'></i>", "<i class='arrow_right'></i>"]
      });
    } else {
      console.error("Owl Carousel element not found!");
    }

    $('select').niceSelect();
  }

}
