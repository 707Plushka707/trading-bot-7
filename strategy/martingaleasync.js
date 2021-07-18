const DummyService = require('../service/dummy.js');
const DummyWSService = require('../service/dummyws.js');
const DemoService = require('../service/demo');
const BinanceService = require('../service/binance');
const date = require('date-and-time');
const { LogModel } = require('../model/log')
const EventEmmiter = require('events');

const fs = require('fs');

class MartingaleSyncStrategy extends EventEmmiter {
    
    firstBalance = -1;

    binanceService;

    totalTrades;

    positionPercent;
    positionAmount;
    positionQuantity
    
    targetPercent;
    targetPriceDistance;

    symbol;

    longs = new Array();
    shorts = new Array();

    startTime;
    firstPostionTime;

    worstPNL = 0;
    closeCount = 0;
    maxMartigaleCount = 0;
    maxMinutes = 0;
    tradeCount = 0;

    lock = false;
    lockcount = 0;

    logPriceCounter = 0;

    //----------------
    
    constructor(params) {
        super();
        this.symbol = params.symbol;
        this.positionPercent = params.positionPercent ? params.positionPercent : 0.01;
        this.targetPercent = params.targetPercent ? params.targetPercent : 0.5;
        
        let binanceParams = {};
        binanceParams.symbol = this.symbol;
        if(params.leverage) {
            binanceParams.leverage = params.leverage;
            binanceParams.strategy = this;
        }

        if(params.mode == 'binance') {
            this.binanceService = new BinanceService(binanceParams);
        } else if (params.mode == 'demo') {
            this.binanceService = new DemoService(binanceParams);
        } else if (params.mode == 'dummyws') {
            this.binanceService = new DummyWSService(binanceParams);
        } else {
            this.binanceService = new DummyService(binanceParams);
        }
    }
    
    //----------------

    init = async () => {
        if(this.binanceService.init) {
            await this.binanceService.init();
        }
    }

    logPrice = async (markPrice, currentTime) => {
        this.logPriceCounter++;



        if (this.logPriceCounter == 10) {
            const balanceAndPnl = await this.binanceService.getBalanceAndPnl();

            const cnt = this.longs.length + this.shorts.length;

            if(this.firstBalance == -1) {
                this.firstBalance = balanceAndPnl.balance
            }

            let diff = balanceAndPnl.balance - this.firstBalance;

            let log = '';
            log += `${date.format(currentTime, 'YYYY/MM/DD HH:mm:ss')} - price : ${markPrice} - next long : ${this.getNextLongPrice()} - next short : ${this.getNextShortPrice()}`;
            log += ` - balance : ${balanceAndPnl.balance} - pnl : ${balanceAndPnl.pnl} - target : ${this.getTargetPnl()}`;
            log += ` - martingale cnt : ${cnt} - diff balance : ${diff}`;
            console.log(log);

            var logModel = new LogModel({
                time: date.format(currentTime, 'YYYY/MM/DD HH:mm:ss'),
                symbol:this.symbol,
                price: markPrice,
                nextLong: this.getNextLongPrice(),
                nextShort: this.getNextShortPrice(),
                balance: balanceAndPnl.balance,
                pnl: balanceAndPnl.pnl,
                target: this.getTargetPnl(),
                martinGaleCnt: cnt,
                diffBalance: diff
            })
            await logModel.save();

            this.logPriceCounter = 0;
        }

    }


    start = () => {
        let line = 0;
        this.binanceService.listen(async (e) => {

            if(this.lock) {
                this.lockcount++;
                return;
            }

            if(!this.positionAmount) {
                this.positionAmount = await this.binanceService.getBalance() * this.positionPercent * await this.binanceService.getLeverage();
            }
            
            this.lock = true;

            let markPrice = parseFloat(e.markPrice);
            let currentTime = new Date(e.time);

            await this.logPrice(markPrice, currentTime);

            if(!this.startTime) {
                this.startTime = currentTime;
            }

            // open first martingale
            if(this.longs.length == 0 && this.shorts.length == 0) {

                if(this.checkStop()) {
                    this.emit('endprice');

                    this.lock = false;
                    return;
                }

                await this.openFirst(markPrice, currentTime);
                this.emit('endprice');

                this.lock = false;
                return;
            }

            // check trade value
            const myPNL = await this.binanceService.getPNL();
            if(myPNL < this.worstPNL) {
                this.worstPNL = myPNL;
            }

            if(myPNL >= this.getTargetPnl()) {

                await this.closeAll(myPNL, currentTime);

                if(this.checkStop()) {
                    this.emit('endprice');
                    this.lock = false;
                    return;
                }

                await this.openFirst(markPrice, currentTime);
                this.emit('endprice');
                this.lock = false;
                return;
            }
            
            if(markPrice >= this.getNextLongPrice()) {
                await this.openLong(markPrice, currentTime);
                this.emit('endprice');
                this.lock = false;
                return;
            }
            
            if(markPrice <= this.getNextShortPrice()) {
                await this.openShort(markPrice, currentTime);
                this.emit('endprice');
                this.lock = false;
                return;
            }
            
            this.lock = false;
            this.emit('endprice');
        });

        // console.log("end martingale strategy");

    }


    //----------------

    getTargetPnl = ()  => {
        return this.targetPriceDistance * (this.positionQuantity)
    }

    checkStop = () => 
    {
        const commandFilePath = 'commant.txt';
        if(fs.existsSync(commandFilePath)){
            
            const data = fs.readFileSync(commandFilePath,{encoding:'utf8', flag:'r'});
            const lines = data.split('\n');
            if(lines.length > 0) {
                return (lines[0] == 'stop');
            }
        }
        return false;

    }

    closeAll = async (myPNL, currentTime) => {
        return new Promise(async (resolve, reject) => {
            this.saveStats(currentTime);
            await this.binanceService.closeAll();
            this.longs = new Array();
            this.shorts = new Array();
            this.logClose(myPNL, currentTime);
            this.emit('close', {
                symbol:this.symbol,
                pnlDone:myPNL,
                balance: await this.binanceService.getBalance(),
                timeElapsed:this.getDiffDateInMinutes(currentTime, this.startTime) / 60,
                maxHourClose:this.maxMinutes / 60,
                worstPNL:this.worstPNL,
                closeCount:this.closeCount,
                maxMartigaleCount:this.maxMartigaleCount,
                tradeCount:this.tradeCount,
            });
            resolve();
        });
    }

    saveStats = (currentTime) => {
        this.closeCount++;
        if(this.shorts.length + this.longs.length > this.maxMartigaleCount) {
            this.maxMartigaleCount = this.shorts.length + this.longs.length;
        }
        let minutes = this.getDiffDateInMinutes(currentTime, this.firstPostionTime)
        if(minutes > this.maxMinutes) {
            this.maxMinutes = minutes;
        }
    }

    getDiffDateInMinutes = (date1, date2) => {
        var diff = Math.abs(date1.getTime() - date2.getTime()) / 3600000 * 60
        return diff;
    }

    logClose = async (pnlDone, currentTime) => {
        return new Promise(async (resolve, reject) => {
            console.log("===================");
            console.log("==== CLOSE ALL ====");
            console.log("===================");
            console.log("= pnlDone : " + pnlDone);
            console.log("= balance : " + await this.binanceService.getBalance());
            console.log("= time elapled = " + this.getDiffDateInMinutes(currentTime, this.startTime) / 60);
            console.log("= max hours to close = " + this.maxMinutes / 60);
            console.log("= worstPNL : " + this.worstPNL);
            console.log("= closeCount : " + this.closeCount);
            console.log("= maxMartigaleCount : " + this.maxMartigaleCount);
            console.log("= tradeCount = " + this.tradeCount);
            console.log("= lockcount = " + this.lockcount);
            console.log("===================");
            resolve();
        })
    }

    openFirst = async (markPrice, currentTime) => {
        return new Promise(async (resolve, reject) => {
            this.targetPriceDistance = markPrice * this.targetPercent;
    
            // comment out to stop exponentielle
            this.positionAmount = await this.binanceService.getBalance() * this.positionPercent * await this.binanceService.getLeverage();
            
            this.positionQuantity = parseFloat(this.positionAmount / markPrice).toFixed(3);
            console.log(" ** positionAmount " + this.positionAmount)
            console.log(" ** positionQuantity " + this.positionQuantity)
            console.log(" ** targetPercent " + this.targetPercent)
            console.log(" ** targetPriceDistance " + this.targetPriceDistance)
            this.firstPostionTime = currentTime;
            resolve(await this.openLong(markPrice, currentTime));
        })
    }

    openLong = async (markPrice, time) => {
        return new Promise(async (resolve, reject) => {
            this.tradeCount++;
            const long = await this.binanceService.open('long', this.positionQuantity, markPrice);
            this.longs.push(long);
            console.log("OPEN LONG : time " + time + ", " + markPrice + ", next : " + this.getNextLongPrice() + ", pnl : " + await this.binanceService.getPNL());
            resolve();
        })
    }

    openShort = async (markPrice, time) => {
        return new Promise(async (resolve, reject) => {
            this.tradeCount++;
            const short = await this.binanceService.open('short', this.positionQuantity, markPrice);
            this.shorts.push(short);
            console.log("OPEN SHORT : time " + time + ", " + markPrice + ", next : " + this.getNextShortPrice() + ", pnl : " + await this.binanceService.getPNL());
            resolve();
        })
    }

    getNextLongPrice = () => {
        if(this.longs.length == 0 && this.shorts.length == 0) {
            return 0;
        }
        const maxLong = this.longs.length == 0 ? this.shorts[this.shorts.length - 1].open : this.longs[this.longs.length - 1].open;
        return maxLong + (this.targetPriceDistance);
    }
    
    getNextShortPrice = () => {
        if(this.longs.length == 0 && this.shorts.length == 0) {
            return 0;
        }
        const minShort = this.shorts.length == 0 ? this.longs[this.longs.length - 1].open : this.shorts[this.shorts.length - 1].open;
        return minShort - (this.targetPriceDistance);
    }
} 

module.exports = MartingaleSyncStrategy