const fs = require('fs');
const EventEmmiter = require('events');
const Binance = require('node-binance-api');
const {sleep} = require('../sleep');
const io = require("socket.io-client");
const { resolve } = require('path');

const binance = new Binance().options({
    APIKEY: process.env.API_KEY,
    APISECRET: process.env.API_SECRET,
    hedgeMode: true,
    test: process.env.TEST_MODE == 1 ? true : false
});

const TRANSACTION_FEE = 0.0004;

class DummyWSService extends EventEmmiter {

    #currentPrice;
    #currentTime;

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
        const socket = io("http://localhost:3000");

        socket.emit("listen", {symbol:"BNBUSDT"});
        socket.on("end", async (data) => {
            console.log(" >> END OF DATA");
        });
        socket.on("markprice", async (data) => {
            this.#currentTime = data.time;
            this.#currentPrice = data.markPrice;

            let log = data.time + ' - ';
            log += 'price : ' + data.markPrice + ' - ';
            log += 'pnl : ' + await this.getPNL() + ' - ';

            //console.log(log);

            if(callback) {
                callback(data);
            }
        });

        setInterval(async () => { 
            console.log("* Current time : " + this.#currentTime
            + ", Current price : " + this.#currentPrice
            + ", balance : " + await this.getBalance()
            + ", pnl : " + await this.getPNL())
        }, 5000);
        
        return;
    }

    open = async (side, quantity) => {
        
        return new Promise((resolve, reject) => {
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
    
                resolve(this.#longs[this.#longs.length - 1]);
            } else {
                this.#shorts.push({
                    open:this.#currentPrice,
                    quantity: quantity
                });
    
                resolve(this.#shorts[this.#shorts.length - 1]);
            }
        })
    }

    closeAll = async () => {

        return new Promise(async (resolve, reject) => {
            this.balance -= await this.getTransactionFeeOnClose();
            this.#balance += await this.getTradeValue();
            this.#longs = new Array();
            this.#shorts = new Array();
            resolve();
        })
    }

    getBalance = async () => {
        return new Promise((resolve, reject) => { resolve(this.#balance) });
    }

    setBalance = (balance) => {
        this.#balance = balance;
    }

    getLeverage = async () => {
        return new Promise((resolve, reject) => { resolve(this.#leverage) });
    }


    //--------------

    getTransactionFeeOnClose = async () => {
        
        return new Promise((resolve, reject) => {

            let fee = 0;

            for(let i = 0; i< this.#longs.length; i++) {
                let longCurrentValue = (this.#longs[i].quantity) * this.#currentPrice;
                fee += longCurrentValue * TRANSACTION_FEE;
            }
    
            for(let i = 0; i< this.#shorts.length; i++) {
                let shortCurrentValue = (this.#shorts[i].quantity) * this.#currentPrice;
                fee += shortCurrentValue * TRANSACTION_FEE;
            }
    
            resolve(fee);
        } )

    }

    getTradeValue = async () => {
        
        return new Promise(async (resolve, reject) => {
            let tradeValue = 0;
    
            for(let i = 0; i< this.#longs.length; i++) {
                let longOpenValue = (this.#longs[i].quantity * this.#longs[i].open) / this.#leverage;
                tradeValue += longOpenValue;
            }
    
            for(let i = 0; i< this.#shorts.length; i++) {
                let shortOpenValue = (this.#shorts[i].quantity * this.#shorts[i].open) / this.#leverage;
                tradeValue += shortOpenValue;
            }
    
            tradeValue += await this.getPNL();
    
            resolve(tradeValue);
        });

    }

    getPNL = async () => {
        
        return new Promise((resolve, reject) => {
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
    
            resolve(result * this.#leverage);
        })

    }

}

module.exports = DummyWSService