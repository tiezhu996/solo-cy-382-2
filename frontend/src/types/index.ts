export interface User {
  id: number;
  nickname: string;
}

export type TripStatusValue = 'OPEN' | 'MATCHED' | 'FINISHED';

export interface Trip {
  id: number;
  ownerId: number;
  destination: string;
  departDate: string;
  days: number;
  budgetMin?: number | string | null;
  budgetMax?: number | string | null;
  transport: string;
  companionCount: number;
  genderPreference?: string | null;
  status: TripStatusValue;
  memberCount?: number;
}

export type ApplicationStatusValue = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ApplicationView {
  id: number;
  tripId: number;
  status: ApplicationStatusValue;
  message?: string | null;
  createdAt: string;
  updatedAt: string;
  applicant: { id: number; nickname: string };
  trip: { id: number; destination: string; departDate: string; status: TripStatusValue; companionCount: number };
}

export type TripMemberRole = 'OWNER' | 'COMPANION';

export interface TripMember {
  userId: number;
  nickname: string;
  role: TripMemberRole;
  joinedAt: string | null;
}
