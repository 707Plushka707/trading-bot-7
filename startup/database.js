const mongoose = require('mongoose');

init = () => {
    mongoose.connect(process.env.DB_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useFindAndModify: false,
        useCreateIndex: true})
    .then(() => {
        console.log("Connected to mongoDB")
    }).catch(() => {
        console.log("Could not connect to mongoDB")
    });
}

module.exports = { init };