import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { defineCustomElements as defineIonicElements } from '@ionic/core/loader';
import { defineCustomElements as definePwaElements } from '@ionic/pwa-elements/loader';
import { addIcons } from 'ionicons';
import {
  addCircleOutline,
  analyticsOutline,
  arrowBackOutline,
  calendarOutline,
  cameraOutline,
  cardOutline,
  cartOutline,
  cashOutline,
  checkmarkCircleOutline,
  chevronForwardOutline,
  cloudDoneOutline,
  cloudOfflineOutline,
  cloudUploadOutline,
  documentTextOutline,
  exitOutline,
  homeOutline,
  imageOutline,
  linkOutline,
  logInOutline,
  logoGoogle,
  openOutline,
  personAddOutline,
  personCircleOutline,
  refreshOutline,
  receiptOutline,
  shieldCheckmarkOutline,
  statsChartOutline,
  trashOutline,
  walletOutline,
  warningOutline
} from 'ionicons/icons';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

addIcons({
  'add-circle-outline': addCircleOutline,
  'analytics-outline': analyticsOutline,
  'arrow-back-outline': arrowBackOutline,
  'calendar-outline': calendarOutline,
  'camera-outline': cameraOutline,
  'card-outline': cardOutline,
  'cart-outline': cartOutline,
  'cash-outline': cashOutline,
  'checkmark-circle-outline': checkmarkCircleOutline,
  'chevron-forward-outline': chevronForwardOutline,
  'cloud-done-outline': cloudDoneOutline,
  'cloud-offline-outline': cloudOfflineOutline,
  'cloud-upload-outline': cloudUploadOutline,
  'document-text-outline': documentTextOutline,
  'exit-outline': exitOutline,
  'home-outline': homeOutline,
  'image-outline': imageOutline,
  'link-outline': linkOutline,
  'log-in-outline': logInOutline,
  'logo-google': logoGoogle,
  'open-outline': openOutline,
  'person-add-outline': personAddOutline,
  'person-circle-outline': personCircleOutline,
  'refresh-outline': refreshOutline,
  'receipt-outline': receiptOutline,
  'shield-checkmark-outline': shieldCheckmarkOutline,
  'stats-chart-outline': statsChartOutline,
  'trash-outline': trashOutline,
  'wallet-outline': walletOutline,
  'warning-outline': warningOutline
});

defineIonicElements(window);
definePwaElements(window);

bootstrapApplication(AppComponent, {
  providers: [
    provideIonicAngular(),
    provideRouter(routes),
    provideHttpClient()
  ]
}).catch(err => console.error(err));
