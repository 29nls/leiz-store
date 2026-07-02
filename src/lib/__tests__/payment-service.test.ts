// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockQueryBuilder: any;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockSupabaseAdmin: any;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockResolveValue: any = { data: null, error: null };

mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  then: jest.fn(function (this: any, resolve: any) {
    resolve(mockResolveValue);
  }),
};

mockSupabaseAdmin = {
  from: jest.fn().mockReturnValue(mockQueryBuilder),
};

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

jest.mock("@/lib/repositories", () => ({
  orderRepository: {
    findById: jest.fn(),
  },
}));

import { getOrderForPayment } from "@/lib/payment/payment-service";

describe("Payment Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveValue = { data: null, error: null };
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.eq.mockReturnThis();
    mockQueryBuilder.single.mockReturnThis();
    mockQueryBuilder.then.mockImplementation(function (this: any, resolve: any) {
      resolve(mockResolveValue);
    });
  });

  it("fetches order items with product join when available", async () => {
    const orderItemData = [
      {
        id: "item-1",
        name: "Sword",
        price: 50000,
        quantity: 1,
        total: 50000,
        product: { id: "prod-1", name: "Sword" },
      },
    ];

    let callIndex = 0;
    mockQueryBuilder.then.mockImplementation(function (this: any, resolve: any) {
      if (callIndex === 0) {
        resolve({ data: { id: "order-1", total: 100 }, error: null });
      } else {
        resolve({ data: orderItemData, error: null });
      }
      callIndex += 1;
    });

    const result = await getOrderForPayment("order-1");

    expect(result?.order_item).toEqual(orderItemData);
    expect(result?.items).toEqual(orderItemData);
    expect(result?.orderItem).toEqual(orderItemData);
    expect(mockSupabaseAdmin.from).toHaveBeenCalledWith("order");
    expect(mockSupabaseAdmin.from).toHaveBeenCalledWith("order_item");
  });

  it("falls back to plain order_item when product join fails", async () => {
    const orderData = { id: "order-2", total: 200 };
    const plainItems = [
      { id: "item-2", name: "Shield", price: 80000, quantity: 1, total: 80000 },
    ];

    let callIndex = 0;
    mockQueryBuilder.then.mockImplementation(function (this: any, resolve: any) {
      if (callIndex === 0) {
        resolve({ data: orderData, error: null });
      } else if (callIndex === 1) {
        resolve({ data: null, error: { message: "join failed" } });
      } else {
        resolve({ data: plainItems, error: null });
      }
      callIndex += 1;
    });

    const result = await getOrderForPayment("order-2");
    expect(result?.order_item).toEqual(plainItems);
    expect(result?.items).toEqual(plainItems);
    expect(result?.orderItem).toEqual(plainItems);
  });
});
