import type { Order, CreateOrderInput, Payment, CreatePaymentInput } from "@pos/shared-types";
import { HttpClient } from "./http-client.js";

export interface PosClientConfig {
  readonly baseUrl: string;
  readonly authToken?: string;
}

export class PosClient {
  private readonly http: HttpClient;

  constructor(config: PosClientConfig) {
    this.http = new HttpClient(config.baseUrl, {
      ...(config.authToken !== undefined
        ? { Authorization: `Bearer ${config.authToken}` }
        : {}),
    });
  }

  readonly orders = {
    create: (input: CreateOrderInput) =>
      this.http.post<Order>("/api/orders", input),

    getById: (id: string) =>
      this.http.get<Order>(`/api/orders/${id}`),

    list: () =>
      this.http.get<ReadonlyArray<Order>>("/api/orders"),
  };

  readonly payments = {
    create: (input: CreatePaymentInput) =>
      this.http.post<Payment>("/api/payments", input),

    getById: (id: string) =>
      this.http.get<Payment>(`/api/payments/${id}`),
  };

  readonly health = {
    check: () =>
      this.http.get<{ status: string; timestamp: string }>("/health"),
  };
}
