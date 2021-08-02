const fs = require('fs');
const EventEmmiter = require('events');
const Binance = require('node-binance-api');

const binance = new Binance().options({
    APIKEY: process.env.API_KEY,
    APISECRET: process.env.API_SECRET,
    hedgeMode: true,
    test: process.env.TEST_MODE == 1 ? true : false
});

const TRANSACTION_FEE = 0.0004;

class DemoService extends EventEmmiter {

    #currentPrice;

    //--------------

    #symbol;
    #balance;
    #leverage;

    #longs = new Array();
    #shorts = new Array();

    #lastTime = null;

    //--------------

    constructor(params) {
        super();
        this.#symbol = params.symbol;
        this.#balance = params.balance ? params.balance : 1000;
        this.#leverage = params.leverage ? params.leverage : 100;
        
        if(params.balance) {
            this.setBalance(params.balance);
        }
    }

    convertToMarkPrice = (data) => {
        // const filteredData = data.filter(o => o.s == this.#symbol)[0];
    
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

    handleFuturesSocketError =  ( error ) => {
        Binance.options.log( 'XXXX Futures WebSocket error: ' + this.endpoint +
          ( error.code ? ' (' + error.code + ')' : '' ) +
          ( error.message ? ' ' + error.message : '' ) );
    };

    listen = (callback) => {
        
        const websocketname = this.#symbol.toLowerCase() + '@markPrice@1s';

        const websocket = binance.futuresSubscribe(websocketname, (e) => {
            const data = this.convertToMarkPrice(e);
            this.#currentPrice = data.markPrice;

            let log = data.time + ' - ';
            log += 'price : ' + data.markPrice + ' - ';
            log += 'pnl : ' + this.getPNL() + ' - ';

            console.log(log);

            if(callback) {
                callback(data);
            }
        });

        return websocket;
    }

    open = (side, quantity) => {
        
        const cost = this.#currentPrice * quantity;
        this.#balance -= cost * TRANSACTION_FEE;

        this.#balance -= cost / this.#leverage;

        if(this.#balance < 0) {
            throw Error('Not enought funds : #balance = ' + this.#balance + ', quantity = ' + quantity);
        }

        if(side.toUpperCase() == 'LONG') {
            this.#longs.push({
                open:this.#currentPrice,
                quantity: quantity
            });

            return this.#longs[this.#longs.length - 1];
        } else {
            this.#shorts.push({
                open:this.#currentPrice,
                quantity: quantity
            });

            return this.#shorts[this.#shorts.length - 1];
        }
    }

    closeAll = () => {
        this.balance -= this.getTransactionFeeOnClose();
        this.#balance += this.getTradeValue();
        this.#longs = new Array();
        this.#shorts = new Array();
    }

    getBalance = () => {
        return this.#balance;
    }

    setBalance = (balance) => {
        this.#balance = balance;
    }

    getLeverage = () => {
        return this.#leverage;
    }


    //--------------

    getTransactionFeeOnClose = () => {
        
        let fee = 0;

        for(let i = 0; i< this.#longs.length; i++) {
            let longCurrentValue = (this.#longs[i].quantity) * this.#currentPrice;
            fee += longCurrentValue * TRANSACTION_FEE;
        }

        for(let i = 0; i< this.#shorts.length; i++) {
            let shortCurrentValue = (this.#shorts[i].quantity) * this.#currentPrice;
            fee += shortCurrentValue * TRANSACTION_FEE;
        }

        return fee;

    }

    getTradeValue = () => {
        
        let tradeValue = 0;

        for(let i = 0; i< this.#longs.length; i++) {
            let longOpenValue = (this.#longs[i].quantity * this.#longs[i].open) / this.#leverage;
            tradeValue += longOpenValue;
        }

        for(let i = 0; i< this.#shorts.length; i++) {
            let shortOpenValue = (this.#shorts[i].quantity * this.#shorts[i].open) / this.#leverage;
            tradeValue += shortOpenValue;
        }

        tradeValue += this.getPNL();

        return tradeValue;

    }

    getPNL = () => {
        
        let result = 0;
        for(let i = 0; i< this.#longs.length; i++) {
            let longOpenValue = (this.#longs[i].quantity * this.#longs[i].open) / this.#leverage;
            let longCurrentValue = (this.#longs[i].quantity * this.#currentPrice) / this.#leverage;
            result += longCurrentValue - longOpenValue;
        }

        for(let i = 0; i< this.#shorts.length; i++) {
            let shortOpenValue = (this.#shorts[i].quantity * this.#shorts[i].open) / this.#leverage;
            let shortCurrentValue = (this.#shorts[i].quantity * this.#currentPrice) / this.#leverage;
            result += shortOpenValue - shortCurrentValue;
        }

        return result * this.#leverage;

    }

}

module.exports = DemoService