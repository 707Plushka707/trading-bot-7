require('dotenv').config();
const MartingaleSyncStrategy = require('./strategy/martingaleasync');
const MartingaleStrategy = require('./strategy/martingale');

const CONFIG = {
    symbol: 'BTCUSDT',
    leverage:10, 
    balance:1000,
    targetPercent:0.004,
    positionPercent:0.01,
    mode:'binance'
}

const executeStrategy = () => {
    return new Promise(async (resolve, reject) => {
        let strategy = new MartingaleSyncStrategy(CONFIG);
        if(strategy.init) {
            await strategy.init();
        }
        strategy.start();
        resolve();
    });
}

  
const start = async () => {

    executeStrategy();
    console.log("end index.js");

}

start();
//------------
//------------
