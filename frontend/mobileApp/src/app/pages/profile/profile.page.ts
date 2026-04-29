import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, inject } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Browser } from '@capacitor/browser';
import { ToastController } from '@ionic/angular';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSpinner
} from '@ionic/angular/standalone';
import { Subscription, forkJoin } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ApiService, ExpenseRecord, PurchaseRecord } from 'src/app/services/api.service';
import { AuthSessionService } from 'src/app/services/auth-session.service';

type HistoryFilter = 'all' | 'expense' | 'purchase';
type HistoryType = 'expense' | 'purchase';
type ToastColor = 'danger' | 'medium' | 'success' | 'warning';

interface HistoryItem {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  type: HistoryType;
  imageUrl?: string;
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  host: {
    class: 'ion-page'
  },
  imports: [
    CommonModule,
    IonButton,
    IonContent,
    IonIcon,
    IonLabel,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    RouterModule
  ]
})
export class ProfilePage implements OnDestroy {
  private readonly historyPageSize = 5;
  private readonly api = inject(ApiService);
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly routeEvents = new Subscription();

  isLoading = false;
  userName = 'mate';
  userEmail = '';
  expenseCount = 0;
  purchaseCount = 0;
  lastSync = 'Not synced';
  historyFilter: HistoryFilter = 'all';
  historyPage = 1;
  historyItems: HistoryItem[] = [];
  visibleHistoryItems: HistoryItem[] = [];
  filteredHistoryCount = 0;

  constructor() {
    this.routeEvents.add(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd)
      ).subscribe(event => {
        if (event.urlAfterRedirects.split('?')[0] === '/tabs/profile') {
          this.loadProfile();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.routeEvents.unsubscribe();
  }

  get totalRecords(): number {
    return this.expenseCount + this.purchaseCount;
  }

  get avatarInitials(): string {
    const source = this.userName || this.userEmail;
    const parts = source.trim().split(/\s+/).filter(Boolean);

    if (!parts.length) {
      return 'EM';
    }

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }

  get filteredHistoryItems(): HistoryItem[] {
    return this.historyFilter === 'all'
      ? this.historyItems
      : this.historyItems.filter(item => item.type === this.historyFilter);
  }

  get totalHistoryPages(): number {
    return Math.max(1, Math.ceil(this.filteredHistoryCount / this.historyPageSize));
  }

  get historyPageTabs(): string[] {
    return Array.from({ length: this.totalHistoryPages }, (_item, index) => String(index + 1));
  }

  get historyPageValue(): string {
    return String(this.historyPage);
  }

  ionViewWillEnter(): void {
    this.loadProfile();
  }

  setHistoryFilter(value: string | undefined): void {
    if (value === 'all' || value === 'expense' || value === 'purchase') {
      this.historyFilter = value;
      this.historyPage = 1;
      this.refreshHistoryView();
    }
  }

  setHistoryPage(value: string | undefined): void {
    const parsed = Number(value);

    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= this.totalHistoryPages) {
      this.historyPage = parsed;
      this.refreshHistoryView();
    }
  }

  trackByHistoryId(_index: number, item: HistoryItem): string {
    return `${item.type}-${item.id}`;
  }

  async logout(): Promise<void> {
    await this.session.logout();
  }

  async openHistoryReceipt(item: HistoryItem): Promise<void> {
    if (!item.imageUrl) {
      await this.presentToast('No receipt image is attached to this record.', 'medium');
      return;
    }

    await Browser.open({ url: item.imageUrl });
  }

  private loadProfile(): void {
    const token = this.session.getToken();
    const user = this.session.getUser();

    this.userName = user?.username || user?.email?.split('@')[0] || 'mate';
    this.userEmail = user?.email || '';

    if (!token) {
      void this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }

    this.isLoading = true;

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
        this.historyItems = this.buildHistory(expenses, purchases);
        this.historyPage = 1;
        this.refreshHistoryView();
        this.lastSync = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.lastSync = 'Sync failed';
        void this.presentToast('Could not load your profile details.', 'danger');
      }
    });
  }

  private refreshHistoryView(): void {
    const filteredItems = this.filteredHistoryItems;
    const pageCount = Math.max(1, Math.ceil(filteredItems.length / this.historyPageSize));

    this.filteredHistoryCount = filteredItems.length;
    this.historyPage = Math.min(Math.max(this.historyPage, 1), pageCount);

    const startIndex = (this.historyPage - 1) * this.historyPageSize;
    this.visibleHistoryItems = filteredItems.slice(startIndex, startIndex + this.historyPageSize);
    this.changeDetector.detectChanges();
  }

  private buildHistory(expenses: ExpenseRecord[], purchases: PurchaseRecord[]): HistoryItem[] {
    const expenseHistory: HistoryItem[] = expenses.map(record => ({
      id: record._id,
      title: record.title,
      subtitle: record.description || 'Expense record',
      date: record.createdAt || record.date,
      type: 'expense',
      imageUrl: record.imageUrl
    }));

    const purchaseHistory: HistoryItem[] = purchases.map(record => ({
      id: record._id,
      title: record.title,
      subtitle: `Paid by ${record.paidBy}`,
      date: record.createdAt || record.date,
      type: 'purchase',
      imageUrl: record.imageUrl
    }));

    return [...expenseHistory, ...purchaseHistory].sort((left, right) => {
      return this.parseDate(right.date) - this.parseDate(left.date);
    });
  }

  private parseDate(value: string): number {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private async presentToast(message: string, color: ToastColor): Promise<void> {
    const toast = await this.toastController.create({
      message,
      color,
      duration: 2200,
      position: 'bottom'
    });

    await toast.present();
  }
}
