import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { AuthSessionService } from './services/auth-session.service';

const SPLASH_STATUS_BAR_COLOR = '#0f172a';
const APP_STATUS_BAR_COLOR = '#f5f7fb';

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

  showSplash = true;
  splashLeaving = false;

  private initialRouteReady = false;
  private minimumSplashElapsed = false;
  private readonly routeEvents = new Subscription();
  private splashTimers: number[] = [];
  private appUrlOpenListener?: PluginListenerHandle;

  constructor() {
    this.watchInitialRoute();
    void this.watchNativeOAuthCallback();
    this.startSplashTimer();
    void this.prepareNativeChrome();
  }

  ngOnDestroy(): void {
    this.routeEvents.unsubscribe();
    this.splashTimers.forEach(timer => window.clearTimeout(timer));
    void this.appUrlOpenListener?.remove();
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

  private async watchNativeOAuthCallback(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    this.appUrlOpenListener = await App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.handleAppUrlOpen(event);
    });
  }

  private handleAppUrlOpen(event: URLOpenListenerEvent): void {
    const result = this.session.consumeOAuthUrl(event.url);

    if (!result) {
      return;
    }

    void Browser.close().catch(() => undefined);
    void this.router.navigate(['/']);
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
