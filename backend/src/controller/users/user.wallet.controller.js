import { User } from '../../models/user.model.js';
import { Transaction } from '../../models/transaction.model.js';
import { apiError } from '../../utils/apiError.js';
import { apiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const getWallet = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('walletBalance preferredPaymentMethod');
    return res.status(200).json(new apiResponse(200, user, 'Wallet fetched'));
});

const getTransactions = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, type } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (parseInt(page) - 1) * limitNum;

    const filter = { userId: req.user._id };
    if (type) filter.type = type;

    const [transactions, total] = await Promise.all([
        Transaction.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate('tripId', 'pickup dropoff vehicleType'),
        Transaction.countDocuments(filter),
    ]);

    return res.status(200).json(
        new apiResponse(200, {
            transactions,
            pagination: { total, page: parseInt(page), limit: limitNum, pages: Math.ceil(total / limitNum) },
        }, 'Transactions fetched')
    );
});

export { getWallet, getTransactions };
