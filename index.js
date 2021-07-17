require('dotenv').config();
const publicIp = require('public-ip');

(async () => {
	console.log(await publicIp.v4());
	//=> '46.5.21.123'

	console.log(await publicIp.v6());
	//=> 'fe80::200:f8ff:fe21:67cf'
})();

const express = require('express')
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