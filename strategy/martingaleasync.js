const DummyService = require('../service/dummy.js');
const DummyWSService = require('../service/dummyws.js');
const DemoService = require('../service/demo');
const BinanceService = require('../service/binance');
const date = require('date-and-time');
const { PriceLogModel } = require('../model/priceLog')
const { TradeLogModel } = require('../model/tradeLog')
const { StratLogModel } = require('../model/stratLog')
const { fileLogger } = require('../utils/logger')
const EventEmmiter = require('events');

const fs = require('fs');

class MartingaleSyncStrategy extends EventEmmiter {
    

    // Service
    binanceService;

    // Parameters
    positionPercent;
    positionAmount;
    positionQuantity
    
    targetPercent;
    targetPriceDistance;

    symbol;

    // positions
    longs = new Array();
    shorts = new Array();

    // global stats 
    firstBalance = -1;
    firstPostionTime;
    worstPNL = 0;
    maxMinutes = 0;
    closeCount = 0;
    maxMartigaleCount = 0;

    // Current trade stats
    startTime;
    martingaleCount = 0;
    
    //  technical
    lock = false;
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


    start = () => {
        this.binanceService.listen(async (e) => {

            if(this.lock) {
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
            
            // TODO
            // timeElapsed:this.getDiffDateInMinutes(currentTime, this.startTime) / 60,
            // maxHourClose:this.maxMinutes / 60,
            // worstPNL:this.worstPNL,
            // closeCount:this.closeCount,

            resolve();
        });
    }

    openFirst = async (markPrice, currentTime) => {
        return new Promise(async (resolve, reject) => {
            this.targetPriceDistance = markPrice * this.targetPercent;
    
            // comment out to stop exponentielle
            this.positionAmount = await this.binanceService.getBalance() * this.positionPercent * await this.binanceService.getLeverage();
            
            this.positionQuantity = parseFloat(this.positionAmount / markPrice).toFixed(3);
            let log = "";
            log += (" ** positionAmount " + this.positionAmount)
            log += (" ** positionQuantity " + this.positionQuantity)
            log += (" ** targetPercent " + this.targetPercent)
            log += (" ** targetPriceDistance " + this.targetPriceDistance)
            fileLogger.info(log);
            this.firstPostionTime = currentTime;
            resolve(await this.openLong(markPrice, currentTime));
        })
    }

    openLong = async (markPrice, time) => {
        return new Promise(async (resolve, reject) => {
            this.martingaleCount++;
            const long = await this.binanceService.open('long', this.positionQuantity, markPrice);
            this.longs.push(long);
            fileLogger.info("OPEN LONG : time " + time + ", " + markPrice + ", next : " + this.getNextLongPrice() + ", pnl : " + await this.binanceService.getPNL());
            resolve();
        })
    }

    openShort = async (markPrice, time) => {
        return new Promise(async (resolve, reject) => {
            this.martingaleCount++;
            const short = await this.binanceService.open('short', this.positionQuantity, markPrice);
            this.shorts.push(short);
            fileLogger.info("OPEN SHORT : time " + time + ", " + markPrice + ", next : " + this.getNextShortPrice() + ", pnl : " + await this.binanceService.getPNL());
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

    // ----------------------------------

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

    logPrice = async (markPrice, currentTime) => {
        this.logPriceCounter++;

        if (this.logPriceCounter == 10) {
            const balanceAndPnl = await this.binanceService.getBalanceAndPnl();

            if(this.firstBalance == -1) {
                this.firstBalance = balanceAndPnl.balance
            }

            const minutesElapsed = this.getDiffDateInMinutes(currentTime, this.firstPostionTime);

            // -------------
            // Console log
            // -------------

            let log = '';
            log += `${date.format(currentTime, 'YYYY/MM/DD HH:mm:ss')} - price : ${markPrice}`;
            log += ` - next long : ${this.getNextLongPrice()} - next short : ${this.getNextShortPrice()}`;
            log += ` - balance : ${balanceAndPnl.balance} - pnl : ${balanceAndPnl.pnl} - target : ${this.getTargetPnl()}`;
            log += ` - hours elapsed : ${(minutesElapsed / 60)}`;
            log += ` - martingale cnt : ${this.martingaleCount} - diff balance : ${this.firstBalance - balanceAndPnl.balance + balanceAndPnl.pnl}`;
            log += ` - max cnt : ${this.maxMartigaleCount} - worst pnl : ${this.worstPNL} - max hours : ${(this.maxMinutes/60)}`;
            fileLogger.info(log);

            // -------------
            // Price log
            // -------------

            let priceLogModel = new PriceLogModel({
                time: currentTime,
                symbol:this.symbol,
                price: markPrice,
                nextLong: this.getNextLongPrice(),
                nextShort: this.getNextShortPrice(),
                martingaleCount: this.martingaleCount,
                minutesElapsed: minutesElapsed,
                target: this.getTargetPnl(),
                pnl: balanceAndPnl.pnl,
                balance: balanceAndPnl.balance,
                netValue: balanceAndPnl.balance + balanceAndPnl.pnl,
                startBalance: this.firstBalance
            })
            await priceLogModel.save();

            // -------------
            // Trade log
            // -------------

            let tradeLogFilter = {
                startTime: this.firstPostionTime,
                symbol: this.symbol,
            };
            let tradeLog = {
                pnl:balanceAndPnl.pnl,
                minutesElapsed:minutesElapsed,
                martingaleCount:this.maxMartigaleCount,
                startBalance:this.firstBalance
            };
            await TradeLogModel.findOneAndUpdate(tradeLogFilter, tradeLog, {
                upsert: true // Make this update into an upsert
            });

            this.logPriceCounter = 0;
        }
    }

    logClose = async (pnlDone, currentTime) => {
        return new Promise(async (resolve, reject) => {
            let log = "";
            log += ("===================");
            log += ("==== CLOSE ALL ====");
            log += ("===================");
            log += ("= pnlDone : " + pnlDone);
            log += ("= balance : " + await this.binanceService.getBalance());
            log += ("= time elapled = " + this.getDiffDateInMinutes(currentTime, this.startTime) / 60);
            log += ("= max hours to close = " + this.maxMinutes / 60);
            log += ("= worstPNL : " + this.worstPNL);
            log += ("= closeCount : " + this.closeCount);
            log += ("= maxMartigaleCount : " + this.maxMartigaleCount);
            log += ("= martingaleCount = " + this.martingaleCount);
            log += ("===================");
            fileLogger.info(log);
            
            // -------------
            // Strat log
            // -------------

            let stratLogModel = await StratLogModel.findOne({symbol:this.symbol});
            if(!stratLogModel) {
                stratLogModel = new StratLogModel({
                    symbol:this.symbol,
                    worstPNL:this.worstPNL,
                    maxMinutes:this.maxMinutes,
                    maxMartingale:this.maxMartigaleCount,
                    closeCount:this.closeCount,
                    totalPnl:pnlDone
                })
            } else {
                stratLogModel.set({
                    symbol:this.symbol,
                    worstPNL:this.worstPNL,
                    maxMinutes:this.maxMinutes,
                    maxMartingale:this.maxMartigaleCount,
                    closeCount:this.closeCount,
                    totalPnl:pnlDone+parseFloat(stratLogModel.totalPnl)
                });
            }

            await stratLogModel.save();

            resolve();
        })
    }

    getDiffDateInMinutes = (date1, date2) => {
        var diff = Math.abs(date1.getTime() - date2.getTime()) / 3600000 * 60
        return diff;
    }
} 

module.exports = MartingaleSyncStrategy