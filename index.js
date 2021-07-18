
const start = async () => {

    const express = require('express')
    const app = express()
    const port = process.env.PORT || 3000;
      
    app.get ("/", function (req,res) {
        res.render ( "index.ejs" );	
    });
    
    app.listen(port, () => {
        console.log(`Listening at http://localhost:${port}`)
    })
}

start();
//------------
//------------
