import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'tabs/home',
    pathMatch: 'full'
  },
  {
    path: 'tabs',
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
        path: 'login',
        loadComponent: () =>
          import('./pages/login/login.page').then(m => m.LoginPage)
      }
    ]
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
    path: 'login',
    redirectTo: '/tabs/login',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/tabs/home'
  }
];
