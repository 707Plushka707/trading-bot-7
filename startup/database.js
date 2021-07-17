const mongoose = require('mongoose');

init = () => {
    console.log("connection to : " + process.env.DB_URL)
    mongoose.connect(process.env.DB_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useFindAndModify: false,
        useCreateIndex: true})
    .then(() => {
        console.log("Connected to mongoDB")
    }).catch((err) => {
        console.log("Could not connect to mongoDB", err)
    });
}

module.exports = { init };