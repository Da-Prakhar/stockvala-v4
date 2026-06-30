import db from '../config/database.js';
import User from './User.js';
import UserProfile from './UserProfile.js';
import UserSession from './UserSession.js';
import Mt5Account from './Mt5Account.js';
import Deposit from './Deposit.js';
import Withdrawal from './Withdrawal.js';
import PaymentMethod from './PaymentMethod.js';
import KycDocument from './KycDocument.js';
import Trade from './Trade.js';
import Position from './Position.js';
import Order from './Order.js';
import CopyTradeMaster from './CopyTradeMaster.js';
import CopyTradeFollower from './CopyTradeFollower.js';
import CopyTradeSettings from './CopyTradeSettings.js';
import CopyTrade from './CopyTrade.js';
import MamManager from './MamManager.js';
import MamAccount from './MamAccount.js';
import MamTrade from './MamTrade.js';
import PammManager from './PammManager.js';
import PammInvestor from './PammInvestor.js';
import PammSettlement from './PammSettlement.js';
import Wallet from './Wallet.js';
import WalletTransaction from './WalletTransaction.js';
import IbTree from './IbTree.js';
import IbCommission from './IbCommission.js';
import IbLevel from './IbLevel.js';
import SupportTicket from './SupportTicket.js';
import SupportMessage from './SupportMessage.js';
import AdminUser from './AdminUser.js';
import Role from './Role.js';
import Permission from './Permission.js';
import BrokerSetting from './BrokerSetting.js';
import Notification from './Notification.js';
import AuditLog from './AuditLog.js';
import FeeTransaction from './FeeTransaction.js';

/**
 * Setup model associations
 * foreignKey values must match the JS model field names (camelCase),
 * NOT the raw DB column names. Sequelize resolves them via the field: mapping.
 */
export const setupAssociations = () => {
  // ─── User associations ───
  User.hasOne(UserProfile, { foreignKey: 'userId', as: 'profile' });
  User.hasMany(UserSession, { foreignKey: 'userId', as: 'sessions' });
  User.hasMany(Mt5Account, { foreignKey: 'userId', as: 'accounts' });
  User.hasMany(Deposit, { foreignKey: 'userId', as: 'deposits' });
  User.hasMany(Withdrawal, { foreignKey: 'userId', as: 'withdrawals' });
  User.hasOne(KycDocument, { foreignKey: 'userId', as: 'kycDocument' });
  User.hasOne(CopyTradeMaster, { foreignKey: 'userId', as: 'copyTradeMaster' });
  User.hasMany(CopyTradeFollower, { foreignKey: 'followerUserId', as: 'copyTradeFollowings' });
  User.hasOne(MamManager, { foreignKey: 'userId', as: 'mamManager' });
  User.hasMany(MamAccount, { foreignKey: 'investorUserId', as: 'mamInvestments' });
  User.hasOne(PammManager, { foreignKey: 'userId', as: 'pammManager' });
  User.hasMany(PammInvestor, { foreignKey: 'investorUserId', as: 'pammInvestments' });
  User.hasOne(Wallet, { foreignKey: 'userId', as: 'wallet' });
  // WalletTransactions are accessed through Wallet, not directly from User
  User.hasOne(IbTree, { foreignKey: 'userId', as: 'ibTree' });
  User.hasMany(SupportTicket, { foreignKey: 'userId', as: 'supportTickets' });
  User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
  // Self-referencing: User referred other users
  User.hasMany(User, { foreignKey: 'referredBy', as: 'referrals' });
  User.belongsTo(User, { foreignKey: 'referredBy', as: 'referrer' });

  // ─── UserProfile ───
  UserProfile.belongsTo(User, { foreignKey: 'userId' });

  // ─── UserSession ───
  UserSession.belongsTo(User, { foreignKey: 'userId' });

  // ─── Mt5Account ───
  Mt5Account.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Mt5Account.hasMany(Deposit, { foreignKey: 'mt5AccountId', as: 'deposits' });
  Mt5Account.hasMany(Withdrawal, { foreignKey: 'mt5AccountId', as: 'withdrawals' });
  Mt5Account.hasMany(Trade, { foreignKey: 'mt5AccountId', as: 'trades' });
  Mt5Account.hasMany(Position, { foreignKey: 'mt5AccountId', as: 'positions' });
  Mt5Account.hasMany(Order, { foreignKey: 'mt5AccountId', as: 'orders' });

  // ─── PaymentMethod ───
  PaymentMethod.hasMany(Deposit, { foreignKey: 'paymentMethodId', as: 'deposits' });
  PaymentMethod.hasMany(Withdrawal, { foreignKey: 'paymentMethodId', as: 'withdrawals' });

  // ─── Deposit ───
  Deposit.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Deposit.belongsTo(Mt5Account, { foreignKey: 'mt5AccountId', as: 'account' });
  Deposit.belongsTo(PaymentMethod, { foreignKey: 'paymentMethodId', as: 'paymentMethod' });
  Deposit.belongsTo(AdminUser, { foreignKey: 'approvedBy', as: 'approver' });

  // ─── Withdrawal ───
  Withdrawal.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Withdrawal.belongsTo(Mt5Account, { foreignKey: 'mt5AccountId', as: 'account' });
  Withdrawal.belongsTo(PaymentMethod, { foreignKey: 'paymentMethodId', as: 'paymentMethod' });
  Withdrawal.belongsTo(AdminUser, { foreignKey: 'approvedBy', as: 'approver' });

  // ─── KYC ───
  KycDocument.belongsTo(User, { foreignKey: 'userId' });
  KycDocument.belongsTo(AdminUser, { foreignKey: 'reviewedBy', as: 'reviewer' });

  // ─── Trade (linked to Mt5Account, NOT directly to User) ───
  Trade.belongsTo(Mt5Account, { foreignKey: 'mt5AccountId', as: 'account' });

  // ─── Position (linked to Mt5Account, NOT directly to User) ───
  Position.belongsTo(Mt5Account, { foreignKey: 'mt5AccountId', as: 'account' });

  // ─── Order (linked to Mt5Account, NOT directly to User) ───
  Order.belongsTo(Mt5Account, { foreignKey: 'mt5AccountId', as: 'account' });

  // ─── Copy Trading ───
  CopyTradeMaster.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  CopyTradeMaster.belongsTo(Mt5Account, { foreignKey: 'mt5AccountId', as: 'account' });
  CopyTradeMaster.hasMany(CopyTradeFollower, { foreignKey: 'masterId', as: 'followers' });

  CopyTradeFollower.belongsTo(User, { foreignKey: 'followerUserId', as: 'follower' });
  CopyTradeFollower.belongsTo(Mt5Account, { foreignKey: 'followerMt5AccountId', as: 'followerAccount' });
  CopyTradeFollower.belongsTo(CopyTradeMaster, { foreignKey: 'masterId', as: 'master' });
  CopyTradeFollower.hasOne(CopyTradeSettings, { foreignKey: 'followerId', as: 'settings' });

  CopyTradeSettings.belongsTo(CopyTradeFollower, { foreignKey: 'followerId' });

  CopyTrade.belongsTo(CopyTradeMaster, { foreignKey: 'masterId', as: 'master', constraints: false });
  CopyTrade.belongsTo(CopyTradeFollower, { foreignKey: 'followerId', as: 'followerRelation', constraints: false });
  CopyTradeMaster.hasMany(CopyTrade, { foreignKey: 'masterId', as: 'copyTrades', constraints: false });
  CopyTradeFollower.hasMany(CopyTrade, { foreignKey: 'followerId', as: 'copyTrades', constraints: false });

  // ─── MAM ───
  MamManager.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  MamManager.belongsTo(Mt5Account, { foreignKey: 'mt5AccountId', as: 'account' });
  MamManager.hasMany(MamAccount, { foreignKey: 'managerId', as: 'investors' });

  MamAccount.belongsTo(User, { foreignKey: 'investorUserId', as: 'investor' });
  MamAccount.belongsTo(MamManager, { foreignKey: 'managerId', as: 'manager' });
  MamAccount.belongsTo(Mt5Account, { foreignKey: 'investorMt5AccountId', as: 'investorAccount' });
  MamAccount.hasMany(MamTrade, { foreignKey: 'mamAccountId', as: 'trades', constraints: false });

  MamTrade.belongsTo(MamManager, { foreignKey: 'mamManagerId', as: 'manager', constraints: false });
  MamTrade.belongsTo(MamAccount, { foreignKey: 'mamAccountId', as: 'account', constraints: false });
  MamManager.hasMany(MamTrade, { foreignKey: 'mamManagerId', as: 'trades', constraints: false });

  // ─── PAMM ───
  PammManager.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  PammManager.belongsTo(Mt5Account, { foreignKey: 'mt5AccountId', as: 'account' });
  PammManager.hasMany(PammInvestor, { foreignKey: 'pammManagerId', as: 'investors' });
  PammManager.hasMany(PammSettlement, { foreignKey: 'pammManagerId', as: 'settlements', constraints: false });

  PammInvestor.belongsTo(User, { foreignKey: 'investorUserId', as: 'investor' });
  PammInvestor.belongsTo(PammManager, { foreignKey: 'pammManagerId', as: 'manager' });

  PammSettlement.belongsTo(PammManager, { foreignKey: 'pammManagerId', as: 'pool', constraints: false });

  // ─── Wallet ───
  Wallet.belongsTo(User, { foreignKey: 'userId' });
  Wallet.hasMany(WalletTransaction, { foreignKey: 'walletId', as: 'transactions' });

  WalletTransaction.belongsTo(Wallet, { foreignKey: 'walletId' });

  // ─── IB ───
  IbTree.belongsTo(User, { foreignKey: 'userId' });
  IbTree.belongsTo(IbTree, { foreignKey: 'parentId', as: 'parent' });
  IbTree.hasMany(IbTree, { foreignKey: 'parentId', as: 'children' });
  IbTree.hasMany(IbCommission, { foreignKey: 'ibTreeId', as: 'commissions' });

  IbCommission.belongsTo(IbTree, { foreignKey: 'ibTreeId' });
  IbCommission.belongsTo(User, { foreignKey: 'referredUserId', as: 'referredUser' });

  // ─── Support ───
  SupportTicket.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  SupportTicket.belongsTo(AdminUser, { foreignKey: 'assignedTo', as: 'assignee' });
  SupportTicket.hasMany(SupportMessage, { foreignKey: 'ticketId', as: 'messages' });

  SupportMessage.belongsTo(SupportTicket, { foreignKey: 'ticketId' });

  // ─── Admin ───
  AdminUser.belongsTo(Role, { foreignKey: 'roleId' });
  Role.hasMany(AdminUser, { foreignKey: 'roleId', as: 'admins' });

  // ─── Notification ───
  Notification.belongsTo(User, { foreignKey: 'userId' });

  // ─── Audit log ───
  AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  AuditLog.belongsTo(AdminUser, { foreignKey: 'adminId', as: 'admin' });

  // ─── FeeTransaction ───
  FeeTransaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  User.hasMany(FeeTransaction, { foreignKey: 'userId', as: 'feeTransactions' });
};

// Setup associations
setupAssociations();

export {
  User,
  UserProfile,
  UserSession,
  Mt5Account,
  Deposit,
  Withdrawal,
  PaymentMethod,
  KycDocument,
  Trade,
  Position,
  Order,
  CopyTradeMaster,
  CopyTradeFollower,
  CopyTradeSettings,
  CopyTrade,
  MamManager,
  MamAccount,
  MamTrade,
  PammManager,
  PammInvestor,
  PammSettlement,
  Wallet,
  WalletTransaction,
  IbTree,
  IbCommission,
  IbLevel,
  SupportTicket,
  SupportMessage,
  AdminUser,
  Role,
  Permission,
  BrokerSetting,
  Notification,
  AuditLog,
  FeeTransaction
};

export default db;
