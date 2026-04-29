import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LoadingController, ToastController } from '@ionic/angular';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput
} from '@ionic/angular/standalone';
import { finalize } from 'rxjs';
import { ApiService, AuthPayload } from 'src/app/services/api.service';
import { AuthSessionService } from 'src/app/services/auth-session.service';

type ToastColor = 'danger' | 'medium' | 'success' | 'warning';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  host: {
    class: 'ion-page'
  },
  imports: [
    CommonModule,
    FormsModule,
    IonButton,
    IonContent,
    IonIcon,
    IonInput,
    RouterModule
  ]
})
export class LoginPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly loadingController = inject(LoadingController);
  private readonly toastController = inject(ToastController);

  isSubmitting = false;
  isTestingServer = false;
  apiBaseUrl = '';
  currentApiBaseUrl = '';

  authData = {
    email: '',
    password: ''
  };

  ngOnInit(): void {
    this.refreshApiServerState();

    if (this.session.isLoggedIn()) {
      void this.router.navigate(['/tabs/home'], { replaceUrl: true });
      return;
    }

    this.route.queryParamMap.subscribe(params => {
      const token = params.get('token');
      const user = params.get('user');
      const source = params.get('source');
      const oauthMode = params.get('mode');

      if (source !== 'google') {
        return;
      }

      this.consumeGoogleSession(token, user, source, oauthMode);
    });
  }

  async submitAuth(isValid: boolean | null): Promise<void> {
    if (!isValid) {
      await this.presentToast('Fill the required details first.', 'warning');
      return;
    }

    const payload: AuthPayload = {
      email: this.authData.email.trim().toLowerCase(),
      password: this.authData.password
    };

    const loading = await this.loadingController.create({
      message: 'Signing in...',
      spinner: 'crescent'
    });

    this.isSubmitting = true;
    await loading.present();

    const request = this.api.login(payload);

    request.pipe(
      finalize(() => {
        this.isSubmitting = false;
        void loading.dismiss();
      })
    ).subscribe({
      next: response => {
        this.session.persist(response);
        void this.presentToast('Welcome back.', 'success');
        void this.router.navigate(['/tabs/home'], { replaceUrl: true });
      },
      error: error => {
        const message = error?.error?.message || error?.error?.error || 'Authentication failed.';
        void this.presentToast(message, 'danger');
      }
    });
  }

  async startGoogleSignIn(): Promise<void> {
    await this.session.startGoogleAuth('signin');
  }

  async saveServerUrl(): Promise<void> {
    try {
      const savedUrl = this.api.setBaseUrl(this.apiBaseUrl);
      this.currentApiBaseUrl = savedUrl;
      this.apiBaseUrl = savedUrl;
      await this.presentToast('Server URL saved.', 'success');
    } catch (error) {
      await this.presentToast(String((error as Error)?.message || 'Could not save server URL.'), 'warning');
    }
  }

  async resetServerUrl(): Promise<void> {
    this.api.clearBaseUrl();
    this.refreshApiServerState();
    await this.presentToast('Server URL reset.', 'medium');
  }

  async testServerUrl(): Promise<void> {
    try {
      this.apiBaseUrl = this.api.setBaseUrl(this.apiBaseUrl);
      this.currentApiBaseUrl = this.apiBaseUrl;
    } catch (error) {
      await this.presentToast(String((error as Error)?.message || 'Check the server URL.'), 'warning');
      return;
    }

    this.isTestingServer = true;

    try {
      const reachable = await this.api.isReachable();
      await this.presentToast(
        reachable ? 'Backend server is reachable.' : 'Backend server did not respond.',
        reachable ? 'success' : 'danger'
      );
    } finally {
      this.isTestingServer = false;
    }
  }

  private consumeGoogleSession(
    token: string | null,
    user: string | null,
    source: string | null,
    oauthMode: string | null
  ): void {
    const result = this.session.consumeOAuthResponse(token, user, source, oauthMode);

    if (result) {
      void this.presentToast(
        result.mode === 'connect' ? 'Google Drive connected.' : 'Signed in with Google.',
        'success'
      );
      void this.router.navigate(['/tabs/home'], { replaceUrl: true });
      return;
    }

    void this.presentToast('Google sign-in could not be completed.', 'danger');
  }

  private refreshApiServerState(): void {
    this.currentApiBaseUrl = this.api.getBaseUrl();
    this.apiBaseUrl = this.currentApiBaseUrl;
  }

  private async presentToast(message: string, color: ToastColor): Promise<void> {
    const toast = await this.toastController.create({
      message,
      color,
      duration: 2400,
      position: 'bottom'
    });

    await toast.present();
  }
}
