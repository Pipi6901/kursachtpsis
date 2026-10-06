// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import 'zone.js/testing';
import { provideZoneChangeDetection } from '@angular/core';
import { TestBed, getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);

// Как и приложение (main.ts), тесты работают на проверке изменений через zone.js:
// начиная с Angular 21 без этого TestBed переходит в режим без zone.js.
beforeEach(() => TestBed.configureTestingModule({ providers: [provideZoneChangeDetection()] }));
