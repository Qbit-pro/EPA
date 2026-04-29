import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { ToastController } from '@ionic/angular';
import { catchError, firstValueFrom, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ApiService, AuthResponse, UserProfile } from './api.service';

export type OAuthMode = 'signin' | 'connect';

export interface OAuthSessionResult {
  mode: OAuthMode;
  user: UserProfile;
}

@Injectable({
  providedIn: 'root'
})
export class AuthSessionService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  private readonly tokenKey = 'token';
  private readonly userKey = 'auth_user';

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUser(): UserProfile | null {
    const rawUser = localStorage.getItem(this.userKey);

    if (!rawUser) {
      return null;
    }

    try {
      return JSON.parse(rawUser) as UserProfile;
    } catch {
      localStorage.removeItem(this.userKey);
      return null;
    }
  }

  isLoggedIn(): boolean {
    return Boolean(this.getToken());
  }

  hasGoogleDrive(): boolean {
    return Boolean(this.getUser()?.googleDriveConnected);
  }

  persist(response: AuthResponse): void {
    localStorage.setItem(this.tokenKey, response.token);
    localStorage.setItem(this.userKey, JSON.stringify(response.user));
  }

  updateUser(user: UserProfile): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  clear(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  async logout(): Promise<void> {
    await this.endSession(true);
  }

  async endSession(navigateToLogin = false): Promise<void> {
    const token = this.getToken();

    if (token) {
      await firstValueFrom(
        this.api.logout(token).pipe(
          catchError(() => of(null))
        )
      );
    }

    this.clear();

    if (navigateToLogin) {
      await this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  async startGoogleAuth(mode: OAuthMode): Promise<void> {
    const token = mode === 'connect' ? this.getToken() : undefined;

    if (mode === 'connect' && !token) {
      await this.router.navigate(['/login']);
      return;
    }

    if (!Capacitor.isNativePlatform()) {
      const isApiAvailable = await this.checkApiAvailability();

      if (!isApiAvailable) {
        await this.presentToast('Backend server could not be confirmed from the app. Check the server URL and make sure the tunnel is still running.', 'warning');
        return;
      }
    }

    const url = this.api.googleAuthUrl(this.redirectUrl(), token || undefined);

    if (Capacitor.isNativePlatform()) {
      await Browser.open({
        url,
        presentationStyle: 'fullscreen'
      });
      return;
    }

    window.location.assign(url);
  }

  consumeOAuthResponse(
    token: string | null,
    user: string | null,
    source: string | null,
    mode: string | null
  ): OAuthSessionResult | null {
    if (!token || !user || source !== 'google') {
      return null;
    }

    try {
      const parsedUser = JSON.parse(user) as UserProfile;
      this.persist({
        token,
        user: parsedUser
      });

      return {
        mode: mode === 'connect' ? 'connect' : 'signin',
        user: parsedUser
      };
    } catch {
      return null;
    }
  }

  consumeOAuthUrl(value: string): OAuthSessionResult | null {
    try {
      const url = new URL(value);
      return this.consumeOAuthResponse(
        url.searchParams.get('token'),
        url.searchParams.get('user'),
        url.searchParams.get('source'),
        url.searchParams.get('mode')
      );
    } catch {
      return null;
    }
  }

  private redirectUrl(): string {
    if (Capacitor.isNativePlatform()) {
      return environment.mobileRedirectUrl;
    }

    return `${window.location.origin}/login`;
  }

  private async checkApiAvailability(): Promise<boolean> {
    return this.api.isReachable();
  }

  private async presentToast(message: string, color: 'danger' | 'medium' | 'success' | 'warning'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      color,
      duration: 2600,
      position: 'bottom'
    });

    await toast.present();
  }
}
