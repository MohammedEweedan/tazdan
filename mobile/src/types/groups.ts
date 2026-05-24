/**
 * Group chat + liquidity pool wire types. Mirror the server's
 * GroupController + LiquidityPoolController response shapes.
 */

export type GroupRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface GroupMember {
  id:         string;
  userId:     string;
  role:       GroupRole;
  permissions: Record<string, boolean> | null;
  joinedAt:   string;
  leftAt:     string | null;
  lastReadAt: string | null;
  user?: {
    id:        string;
    username:  string | null;
    firstName: string;
    lastName:  string;
    avatarUrl: string | null;
  };
}

export type GroupMessageType =
  | 'TEXT'
  | 'IMAGE'
  | 'SYSTEM'
  | 'POOL_CREATED'
  | 'POOL_DEPOSIT'
  | 'POOL_WITHDRAW'
  | 'POOL_CLOSED';

export interface GroupMessage {
  id:            string;
  groupId:       string;
  senderId:      string;
  type:          GroupMessageType;
  content:       string;
  attachmentUrl: string | null;
  metadata:      Record<string, any> | null;
  replyToId:     string | null;
  editedAt:      string | null;
  deletedAt:     string | null;
  createdAt:     string;
}

export type PoolKind = 'SHARED_WALLET' | 'GOAL_BASED';
export type PoolStatus = 'OPEN' | 'LOCKED' | 'COMPLETED' | 'DISSOLVED';

export interface PoolMember {
  id:                  string;
  userId:              string;
  totalContributedUsd: string;
  totalWithdrawnUsd:   string;
  joinedAt?:           string;
}

export interface LiquidityPool {
  id:              string;
  groupId:         string;
  name:            string;
  kind:            PoolKind;
  status:          PoolStatus;
  targetAmountUsd: string | null;
  deadline:        string | null;
  totalBalanceUsd: string;
  createdById:     string;
  createdAt:       string;
  members?:        PoolMember[];
}

export interface GroupChat {
  id:           string;
  name:         string;
  description:  string | null;
  avatarUrl:    string | null;
  createdById:  string;
  dissolvedAt:  string | null;
  createdAt:    string;
  updatedAt:    string;
  members?:     GroupMember[];
  pool:         LiquidityPool | null;
  lastMessage?: GroupMessage | null;
  unreadCount?: number;
}

export interface PoolContribution {
  id:        string;
  userId:    string;
  direction: 'DEPOSIT' | 'WITHDRAW';
  amount:    string;
  currency:  string;
  amountUsd: string;
  createdAt: string;
}
