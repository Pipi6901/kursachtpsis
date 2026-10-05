import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {StatService} from "../../../shared/services/stat.service";
import {StatAllResponseType} from "../../../../types/stat-all-response.type";
import html2pdf from "html2pdf.js";

declare var google: any;

@Component({
  selector: 'app-stat-financial',
  templateUrl: './stat-financial.component.html',
  styleUrls: ['./stat-financial.component.scss']
})
export class StatFinancialComponent implements OnInit {

  @ViewChild('generatePdf') pdfContent!: ElementRef;
  statistics!: StatAllResponseType;

  constructor(private statService: StatService) { }

  ngOnInit(): void {
    this.statService.getStat()
      .subscribe((data: StatAllResponseType) => {
        this.statistics = data;
        this.loadGoogleCharts();
      });
  }

  loadGoogleCharts(): void {
    google.charts.load('current', { packages: ['corechart'] });
    google.charts.setOnLoadCallback(() => {
      this.drawTop5IncomeChart();
    });
  }

  drawTop5IncomeChart(): void {
    if (!this.statistics || !this.statistics.topRoomsByIncome) return;

    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Название');
    data.addColumn('number', 'Прибыль');

    this.statistics.topRoomsByIncome.forEach(room => {
      data.addRow([room.roomName, room.income]);
    });

    const options = { title: 'ТОП-5 по прибыли', width: 600, height: 400 };
    const chart = new google.visualization.ColumnChart(document.getElementById('top5Income'));
    chart.draw(data, options);
  }

  generatePDF(): void {
    const element = this.pdfContent.nativeElement;

    html2pdf()
      .from(element)
      .save('stat.pdf');
  }
}
