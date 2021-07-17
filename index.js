require('dotenv').config();

const express = require('express')
const mongoose = require('mongoose');
const { init:initDb } = require('./startup/database');


const app = express()
const port = process.env.PORT || 3000;

initDb();
  
app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`)
})