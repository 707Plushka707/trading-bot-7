const mongoose = require('mongoose');

init = () => {
    // mongoose.connect(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.d515z.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`, {
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