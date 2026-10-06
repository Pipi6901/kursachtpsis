import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {ReservationService} from "../../../shared/services/reservation.service";
import {ReceiptResponseType} from "../../../../types/receipt-response.type";
import {ActivatedRoute} from "@angular/router";
import html2pdf from "html2pdf.js";

@Component({
    selector: 'app-receipt',
    templateUrl: './receipt.component.html',
    styleUrls: ['./receipt.component.scss'],
    standalone: false
})
export class ReceiptComponent implements OnInit {

  @ViewChild('generatePdf') pdfContent!: ElementRef;

  receipt: ReceiptResponseType;

  constructor(private reservationService: ReservationService,
              private activatedRoute: ActivatedRoute) {
    this.receipt = {
      id: '',
      userName: '',
      roomName: '',
      days: 0,
      totalAmount: 0,
      createdAt: '',
      status: ''
    }
  }

  ngOnInit(): void {
    this.activatedRoute.params.subscribe(params => {
      this.reservationService.getReceipts(params['id'])
        .subscribe((data: ReceiptResponseType) => {
          this.receipt = data;
        })
    });
  }

  generatePDF(): void {
    const element = this.pdfContent.nativeElement;

    html2pdf()
      .from(element)
      .save('receipt.pdf');
  }
}
