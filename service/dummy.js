const fs = require('fs');
const EventEmmiter = require('events');

const folderPath = `D:/trading data/output4`;

const TRANSACTION_FEE = 0.0004;

class DummyService extends EventEmmiter {

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

    listen = async (callback, startTime) => {
        const fileList = fs.readdirSync(folderPath);
        for(let i = 0; i<fileList.length; i++) {

            const file = fileList[i];
            const subNames = file.replace('.txt', '').split('_');
            if(subNames[1] != this.#symbol) {
                continue;
            }
    
            const startTimeRead = new Date(...subNames[2].split('-'));
            if(startTime) {
                if(startTime > startTimeRead) {
                    continue;
                }
            }

            const data = fs.readFileSync(folderPath + '/' + file,{encoding:'utf8', flag:'r'});
            const lines = data.split('\n');
            for(let j = 0; j<lines.length; j++) {
                
                if(lines[j].trim() == '') {
                    continue;
                }

                const pricedetail = JSON.parse(lines[j]);

                if(this.#lastTime) {
                    if(pricedetail.time <= this.#lastTime) {
                        continue;
                    }
                }

                this.#currentPrice = pricedetail.markPrice;
                const pnl = this.getPNL();
                if(pnl > this.getBalance()) {
                    throw new Error('Trade Loss > Balance ! balance : ' + this.getBalance() + ', pnl : ' + pnl);
                }
                callback(pricedetail);
            }
        }
        console.log("end dummy service");
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

module.exports = DummyService