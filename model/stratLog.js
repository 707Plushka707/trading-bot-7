const mongoose = require('mongoose');

const stratLogSchema = 
    new mongoose.Schema(
        {
            symbol:String,
            worstPNL:mongoose.Decimal128,
            maxMinutes:Number,
            maxMartingale:Number,
            closeCount:Number,
            totalPnl:mongoose.Decimal128
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

const StratLogModel = mongoose.model('StratLog', stratLogSchema);

module.exports.StratLogModel = StratLogModel;