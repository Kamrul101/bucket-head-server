const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()

const jwt = require('jsonwebtoken');

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req,res,next)=>{
  const authorization = req.headers.authorization;
  if(!authorization){
    return res.status(401).send({error: true, message: 'unauthorized access'});
  }

  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET,(err, decoded)=>{
    if(err){
      return res.status(401).send({error: true, message: 'unauthorized access'})
    }
    req.decoded = decoded;
    next();
  })
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kjhm1xo.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();



    const classCollection = client.db("schoolDB").collection("class");
    // const instructorCollection = client.db("schoolDB").collection("instructor");
    const cartCollection = client.db("schoolDB").collection("cart");

    app.post('/jwt', (req,res)=>{
      const user = req.body;
      const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET, { expiresIn:'1h'})
      res.send({token}) 
    })

    app.get('/class',async(req,res)=>{
        const result = await classCollection.find().toArray();
        res.send(result);
    })

    app.get('/cart',async(req,res)=>{
        const email = req.query.email;
        
        if(!email){
          res.send([]);
        }
        const query = {email: email};
        const result = await cartCollection.find(query).toArray();
        res.send(result)
      });

    app.post('/cart',async (req,res)=>{
        const item = req.body;
        const result = await cartCollection.insertOne(item);
        res.send(result);
      })

      app.delete('/cart/:id',async(req,res)=>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)}
        const result = await cartCollection.deleteOne(query);
        res.send(result)
      })
  
  
    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req,res)=>{
    res.send('School running')
})
app.listen(port, ()=>{
    console.log(`School is running at ${port}`);
})
