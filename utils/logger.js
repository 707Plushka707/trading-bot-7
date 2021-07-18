const { createLogger, format, transports } = require('winston');
const { combine, splat, timestamp, printf } = format;

const myFormat = printf( ({ level, message, timestamp , ...metadata}) => {
    let msg = `${timestamp} [${level}] : ${message} `  
    if(metadata) {
      msg += JSON.stringify(metadata)
    }
    return msg
  });

const consoleLogger = createLogger({
    level: 'debug',
    format: combine(
      splat(),
      timestamp(),
      myFormat
    ),
    transports: [
      new transports.Console(),
    ]
});

const fileLogger = createLogger({
    format: combine(
        splat(),
        timestamp(),
        myFormat
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: process.env.LOG_FILE, maxsize: 100000, maxFiles: 10 }),
    ]
});

module.exports = { consoleLogger, fileLogger };