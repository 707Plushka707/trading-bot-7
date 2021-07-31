const mongoose = require('mongoose');

const priceLogSchema = 
    new mongoose.Schema(
        {
            time: Date,
            symbol: String,
            price: mongoose.Decimal128,
            nextLong: mongoose.Decimal128,
            nextShort: mongoose.Decimal128,
            martingaleCount: Number,
            minutesElapsed: Number,
            target: mongoose.Decimal128,
            pnl: mongoose.Decimal128,
            balance: mongoose.Decimal128,
            netValue: mongoose.Decimal128,
            startBalance:mongoose.Decimal128
        }, 
        {
            timestamps: true,
            toObject: {
                transform: function (doc, ret) {
                    delete ret._id;
                    delete ret.__v;
                    return ret;
                }
            },
            toJSON: {
                transform: function (doc, ret) {
                    delete ret._id;
                    delete ret.__v;
                    return ret;
                }
            }
        }
      
);

const PriceLogModel = mongoose.model('PriceLog', priceLogSchema);

module.exports.PriceLogModel = PriceLogModel;