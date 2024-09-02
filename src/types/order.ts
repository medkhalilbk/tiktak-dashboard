export interface IOrder {
  id: string;
  productId: string;
  quantity: number;
  restaurantId: string;
  price: number;
  createdAt: Date;
  supplementsIds?: string[];
}
