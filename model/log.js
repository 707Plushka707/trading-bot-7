const mongoose = require('mongoose');

const logSchema = 
    new mongoose.Schema(
        {
            time: String,
            symbol: String,
            price: String,
            nextLong: String,
            nextShort: String,
            balance: String,
            pnl: String,
            target: String,
            martinGaleCnt: String,
            diffBalance: String
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

const LogModel = mongoose.model('Log', logSchema);

module.exports.LogModel = LogModel;