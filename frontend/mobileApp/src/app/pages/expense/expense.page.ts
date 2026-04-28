import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Browser } from '@capacitor/browser';
import {
  Camera,
  CameraDirection,
  CameraResultType,
  CameraSource,
  Photo
} from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonModal,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { finalize, Observable } from 'rxjs';
import { ApiService, ExpensePayload, ExpenseRecord } from 'src/app/services/api.service';
import { AuthSessionService } from 'src/app/services/auth-session.service';

type ToastColor = 'danger' | 'medium' | 'success' | 'warning';

@Component({
  selector: 'app-expense',
  templateUrl: './expense.page.html',
  styleUrls: ['./expense.page.scss'],
  standalone: true,
  host: {
    class: 'ion-page'
  },
  imports: [
    CommonModule,
    FormsModule,
    IonButton,
    IonButtons,
    IonContent,
    IonDatetime,
    IonFooter,
    IonHeader,
    IonIcon,
    IonInput,
    IonModal,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToolbar,
    RouterModule
  ]
})
export class ExpensePage implements OnDestroy {
  @ViewChild('webCameraVideo') private webCameraVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('webCameraCanvas') private webCameraCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('receiptFileInput') private receiptFileInput?: ElementRef<HTMLInputElement>;

  private readonly api = inject(ApiService);
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly alertController = inject(AlertController);
  private readonly loadingController = inject(LoadingController);
  private readonly toastController = inject(ToastController);

  expenseData: ExpensePayload = {
    title: '',
    description: '',
    date: this.today()
  };

  imageFile: File | null = null;
  imagePreview = '';
  records: ExpenseRecord[] = [];
  isSubmitting = false;
  isLoadingRecords = false;
  readonly isNativePlatform = Capacitor.isNativePlatform();
  driveConnected = false;
  deletingId = '';
  isDatePickerOpen = false;
  isWebCameraOpen = false;
  isWebCameraStarting = false;
  webCameraError = '';
  private previewObjectUrl = '';
  private webCameraStream: MediaStream | null = null;
  private readonly dateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  get receiptName(): string {
    return this.imageFile?.name || 'No receipt selected';
  }

  get hasImagePreview(): boolean {
    return Boolean(this.imagePreview);
  }

  get formattedSelectedDate(): string {
    return this.formatDisplayDate(this.expenseData.date);
  }

  ngOnDestroy(): void {
    this.stopWebCameraStream();
  }

  ionViewWillEnter(): void {
    this.refreshAccount();
    this.loadRecords();
  }

  async takePhoto(): Promise<void> {
    if (!this.isNativePlatform) {
      await this.openWebCamera();
      return;
    }

    await this.captureReceipt();
  }

  openFilePicker(): void {
    this.receiptFileInput?.nativeElement.click();
  }

  openDatePicker(): void {
    this.isDatePickerOpen = true;
  }

  closeDatePicker(): void {
    this.isDatePickerOpen = false;
  }

  clearReceipt(): void {
    this.releasePreviewUrl();
    this.imageFile = null;
    this.imagePreview = '';
  }

  async submitExpense(isValid: boolean | null): Promise<void> {
    if (!isValid || !this.expenseData.date) {
      await this.presentToast('Title and date are required.', 'warning');
      return;
    }

    const token = await this.requireToken();

    if (!token) {
      return;
    }

    const loading = await this.loadingController.create({
      message: this.imageFile ? 'Uploading receipt...' : 'Saving expense...',
      spinner: 'crescent'
    });

    this.isSubmitting = true;
    await loading.present();

    const request: Observable<{ message: string }> = this.imageFile
      ? this.api.uploadExpenseReceipt(this.buildReceiptForm('Expense'), token)
      : this.api.addExpense(this.expenseData, token);

    request.pipe(
      finalize(() => {
        this.isSubmitting = false;
        void loading.dismiss();
      })
    ).subscribe({
      next: response => {
        const successMessage = response.message || (this.imageFile ? 'Receipt saved.' : 'Expense saved.');
        this.resetForm();
        this.loadRecords();
        void this.presentToast(successMessage, 'success');
      },
      error: error => {
        const message = error?.error?.message || error?.error?.error || 'Expense save failed.';
        void this.presentToast(message, 'danger');
      }
    });
  }

  trackByRecordId(_index: number, record: ExpenseRecord): string {
    return record._id;
  }

  async openReceipt(record: ExpenseRecord): Promise<void> {
    if (!record.imageUrl) {
      return;
    }

    await Browser.open({ url: record.imageUrl });
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    this.releasePreviewUrl();
    this.imageFile = file;

    if (file.type.startsWith('image/')) {
      this.previewObjectUrl = URL.createObjectURL(file);
      this.imagePreview = this.previewObjectUrl;
    } else {
      this.imagePreview = '';
    }

    input.value = '';
  }

  onDateSelected(event: CustomEvent<{ value?: string | string[] | null }>): void {
    const nextValue = Array.isArray(event.detail.value)
      ? event.detail.value[0]
      : event.detail.value;

    const normalized = this.normalizeDate(nextValue);

    if (normalized) {
      this.expenseData.date = normalized;
    }
  }

  async captureWebCameraFrame(): Promise<void> {
    const video = this.webCameraVideo?.nativeElement;
    const canvas = this.webCameraCanvas?.nativeElement;

    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      await this.presentToast('Camera preview is not ready yet.', 'warning');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');

    if (!context) {
      await this.presentToast('Could not prepare the camera snapshot.', 'danger');
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(result => resolve(result), 'image/jpeg', 0.92);
    });

    if (!blob) {
      await this.presentToast('Could not capture the image.', 'danger');
      return;
    }

    this.releasePreviewUrl();
    this.imageFile = new File([blob], `expense-receipt-${Date.now()}.jpg`, {
      type: 'image/jpeg'
    });
    this.previewObjectUrl = URL.createObjectURL(this.imageFile);
    this.imagePreview = this.previewObjectUrl;
    this.closeWebCamera();
  }

  closeWebCamera(): void {
    this.stopWebCameraStream();
    this.isWebCameraOpen = false;
    this.isWebCameraStarting = false;
    this.webCameraError = '';
  }

  private async captureReceipt(): Promise<void> {
    try {
      const hasPermission = await this.ensureReceiptPermission();

      if (!hasPermission) {
        await this.presentToast('Camera permission is required.', 'warning');
        return;
      }

      const image = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Base64,
        quality: 92,
        correctOrientation: true,
        saveToGallery: false,
        direction: CameraDirection.Rear
      });

      if (!image) {
        return;
      }

      await this.setReceiptImage(image);
    } catch (error) {
      if (!this.isCameraCancel(error)) {
        await this.presentToast('Could not open the camera.', 'danger');
      }
    }
  }

  private async setReceiptImage(image: Photo): Promise<void> {
    if (!image.base64String) {
      await this.presentToast('Selected image is not readable.', 'danger');
      return;
    }

    const extension = this.normalizeImageExtension(image.format);
    const mimeType = this.mimeTypeForExtension(extension);
    const blob = this.base64ToBlob(image.base64String, mimeType);

    this.releasePreviewUrl();
    this.imageFile = new File([blob], `expense-receipt-${Date.now()}.${extension}`, {
      type: mimeType
    });
    this.previewObjectUrl = URL.createObjectURL(this.imageFile);
    this.imagePreview = this.previewObjectUrl;
  }

  private buildReceiptForm(type: 'Expense'): FormData {
    const formData = new FormData();

    if (this.imageFile) {
      formData.append('image', this.imageFile);
    }

    formData.append('type', type);
    formData.append('title', this.expenseData.title.trim());
    formData.append('description', this.expenseData.description.trim());
    formData.append('date', this.expenseData.date);

    return formData;
  }

  private loadRecords(): void {
    const token = this.session.getToken();

    if (!token) {
      this.records = [];
      return;
    }

    this.isLoadingRecords = true;

    this.api.getExpenses(token).subscribe({
      next: records => {
        this.records = records;
        this.isLoadingRecords = false;
      },
      error: () => {
        this.isLoadingRecords = false;
      }
    });
  }

  private resetForm(): void {
    this.expenseData = {
      title: '',
      description: '',
      date: this.today()
    };
    this.clearReceipt();
  }

  private async requireToken(): Promise<string | null> {
    const token = this.session.getToken();

    if (token) {
      return token;
    }

    await this.presentToast('Please sign in first.', 'warning');
    await this.router.navigate(['/login']);
    return null;
  }

  private refreshAccount(): void {
    const token = this.session.getToken();
    this.driveConnected = this.session.hasGoogleDrive();

    if (!token) {
      return;
    }

    this.api.getProfile(token).subscribe({
      next: response => {
        this.session.updateUser(response.user);
        this.driveConnected = Boolean(response.user.googleDriveConnected);
      },
      error: () => {
        this.driveConnected = this.session.hasGoogleDrive();
      }
    });
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private normalizeDate(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    return value.slice(0, 10);
  }

  private formatDisplayDate(value: string): string {
    if (!value) {
      return 'Select a date';
    }

    const parsed = new Date(`${value}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
      return 'Select a date';
    }

    return this.dateFormatter.format(parsed);
  }

  private async ensureReceiptPermission(): Promise<boolean> {
    if (!this.isNativePlatform) {
      return true;
    }

    const currentPermissions = await Camera.checkPermissions();
    const currentState = currentPermissions.camera;

    if (currentState === 'granted' || currentState === 'limited') {
      return true;
    }

    const updatedPermissions = await Camera.requestPermissions({
      permissions: ['camera']
    });
    const updatedState = updatedPermissions.camera;

    return updatedState === 'granted' || updatedState === 'limited';
  }

  private releasePreviewUrl(): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = '';
    }
  }

  private normalizeImageExtension(format: string | undefined): string {
    const normalized = (format || 'jpeg').toLowerCase();
    return normalized === 'jpg' ? 'jpeg' : normalized;
  }

  private mimeTypeForExtension(extension: string): string {
    if (extension === 'png') {
      return 'image/png';
    }

    if (extension === 'gif') {
      return 'image/gif';
    }

    return 'image/jpeg';
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const cleaned = base64.includes(',') ? base64.split(',').pop() || '' : base64;
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], { type: mimeType });
  }

  private async openWebCamera(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      await this.presentToast('This browser does not allow direct camera access.', 'warning');
      return;
    }

    this.closeWebCamera();
    this.isWebCameraOpen = true;
    this.isWebCameraStarting = true;
    this.webCameraError = '';

    const elements = await this.waitForWebCameraElements();

    if (!elements) {
      this.isWebCameraStarting = false;
      this.webCameraError = 'Camera preview could not be prepared.';
      await this.presentToast('Camera preview could not be prepared.', 'danger');
      return;
    }

    try {
      this.webCameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: 'environment'
          }
        },
        audio: false
      });

      elements.video.srcObject = this.webCameraStream;
      elements.video.muted = true;
      elements.video.playsInline = true;
      await elements.video.play();
    } catch {
      this.webCameraError = 'Could not access the camera from this browser.';
      await this.presentToast('Could not access the camera from this browser.', 'danger');
    } finally {
      this.isWebCameraStarting = false;
    }
  }

  private async waitForWebCameraElements(): Promise<{
    video: HTMLVideoElement;
    canvas: HTMLCanvasElement;
  } | null> {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const video = this.webCameraVideo?.nativeElement;
      const canvas = this.webCameraCanvas?.nativeElement;

      if (video && canvas) {
        return { video, canvas };
      }

      await new Promise(resolve => window.setTimeout(resolve, 40));
    }

    return null;
  }

  private stopWebCameraStream(): void {
    this.webCameraVideo?.nativeElement.pause();

    if (this.webCameraVideo?.nativeElement) {
      this.webCameraVideo.nativeElement.srcObject = null;
    }

    this.webCameraStream?.getTracks().forEach(track => track.stop());
    this.webCameraStream = null;
  }

  private isCameraCancel(error: unknown): boolean {
    const message = String((error as { message?: string })?.message || error).toLowerCase();
    return message.includes('cancel');
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
