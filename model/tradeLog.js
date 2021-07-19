const mongoose = require('mongoose');

const tradeLogSchema = 
    new mongoose.Schema(
        {
            startTime:Date,
            symbol:String,
            pnl:mongoose.Decimal128,
            minutesElapsed:Number,
            martingaleCount:Number,
            startBalance:mongoose.Decimal128
        }, 
        {
            timestamps: true,
            toObject: {
                transform: function (doc, ret) {
                    delete ret._id;
                    delete ret.__v;
                    ret.close = ret.close.toString() * 1;
                    ret.open = ret.open.toString() * 1;
                    return ret;
                }
            },
            toJSON: {
                transform: function (doc, ret) {
                    delete ret._id;
                    delete ret.__v;
                    ret.close = ret.close.toString() * 1;
                    ret.open = ret.open.toString() * 1;
                    return ret;
                }
            }
        }
      
);

const TradeLogModel = mongoose.model('TradeLog', tradeLogSchema);

module.exports.TradeLogModel = TradeLogModel;