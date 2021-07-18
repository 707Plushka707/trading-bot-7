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


    console.log("Hello");
    console.log(process.env.TEST_MODE);

    require('./startup/database').init();
    executeStrategy();

    const express = require('express')
    const app = express()
    const port = process.env.PORT || 3000;
      
    app.get ("/", function (req,res) {
        res.render ( "index.ejs" );	
    });
    
    app.listen(port, () => {
        console.log(`Listening at http://localhost:${port}`)
    })
}

start();
//------------
//------------
