import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonTitle,
  IonToolbar
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
    IonHeader,
    IonIcon,
    IonInput,
    IonTitle,
    IonToolbar,
    RouterModule
  ]
})
export class LoginPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly alertController = inject(AlertController);
  private readonly loadingController = inject(LoadingController);
  private readonly toastController = inject(ToastController);

  isSubmitting = false;
  currentServerUrl = '';

  authData = {
    email: '',
    password: ''
  };

  ngOnInit(): void {
    if (this.session.isLoggedIn()) {
      void this.router.navigate(['/tabs/home'], { replaceUrl: true });
      return;
    }

    this.syncCurrentServerUrl();

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

  async manageServer(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'API server',
      message: 'Use your laptop Wi-Fi IP with port 5000 when testing on a phone.',
      inputs: [
        {
          name: 'serverUrl',
          type: 'url',
          value: this.currentServerUrl,
          placeholder: 'http://192.168.1.20:5000/api'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Default',
          handler: () => {
            this.currentServerUrl = this.api.clearBaseUrl();
            void this.presentToast('Server reset to the default app address.', 'medium');
          }
        },
        {
          text: 'Save',
          handler: data => {
            try {
              this.currentServerUrl = this.api.setBaseUrl(String(data?.serverUrl ?? ''));
            } catch {
              void this.presentToast('Enter a valid server URL first.', 'warning');
              return false;
            }

            void this.presentToast('Server saved. The app will use this address for sign-in and sync.', 'success');
            return true;
          }
        }
      ]
    });

    await alert.present();
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

  private async presentToast(message: string, color: ToastColor): Promise<void> {
    const toast = await this.toastController.create({
      message,
      color,
      duration: 2400,
      position: 'bottom'
    });

    await toast.present();
  }

  private syncCurrentServerUrl(): void {
    this.currentServerUrl = this.api.getBaseUrl();
  }
}
