export interface RequestOptions {
  readonly headers?: Record<string, string>;
  readonly signal?: AbortSignal;
}

export interface ApiResponse<T> {
  readonly data: T;
  readonly status: number;
  readonly ok: boolean;
}

export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly defaultHeaders: Record<string, string> = {}
  ) {}

  async get<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>("GET", path, undefined, options);
  }

  async post<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>("POST", path, body, options);
  }

  async put<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>("PUT", path, body, options);
  }

  async patch<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>("PATCH", path, body, options);
  }

  async delete<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", path, undefined, options);
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    options: RequestOptions
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.defaultHeaders,
      ...options.headers,
    };

    const init: RequestInit = {
      method,
      headers,
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    };
    const response = await fetch(url, init);

    const data = (await response.json()) as T;

    return {
      data,
      status: response.status,
      ok: response.ok,
    };
  }
}
