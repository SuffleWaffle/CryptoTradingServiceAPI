import { PaymentRequestStatus } from '@cupo/backend/constant';

export interface UserPayment {
  _id?: string;
  userId: string;
  sum: number;
  status?: PaymentRequestStatus;

  created?: Date;

  payload?: any; // payload from the payment system
}

export interface ReferralReward {
  _id?: string;
  paymentId: string;
  referralId: string;
  partnerId: string;
  sum: number; // sum of the reward
  level: number;
  created?: Date;
}
