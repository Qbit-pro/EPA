import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject } from '@angular/core';
import {
  IonIcon,
  IonLabel,
  IonTabBar,
  IonTabButton,
  IonTabs
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: true,
  host: {
    class: 'ion-page'
  },
  imports: [CommonModule, IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs]
})
export class TabsPage implements AfterViewInit {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  ngAfterViewInit(): void {
    window.requestAnimationFrame(() => {
      const strayOutlet = this.elementRef.nativeElement.querySelector('ion-tabs.app-tabs > ion-router-outlet');

      if (!strayOutlet) {
        return;
      }

      strayOutlet.setAttribute('aria-hidden', 'true');
      strayOutlet.setAttribute('hidden', '');
      strayOutlet.style.display = 'none';
      strayOutlet.style.pointerEvents = 'none';
    });
  }
}
