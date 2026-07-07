import { User, Deposit, Withdrawal, Mt5Account, Trade } from '../../models/index.js';
import { successResponse } from '../../utils/response.js';
import { Sequelize } from 'sequelize';

export const getDashboardStats = async (req, res, next) => {
  try {
    const [totalUsers, totalAccounts, totalDeposits, totalWithdrawals, pendingDeposits, pendingWithdrawals, pendingKYC] =
      await Promise.all([
        User.count(),
        Mt5Account.count(),
        Deposit.sum('amount').then(v => v || 0),
        Withdrawal.sum('amount').then(v => v || 0),
        Deposit.count({ where: { status: 'pending' } }),
        Withdrawal.count({ where: { status: 'pending' } }),
        User.count({ where: { kycStatus: 'pending' } }).catch(() => 0),
      ]);
    const stats = { totalUsers, totalAccounts, totalDeposits, totalWithdrawals, pendingDeposits, pendingWithdrawals, pendingKYC };
    res.json(successResponse(stats, 'Dashboard stats retrieved'));
  } catch (error) {
    next(error);
  }
};

export const getDashboardCharts = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Use actual DB column name (underscored: true means created_at in DB)
    const dateCol = Sequelize.col('created_at');

    // Get deposit trend by day
    const depositTrend = await Deposit.findAll({
      attributes: [
        [Sequelize.fn('DATE', dateCol), 'date'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
      ],
      where: { createdAt: { [Sequelize.Op.gte]: startDate } },
      group: [Sequelize.fn('DATE', dateCol)],
      order: [[Sequelize.fn('DATE', dateCol), 'ASC']],
      raw: true
    });

    // Get withdrawal trend by day
    const withdrawalTrend = await Withdrawal.findAll({
      attributes: [
        [Sequelize.fn('DATE', dateCol), 'date'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
      ],
      where: { createdAt: { [Sequelize.Op.gte]: startDate } },
      group: [Sequelize.fn('DATE', dateCol)],
      order: [[Sequelize.fn('DATE', dateCol), 'ASC']],
      raw: true
    });

    // Get user growth by day
    const userGrowth = await User.findAll({
      attributes: [
        [Sequelize.fn('DATE', dateCol), 'date'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: { createdAt: { [Sequelize.Op.gte]: startDate } },
      group: [Sequelize.fn('DATE', dateCol)],
      order: [[Sequelize.fn('DATE', dateCol), 'ASC']],
      raw: true
    });

    const charts = {
      depositTrend: depositTrend.map(d => ({
        date: d.date,
        count: parseInt(d.count),
        amount: parseFloat(d.total) || 0
      })),
      withdrawalTrend: withdrawalTrend.map(d => ({
        date: d.date,
        count: parseInt(d.count),
        amount: parseFloat(d.total) || 0
      })),
      userGrowth: userGrowth.map(d => ({
        date: d.date,
        count: parseInt(d.count)
      }))
    };
    res.json(successResponse(charts, 'Dashboard charts retrieved'));
  } catch (error) {
    console.error('[Dashboard] Charts error:', error.message);
    next(error);
  }
};

export const getMt5Totals = async (req, res, next) => {
  try {
    const [totalBalance, totalEquity, count] = await Promise.all([
      Mt5Account.sum('balance').then(v => parseFloat(v) || 0),
      Mt5Account.sum('equity').then(v => parseFloat(v) || 0),
      Mt5Account.count({ where: { status: 'active' } }),
    ]);
    res.json(successResponse({ totalBalance, totalEquity, count }, 'MT5 totals retrieved'));
  } catch (error) {
    next(error);
  }
};

export default { getDashboardStats, getDashboardCharts, getMt5Totals };
