const mongoose = require('mongoose');
const format = require('string-format')
const { consoleLogger, fileLogger } = require('../utils/logger')

init = () => {
    const connectionString = format(process.env.DB_URL, process.env.DB_USER, process.env.DB_PASS, process.env.DB_NAME)
    mongoose.connect(connectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useFindAndModify: false,
        useCreateIndex: true})
    .then(() => {
        consoleLogger.info("Connected to mongoDB")
    }).catch((err) => {
        consoleLogger.error("Could not connect to mongoDB", err)
    });
}

module.exports = { init };