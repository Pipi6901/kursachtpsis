import {TestBed} from '@angular/core/testing';
import {Router, UrlTree} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {MatSnackBar} from '@angular/material/snack-bar';
import {AuthService} from './auth.service';
import {StaffGuard} from './staff.guard';

describe('StaffGuard', () => {
  function create(isAdmin: boolean, isManager: boolean) {
    const snackBar = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        {provide: AuthService, useValue: {getIsAdminIn: () => isAdmin, getIsManagerIn: () => isManager}},
        {provide: MatSnackBar, useValue: snackBar}
      ]
    });
    return {guard: TestBed.inject(StaffGuard), snackBar, router: TestBed.inject(Router)};
  }

  it('пропускает администратора и менеджера', () => {
    expect(create(true, false).guard.canActivate()).toBeTrue();
    TestBed.resetTestingModule();
    expect(create(false, true).guard.canActivate()).toBeTrue();
  });

  it('обычного пользователя возвращает на главную и сообщает о причине', () => {
    const {guard, snackBar, router} = create(false, false);
    const result = guard.canActivate();
    expect(result instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(result as UrlTree)).toBe('/');
    expect(snackBar.open).toHaveBeenCalled();
  });
});
