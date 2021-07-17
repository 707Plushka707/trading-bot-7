require('dotenv').config();

const express = require('express')
const { init:initDb } = require('./startup/database');


const app = express()
const port = process.env.PORT || 3000;

initDb();
  
app.get ("/", function (req,res) {
	res.render ( "index.ejs" );	
});

app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`)
})