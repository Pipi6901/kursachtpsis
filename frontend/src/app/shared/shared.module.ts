import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {RouterModule} from "@angular/router";
import { LoaderComponent } from './components/loader/loader.component';
import { DateRangePickerComponent } from './components/date-range-picker/date-range-picker.component';
import { PhoneMaskDirective } from './directives/phone-mask.directive';
import { IconComponent } from './components/icon/icon.component';
import { RoomCardComponent } from './components/room-card/room-card.component';
import { RoomGalleryComponent } from './components/room-gallery/room-gallery.component';
import { AmenityListComponent } from './components/amenity-list/amenity-list.component';
import { AmenityPickerComponent } from './components/amenity-picker/amenity-picker.component';
import { RoomPhotosEditorComponent } from './components/room-photos-editor/room-photos-editor.component';
import { RangeSliderComponent } from './components/range-slider/range-slider.component';
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";

@NgModule({
  declarations: [
    IconComponent,
    RoomCardComponent,
    RoomGalleryComponent,
    AmenityListComponent,
    AmenityPickerComponent,
    RoomPhotosEditorComponent,
    RangeSliderComponent,
    LoaderComponent,
    DateRangePickerComponent,
    PhoneMaskDirective
  ],
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    RouterModule
  ],
  exports: [
    IconComponent,
    RoomCardComponent,
    RoomGalleryComponent,
    AmenityListComponent,
    AmenityPickerComponent,
    RoomPhotosEditorComponent,
    RangeSliderComponent,
    LoaderComponent,
    DateRangePickerComponent,
    PhoneMaskDirective
  ]
})
export class SharedModule { }
