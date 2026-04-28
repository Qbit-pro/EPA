import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ToastController } from '@ionic/angular';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { forkJoin } from 'rxjs';
import {
  ApiService,
  ExpenseRecord,
  PurchaseRecord
} from 'src/app/services/api.service';
import { AuthSessionService } from 'src/app/services/auth-session.service';

type HistoryType = 'expense' | 'purchase';

interface HistoryItem {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  type: HistoryType;
}

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
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonTitle,
    IonToolbar,
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
  driveConnected = false;
  expenseCount = 0;
  purchaseCount = 0;
  isLoadingSummary = false;
  lastSync = 'Not synced';
  historyItems: HistoryItem[] = [];

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
    this.historyItems = [];
  }

  goToExpense(): void {
    void this.router.navigate(['/expense']);
  }

  goToPurchase(): void {
    void this.router.navigate(['/purchase']);
  }

  goToLogin(): void {
    void this.router.navigate(['/login']);
  }

  handleSessionAction(): void {
    void this.logout();
  }

  openHistoryItem(item: HistoryItem): void {
    if (item.type === 'expense') {
      void this.router.navigate(['/expense']);
      return;
    }

    void this.router.navigate(['/purchase']);
  }

  async logout(): Promise<void> {
    await this.session.logout();
    this.refreshSession();
    this.expenseCount = 0;
    this.purchaseCount = 0;
    this.lastSync = 'Signed out';
    this.historyItems = [];
    await this.presentToast('Signed out successfully.', 'medium');
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
    this.driveConnected = Boolean(user?.googleDriveConnected);
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
        this.driveConnected = Boolean(profile.user.googleDriveConnected);
        this.expenseCount = expenses.length;
        this.purchaseCount = purchases.length;
        this.historyItems = this.buildHistory(expenses, purchases);
        this.lastSync = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });
        this.isLoadingSummary = false;
      },
      error: () => {
        this.isLoadingSummary = false;
        this.lastSync = 'Sync failed';
        this.historyItems = [];
        void this.presentToast('Could not load your latest records.', 'danger');
      }
    });
  }

  trackByHistoryId(_index: number, item: HistoryItem): string {
    return item.id;
  }

  private buildHistory(expenses: ExpenseRecord[], purchases: PurchaseRecord[]): HistoryItem[] {
    const expenseItems = expenses.map(expense => ({
      id: `expense-${expense._id}`,
      title: expense.title,
      subtitle: expense.description || 'Expense record',
      date: expense.createdAt || expense.date,
      type: 'expense' as HistoryType
    }));

    const purchaseItems = purchases.map(purchase => ({
      id: `purchase-${purchase._id}`,
      title: purchase.title,
      subtitle: `Paid by ${purchase.paidBy === 'self' ? 'Self' : 'Company'}`,
      date: purchase.createdAt || purchase.date,
      type: 'purchase' as HistoryType
    }));

    return [...expenseItems, ...purchaseItems]
      .sort((first, second) => this.parseDate(second.date) - this.parseDate(first.date))
      .slice(0, 8);
  }

  private parseDate(value: string): number {
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
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
