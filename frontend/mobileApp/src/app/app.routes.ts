import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./tabs/tabs.page').then(m => m.TabsPage),
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      },
      {
        path: 'home',
        loadComponent: () =>
          import('./pages/home/home.page').then(m => m.HomePage)
      },
      {
        path: 'expense',
        loadComponent: () =>
          import('./pages/expense/expense.page').then(m => m.ExpensePage)
      },
      {
        path: 'purchase',
        loadComponent: () =>
          import('./pages/purchase/purchase.page').then(m => m.PurchasePage)
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.page').then(m => m.ProfilePage)
      }
    ]
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'home',
    redirectTo: '/tabs/home',
    pathMatch: 'full'
  },
  {
    path: 'expense',
    redirectTo: '/tabs/expense',
    pathMatch: 'full'
  },
  {
    path: 'purchase',
    redirectTo: '/tabs/purchase',
    pathMatch: 'full'
  },
  {
    path: 'profile',
    redirectTo: '/tabs/profile',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/login'
  }
];
