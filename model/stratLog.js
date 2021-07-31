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

const StratLogModel = mongoose.model('StratLog', stratLogSchema);

module.exports.StratLogModel = StratLogModel;