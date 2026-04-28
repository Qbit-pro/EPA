import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Observable, catchError, firstValueFrom, from, map, of, timeout } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface UserProfile {
  _id: string;
  username: string;
  email: string;
  googleDriveConnected?: boolean;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
  message?: string;
}

export interface AuthPayload {
  username?: string;
  email: string;
  password: string;
}

export interface ExpensePayload {
  title: string;
  description: string;
  date: string;
  imageUrl?: string;
}

export interface PurchasePayload extends ExpensePayload {
  paidBy: string;
}

export interface ExpenseRecord extends ExpensePayload {
  _id: string;
  createdAt?: string;
}

export interface PurchaseRecord extends PurchasePayload {
  _id: string;
  createdAt?: string;
}

export interface UploadResponse {
  message: string;
  fileId?: string;
  imageUrl?: string;
  record?: ExpenseRecord | PurchaseRecord;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly storageKey = 'api_base_url';

  signup(data: AuthPayload): Observable<AuthResponse> {
    return this.post<AuthResponse>('/auth/signup', data);
  }

  login(data: AuthPayload): Observable<AuthResponse> {
    return this.post<AuthResponse>('/auth/login', data);
  }

  healthUrl(): string {
    return this.buildUrl('/health');
  }

  getProfile(token: string): Observable<{ user: UserProfile }> {
    return this.get<{ user: UserProfile }>('/auth/me', token);
  }

  logout(token: string): Observable<{ message: string }> {
    return this.post<{ message: string }>('/auth/logout', {}, token);
  }

  addExpense(data: ExpensePayload, token: string): Observable<{ message: string; expense: ExpenseRecord }> {
    return this.post<{ message: string; expense: ExpenseRecord }>('/expense/add', data, token);
  }

  getExpenses(token: string): Observable<ExpenseRecord[]> {
    return this.get<ExpenseRecord[]>('/expense/all', token);
  }

  deleteExpense(id: string, token: string): Observable<{ message: string }> {
    return this.remove<{ message: string }>(`/expense/${id}`, token);
  }

  addPurchase(data: PurchasePayload, token: string): Observable<{ message: string; purchase: PurchaseRecord }> {
    return this.post<{ message: string; purchase: PurchaseRecord }>('/purchase/add', data, token);
  }

  getPurchases(token: string): Observable<PurchaseRecord[]> {
    return this.get<PurchaseRecord[]>('/purchase/all', token);
  }

  deletePurchase(id: string, token: string): Observable<{ message: string }> {
    return this.remove<{ message: string }>(`/purchase/${id}`, token);
  }

  uploadReceipt(data: FormData, token: string): Observable<UploadResponse> {
    return this.postForm<UploadResponse>('/purchase/upload', data, token);
  }

  uploadExpenseReceipt(data: FormData, token: string): Observable<UploadResponse> {
    return this.postForm<UploadResponse>('/expense/upload', data, token);
  }

  googleAuthUrl(redirectUrl: string, token?: string): string {
    const params = new URLSearchParams({
      redirect: redirectUrl
    });

    if (token) {
      params.set('token', token);
    }

    return `${this.buildUrl('/auth/google')}?${params.toString()}`;
  }

  getBaseUrl(): string {
    return this.resolveBaseUrl();
  }

  getDefaultBaseUrl(): string {
    return this.resolveDefaultBaseUrl();
  }

  setBaseUrl(value: string): string {
    const normalized = this.normalizeBaseUrl(value);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.storageKey, normalized);
    }

    return normalized;
  }

  clearBaseUrl(): string {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(this.storageKey);
    }

    return this.resolveDefaultBaseUrl();
  }

  async isReachable(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const response = await CapacitorHttp.get({
          url: this.healthUrl()
        });

        return response.status >= 200
          && response.status < 300
          && response.data?.status === 'ok';
      } catch {
        return false;
      }
    }

    try {
      return await firstValueFrom(
        this.http.get<{ status?: string }>(this.healthUrl()).pipe(
          timeout(3500),
          map(response => response?.status === 'ok'),
          catchError(() => of(false))
        )
      );
    } catch {
      return false;
    }
  }

  private authHeaders(token: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  private get<T>(path: string, token?: string): Observable<T> {
    if (Capacitor.isNativePlatform()) {
      return from(this.nativeRequest<T>('GET', path, token));
    }

    return this.http.get<T>(this.buildUrl(path), this.requestOptions(token));
  }

  private post<T>(path: string, data: unknown, token?: string): Observable<T> {
    if (Capacitor.isNativePlatform()) {
      return from(this.nativeRequest<T>('POST', path, token, data));
    }

    return this.http.post<T>(this.buildUrl(path), data, this.requestOptions(token));
  }

  private postForm<T>(path: string, data: FormData, token: string): Observable<T> {
    if (Capacitor.isNativePlatform()) {
      return from(this.nativeUploadRequest<T>(path, data, token));
    }

    return this.http.post<T>(this.buildUrl(path), data, {
      headers: this.authHeaders(token)
    });
  }

  private remove<T>(path: string, token: string): Observable<T> {
    if (Capacitor.isNativePlatform()) {
      return from(this.nativeRequest<T>('DELETE', path, token));
    }

    return this.http.delete<T>(this.buildUrl(path), this.requestOptions(token));
  }

  private buildUrl(path: string): string {
    return `${this.resolveBaseUrl()}${path}`;
  }

  private requestOptions(token?: string): { headers?: HttpHeaders } {
    return token
      ? { headers: this.authHeaders(token) }
      : {};
  }

  private async nativeRequest<T>(method: 'DELETE' | 'GET' | 'POST', path: string, token?: string, data?: unknown): Promise<T> {
    const headers: Record<string, string> = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (data !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await CapacitorHttp.request({
        url: this.buildUrl(path),
        method,
        headers,
        data
      });

      return this.unwrapNativeResponse<T>(response.status, response.data);
    } catch (error) {
      throw this.normalizeNativeFailure(error);
    }
  }

  private async nativeUploadRequest<T>(path: string, data: FormData, token: string): Promise<T> {
    const serializedData = await this.serializeFormData(data);
    return this.nativeRequest<T>('POST', path, token, serializedData);
  }

  private unwrapNativeResponse<T>(status: number, data: unknown): T {
    if (status >= 200 && status < 300) {
      return data as T;
    }

    throw this.createNativeError(status, data);
  }

  private createNativeError(status: number, data: unknown): { error: { message: string } | Record<string, unknown>; status: number } {
    if (data && typeof data === 'object') {
      return {
        status,
        error: data as Record<string, unknown>
      };
    }

    return {
      status,
      error: {
        message: typeof data === 'string'
          ? data
          : `Request failed with status ${status}.`
      }
    };
  }

  private normalizeNativeFailure(error: unknown): { error: { message: string }; status: number } {
    if (error && typeof error === 'object' && 'error' in error && 'status' in error) {
      return error as { error: { message: string }; status: number };
    }

    return {
      status: 0,
      error: {
        message: String((error as { message?: string })?.message || 'Network request failed.')
      }
    };
  }

  private async serializeFormData(data: FormData): Promise<Record<string, unknown>> {
    const serialized: Record<string, unknown> = {};
    const entries: Array<[string, FormDataEntryValue]> = [];

    data.forEach((value, key) => {
      entries.push([key, value]);
    });

    for (const [key, value] of entries) {
      if (typeof value === 'string') {
        serialized[key] = value;
        continue;
      }

      if (value instanceof File) {
        serialized['imageBase64'] = await this.fileToBase64(value);
        serialized['imageName'] = value.name;
        serialized['imageMimeType'] = value.type || 'image/jpeg';
      }
    }

    return serialized;
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',').pop() || '' : result;
        resolve(base64);
      };

      reader.onerror = () => {
        reject(new Error('Could not prepare the image upload.'));
      };

      reader.readAsDataURL(file);
    });
  }

  private resolveBaseUrl(): string {
    return this.resolveStoredOverride() || this.resolveDefaultBaseUrl();
  }

  private resolveDefaultBaseUrl(): string {
    if (Capacitor.isNativePlatform()) {
      return environment.androidApiUrl;
    }

    if (typeof window !== 'undefined') {
      const host = window.location.hostname;

      if (host) {
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        return `${protocol}//${host}:5000/api`;
      }
    }

    return environment.apiUrl;
  }

  private resolveStoredOverride(): string | null {
    return typeof window !== 'undefined'
      ? window.localStorage.getItem(this.storageKey)
      : null;
  }

  private normalizeBaseUrl(value: string): string {
    let normalized = value.trim();

    if (!normalized) {
      throw new Error('Server URL is required.');
    }

    if (!/^https?:\/\//i.test(normalized)) {
      normalized = `http://${normalized}`;
    }

    normalized = normalized.replace(/\/+$/, '');

    if (!/\/api$/i.test(normalized)) {
      normalized = `${normalized}/api`;
    }

    return normalized;
  }
}
