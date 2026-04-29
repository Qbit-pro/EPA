import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ToastController } from '@ionic/angular';
import {
  IonContent,
  IonIcon,
  IonSpinner
} from '@ionic/angular/standalone';
import { forkJoin } from 'rxjs';
import { ApiService } from 'src/app/services/api.service';
import { AuthSessionService } from 'src/app/services/auth-session.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  host: {
    class: 'ion-page'
  },
  imports: [
    CommonModule,
    IonContent,
    IonIcon,
    IonSpinner,
    RouterModule
  ]
})
export class HomePage {
  private readonly api = inject(ApiService);
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);

  isLoggedIn = false;
  userName = 'mate';
  userEmail = '';
  expenseCount = 0;
  purchaseCount = 0;
  isLoadingSummary = false;
  lastSync = 'Not synced';

  get totalRecords(): number {
    return this.expenseCount + this.purchaseCount;
  }

  ionViewWillEnter(): void {
    this.refreshSession();

    if (this.isLoggedIn) {
      this.loadSummary();
      return;
    }

    this.expenseCount = 0;
    this.purchaseCount = 0;
    this.lastSync = 'Sign in to sync';
  }

  goToExpense(): void {
    void this.router.navigate(['/expense']);
  }

  goToPurchase(): void {
    void this.router.navigate(['/purchase']);
  }

  refreshSummary(): void {
    if (!this.isLoggedIn) {
      void this.presentToast('Please sign in to sync records.', 'warning');
      void this.router.navigate(['/login']);
      return;
    }

    this.loadSummary();
  }

  private refreshSession(): void {
    const token = this.session.getToken();
    const user = this.session.getUser();

    this.isLoggedIn = Boolean(token);
    this.userName = user?.username || user?.email?.split('@')[0] || 'mate';
    this.userEmail = user?.email || '';
  }

  private loadSummary(): void {
    const token = this.session.getToken();

    if (!token) {
      void this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }

    this.isLoadingSummary = true;

    forkJoin({
      profile: this.api.getProfile(token),
      expenses: this.api.getExpenses(token),
      purchases: this.api.getPurchases(token)
    }).subscribe({
      next: ({ profile, expenses, purchases }) => {
        this.session.updateUser(profile.user);
        this.userName = profile.user.username || profile.user.email.split('@')[0];
        this.userEmail = profile.user.email;
        this.expenseCount = expenses.length;
        this.purchaseCount = purchases.length;
        this.lastSync = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });
        this.isLoadingSummary = false;
      },
      error: () => {
        this.isLoadingSummary = false;
        this.lastSync = 'Sync failed';
        void this.presentToast('Could not load your latest records.', 'danger');
      }
    });
  }

  private async presentToast(message: string, color: 'danger' | 'medium' | 'success' | 'warning'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      color,
      duration: 2200,
      position: 'bottom'
    });

    await toast.present();
  }
}
