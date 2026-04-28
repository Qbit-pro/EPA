import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { App, BackButtonListenerEvent, URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { ToastController } from '@ionic/angular';
import { StatusBar, Style } from '@capacitor/status-bar';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { AuthSessionService } from './services/auth-session.service';

const SPLASH_STATUS_BAR_COLOR = '#0f172a';
const APP_STATUS_BAR_COLOR = '#f5f7fb';
const HOME_TAB_URL = '/tabs/home';
const TABS_ROUTE_PREFIX = '/tabs/';
const EXIT_CONFIRMATION_WINDOW_MS = 2000;

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [CommonModule, IonApp, IonRouterOutlet]
})
export class AppComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly session = inject(AuthSessionService);
  private readonly toastController = inject(ToastController);

  showSplash = true;
  splashLeaving = false;

  private initialRouteReady = false;
  private minimumSplashElapsed = false;
  private readonly routeEvents = new Subscription();
  private splashTimers: number[] = [];
  private appUrlOpenListener?: PluginListenerHandle;
  private backButtonListener?: PluginListenerHandle;
  private lastHandledOAuthUrl = '';
  private tabHistory: string[] = [];
  private isNavigatingBackThroughTabs = false;
  private exitToast?: HTMLIonToastElement;
  private lastExitAttemptAt = 0;

  constructor() {
    this.watchInitialRoute();
    this.watchTabHistory();
    void this.watchNativeOAuthCallback();
    void this.watchNativeBackButton();
    this.startSplashTimer();
    void this.prepareNativeChrome();
  }

  ngOnDestroy(): void {
    this.routeEvents.unsubscribe();
    this.splashTimers.forEach(timer => window.clearTimeout(timer));
    void this.appUrlOpenListener?.remove();
    void this.backButtonListener?.remove();
    void this.exitToast?.dismiss();
  }

  private watchInitialRoute(): void {
    this.routeEvents.add(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        take(1)
      ).subscribe(() => {
        this.initialRouteReady = true;
        window.requestAnimationFrame(() => this.beginSplashExit());
      })
    );
  }

  private startSplashTimer(): void {
    this.splashTimers.push(
      window.setTimeout(() => {
        this.minimumSplashElapsed = true;
        this.beginSplashExit();
      }, 3000)
    );
  }

  private watchTabHistory(): void {
    this.routeEvents.add(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd)
      ).subscribe(event => {
        this.recordTabVisit(event.urlAfterRedirects);
      })
    );
  }

  private async watchNativeOAuthCallback(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const launchUrl = await App.getLaunchUrl();

    if (launchUrl?.url) {
      this.handleIncomingOAuthUrl(launchUrl.url);
    }

    this.appUrlOpenListener = await App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.handleAppUrlOpen(event);
    });
  }

  private async watchNativeBackButton(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    this.backButtonListener = await App.addListener('backButton', (event: BackButtonListenerEvent) => {
      this.handleNativeBackButton(event);
    });
  }

  private handleAppUrlOpen(event: URLOpenListenerEvent): void {
    this.handleIncomingOAuthUrl(event.url);
  }

  private handleIncomingOAuthUrl(url: string): void {
    if (!url || this.lastHandledOAuthUrl === url) {
      return;
    }

    this.lastHandledOAuthUrl = url;
    const result = this.session.consumeOAuthUrl(url);

    if (!result) {
      return;
    }

    void Browser.close().catch(() => undefined);
    void this.router.navigate(['/tabs/home'], { replaceUrl: true });
  }

  private handleNativeBackButton(event: BackButtonListenerEvent): void {
    const currentUrl = this.normalizeRoute(this.router.url);

    if (currentUrl.startsWith(TABS_ROUTE_PREFIX)) {
      if (this.tabHistory.length > 1) {
        this.tabHistory.pop();
        const previousTab = this.tabHistory[this.tabHistory.length - 1] || HOME_TAB_URL;
        this.navigateBackToTab(previousTab);
        return;
      }

      if (currentUrl !== HOME_TAB_URL) {
        this.tabHistory = [HOME_TAB_URL];
        this.navigateBackToTab(HOME_TAB_URL);
        return;
      }

      void this.confirmExit();
      return;
    }

    if (currentUrl === '/login') {
      void this.confirmExit();
      return;
    }

    if (event.canGoBack) {
      window.history.back();
      return;
    }

    void this.confirmExit();
  }

  private navigateBackToTab(url: string): void {
    this.isNavigatingBackThroughTabs = true;
    void this.router.navigateByUrl(url, { replaceUrl: true });
  }

  private recordTabVisit(url: string): void {
    const normalizedUrl = this.normalizeRoute(url);

    if (!normalizedUrl.startsWith(TABS_ROUTE_PREFIX)) {
      if (normalizedUrl === '/login' || normalizedUrl === '/') {
        this.tabHistory = [];
      }

      return;
    }

    if (this.isNavigatingBackThroughTabs) {
      this.isNavigatingBackThroughTabs = false;
      return;
    }

    const lastVisitedTab = this.tabHistory[this.tabHistory.length - 1];

    if (lastVisitedTab === normalizedUrl) {
      return;
    }

    this.tabHistory.push(normalizedUrl);
  }

  private normalizeRoute(url: string): string {
    const [pathOnly = '/'] = url.split('?');
    const normalized = pathOnly.replace(/\/+$/, '');
    return normalized || '/';
  }

  private async confirmExit(): Promise<void> {
    const now = Date.now();

    if (now - this.lastExitAttemptAt <= EXIT_CONFIRMATION_WINDOW_MS) {
      await this.dismissExitToast();
      await this.session.endSession();
      await App.exitApp().catch(() => undefined);
      return;
    }

    this.lastExitAttemptAt = now;
    await this.presentExitToast();
  }

  private async presentExitToast(): Promise<void> {
    await this.dismissExitToast();

    this.exitToast = await this.toastController.create({
      message: 'Press back once more to exit the app.',
      duration: EXIT_CONFIRMATION_WINDOW_MS,
      position: 'bottom',
      color: 'dark'
    });

    this.exitToast.onDidDismiss().then(() => {
      this.exitToast = undefined;
    });

    await this.exitToast.present();
  }

  private async dismissExitToast(): Promise<void> {
    if (!this.exitToast) {
      return;
    }

    const activeToast = this.exitToast;
    this.exitToast = undefined;
    await activeToast.dismiss().catch(() => undefined);
  }

  private beginSplashExit(): void {
    if (!this.showSplash || this.splashLeaving || !this.initialRouteReady || !this.minimumSplashElapsed) {
      return;
    }

    this.splashLeaving = true;
    this.splashTimers.push(
      window.setTimeout(() => {
        this.showSplash = false;
        void this.setStatusBarForApp();
      }, 420)
    );
  }

  private async prepareNativeChrome(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: SPLASH_STATUS_BAR_COLOR });
    } catch {
      // Native chrome setup is unavailable in the web preview.
    }
  }

  private async setStatusBarForApp(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: APP_STATUS_BAR_COLOR });
    } catch {
      // Native chrome setup is unavailable in the web preview.
    }
  }
}
