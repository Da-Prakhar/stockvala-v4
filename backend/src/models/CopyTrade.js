import { DataTypes } from 'sequelize';
import db from '../config/database.js';

// Lazy-import to avoid circular dep; loaded after models are registered
let _feeService = null;
async function getFeeService() {
  if (!_feeService) {
    const mod = await import('../services/fee.service.js');
    _feeService = mod.default || mod;
  }
  return _feeService;
}

/**
 * CopyTrade model
 * Tracks each individual trade that was copied from a master to a follower
 */
const CopyTrade = db.define('CopyTrade', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  masterId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'master_id'
  },
  followerId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'follower_id'
  },
  masterTicket: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'master_ticket'
  },
  followerTicket: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'follower_ticket'
  },
  symbol: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  action: {
    type: DataTypes.ENUM('buy', 'sell'),
    allowNull: false
  },
  masterLots: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'master_lots'
  },
  followerLots: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'follower_lots'
  },
  openPrice: {
    type: DataTypes.DECIMAL(18, 5),
    allowNull: true,
    field: 'open_price'
  },
  closePrice: {
    type: DataTypes.DECIMAL(18, 5),
    allowNull: true,
    field: 'close_price'
  },
  profit: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('open', 'closed', 'failed'),
    defaultValue: 'open'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_message'
  },
  openedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'opened_at'
  },
  closedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'closed_at'
  },
  createdAt: {
    type: DataTypes.DATE
  },
  updatedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'copy_trades',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      // Prevents duplicate copy trades for the same follower + master ticket
      // even across multiple server processes (cPanel multi-process).
      // Only ONE insert wins; all others fail with UniqueConstraintError.
      unique: true,
      fields: ['follower_id', 'master_ticket'],
      name: 'uq_copy_follower_master_ticket'
    }
  ]
});

/**
 * Auto-charge performance fee whenever a copy trade closes with profit.
 * Runs asynchronously — never blocks the trade update itself.
 */
CopyTrade.addHook('afterUpdate', async (trade, options) => {
  try {
    // Only fire on transition TO 'closed' with positive profit
    if (trade.status !== 'closed') return;
    const profit = parseFloat(trade.profit);
    if (!profit || profit <= 0) return;

    // Fetch the follower to get userId
    const { CopyTradeFollower } = await import('./CopyTradeFollower.js');
    const follower = await CopyTradeFollower.findByPk(trade.followerId, {
      attributes: ['id', 'masterId', 'followerUserId']
    });
    if (!follower) return;

    const svc = await getFeeService();
    await svc.chargePerformanceFee({
      copyTradeId: trade.id,
      followerId:  follower.id,
      masterId:    follower.masterId,
      userId:      follower.followerUserId,
      grossProfit: profit,
    });
  } catch (err) {
    // Fee failure must never break the trade update
    console.error('[CopyTrade] Fee hook error:', err.message);
  }
});

export default CopyTrade;
