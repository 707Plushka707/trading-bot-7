const Binance = require('node-binance-api');
const EventEmmiter = require('events');
const { fileLogger } = require('../utils/logger')

const binance = new Binance().options({
    APIKEY: process.env.API_KEY,
    APISECRET: process.env.API_SECRET,
    hedgeMode: true,
    test: process.env.TEST_MODE == 1 ? true : false
});

class BinanceService extends EventEmmiter {

    #params;
    #symbol;
    #websocket;

    #pricePrecision; // number of digit
    #lotSize; // min qty

    constructor(params) {
        super();
        this.#symbol = params.symbol;
        this.#params = params;

    }

    convertToMarkPrice = (data) => {
        const m = {};
            m.time= new Date(data.E)
            m.symbol= data.s
            m.markPrice= data.p
            m.indexPrice= data.i
            m.settlePrice= data.P
            m.fundingRate= data.r
            m.nextFundingTime= new Date(data.T)
        
        return m;
    }

    listen = (callback) => {
        
        const websocketname = this.#symbol.toLowerCase() + '@markPrice@1s';

        this.#websocket = binance.futuresSubscribe(websocketname, (e) => {
            const data = this.convertToMarkPrice(e);

            // let log = data.time + ' - ';
            // log += 'price : ' + data.markPrice + ' - ';
            // log += 'pnl : ' + this.getPNL() + ' - ';

            // console.log(log);

            if(callback) {
                callback(data);
            }
        });

        return this.#websocket;
    }

    //---------------------------------
    //------- Initialization ----------
    //---------------------------------

    init = async () => {
        
        await this.initHedgeMode();
        await this.initLeverage();
        await this.initMarginType();
        await this.initMarketData();

    }

    initMarketData = async () => {

        const result = await binance.futuresExchangeInfo();
        const data = result.symbols.filter(s => s.symbol == this.#symbol)[0];

        this.#pricePrecision = parseInt(data.pricePrecision);
        this.#lotSize = parseFloat(data.filters.filter(f => f.filterType == "MARKET_LOT_SIZE")[0].stepSize);

        fileLogger.info(`Precision : ${this.#pricePrecision}`);
        fileLogger.info(`LotSize : ${this.#lotSize}`);

    }

    initMarginType = async () => {

        let result = await binance.futuresPositionRisk({symbol:this.#symbol});
        if(result.code) {
            const log = `Can not get margin type : ${JSON.stringify(result)}`;
            fileLogger.error(log);
            throw Error(log);
        }

        if(result[0].marginType.toUpperCase() != "CROSS") {
            fileLogger.info("Need to set margin type to crossed");

            result = await binance.futuresMarginType(this.#symbol, "CROSSED");
            if(result.code != 200) {
                const log = `Could not initialize margin type : ${JSON.stringify(result)}`;
                fileLogger.error(log);
                throw Error(log);
            }
        }
        fileLogger.info(`Margin type initialiazed successfully`);
    }

    initLeverage = async () => {
        const result = await binance.futuresLeverage(this.#symbol, this.#params.leverage);
        if(result.code) {
            const log = `Can not set leverage to ${this.#params.leverage} : ${JSON.stringify(result)}`;
            fileLogger.error(log);
            throw new Error(log);
        }
        fileLogger.info(`Leverage initialiazed successfully : ${JSON.stringify(result)}`);
    }

    initHedgeMode = async () => {

        let result;
        
        result = await binance.futuresPositionSideDual();

        if(!result.dualSidePosition) {
            fileLogger.info("Need to set hedge mode on");

            result = await binance.futuresChangePositionSideDual(true);
            if(result.code != 200) {
                const log = `Could not initialize hedge mode (setting hedge position) : ${JSON.stringify(result)}`;
                fileLogger.error(log);
                throw Error(log);
            }
        }
        fileLogger.info(`Hedge mode initialized successfully : ${JSON.stringify(result)}`);
    }


    //------------------------
    //------- Account---------
    //------------------------

    getBalance = async () => {
        const result = await binance.futuresBalance();
        return parseFloat(result.filter(i => i.asset == "USDT")[0].availableBalance);
    }

    getLeverage = async () => {
        return new Promise((resolve, reject) => { resolve(this.#params.leverage) });
    }

    getPNL = async () => {
        const result = await binance.futuresBalance();
        return parseFloat(result.filter(i => i.asset == "USDT")[0].crossUnPnl);
    }

    getBalanceAndPnl =  async () => {
        const result = await binance.futuresBalance();
        const asset = result.filter(i => i.asset == "USDT")[0];
        return {
            balance:parseFloat(asset.availableBalance),
            pnl:parseFloat(asset.crossUnPnl)
        } 
    }


    //------------------------
    //------- Order ----------
    //------------------------
        precision = (num) => {
            if(Math.floor(num.valueOf()) === num.valueOf()) return 0;
            return num.toString().split(".")[1].length || 0; 
        }

         precise = (num, precision) => {
            const mutiplier = 10 ** (precision);
            return Math.floor(num * mutiplier) / mutiplier
        }

    getFixedQuantity = (quantity) => {
        const p = this.precision(this.#lotSize);
        const res = this.precise(quantity, p);
        return res;
    }
    
    open = async (side, quantity, price) => {
        let result;
        const fixedQuantity = this.getFixedQuantity(quantity);
        if(side.toUpperCase() == 'LONG') {
            result = await binance.futuresMarketBuy(this.#symbol.toLowerCase(), fixedQuantity);
        } else if(side.toUpperCase() == 'SHORT') {
            result = await binance.futuresMarketSell(this.#symbol.toLowerCase(), fixedQuantity);
        }

        if(result.code && result.code != 200) {
            this.#websocket.close();
            throw Error(`Could open position ${side} ${fixedQuantity} : ${JSON.stringify(result)}`);
        }
        return  {
            open:price,
            quantity:fixedQuantity
        }
    }

    closeAll = async () => {
        const positions = await binance.futuresPositionRisk({symbol:this.#symbol});

        // get position amount
        const longPositionAmount = positions.filter(p => p.positionSide.toUpperCase() == "LONG")[0].positionAmt;
        const shortPositionAmount = positions.filter(p => p.positionSide.toUpperCase() == "SHORT")[0].positionAmt;

        // close long
        await binance.futuresMarketSell(this.#symbol, longPositionAmount, { positionSide: "LONG" });

        // close short
        await binance.futuresMarketBuy(this.#symbol, 2, { positionSide: "SHORT" });
    }
}

module.exports = BinanceService