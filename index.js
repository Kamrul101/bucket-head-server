const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET)
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
    const instructorCollection = client.db("schoolDB").collection("instructor");
    const cartCollection = client.db("schoolDB").collection("cart");
    const usersCollection = client.db("schoolDB").collection("users");
    const paymentsCollection = client.db("schoolDB").collection("payments");

    app.post('/jwt', (req,res)=>{
      const user = req.body;
      const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET, { expiresIn:'1h'})
      res.send({token}) 
    })

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    //users
    app.get('/users',verifyJWT,verifyAdmin,async(req,res)=>{
      const result= await usersCollection.find().toArray();
      res.send(result)
    })

    app.post('/users',async(req,res)=>{
      const user = req.body;
      
      const query = {email:user.email}
      const existingUser = await usersCollection.findOne(query);
      console.log('existing user',existingUser);
      if(existingUser){
        return res.send({message: 'user already exist'})
      }
      const result= await usersCollection.insertOne(user);
      res.send(result);
    })

    app.get('/users/admin/:email',verifyJWT, async(req,res)=>{
      const email = req.params.email;

      if(req.decoded.email !== email){
        res.send({admin:false})
      }

      const query ={email:email}
      const user = await usersCollection.findOne(query);
      const result = {admin: user ?.role === 'admin'}
      res.send(result);
    })


    app.patch('/users/admin/:id',async(req,res)=>{
      // console.log(id);
      const id = req.params.id;
      const filter ={_id: new ObjectId(id)};
      const updatedDoc ={
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter,updatedDoc);
      res.send(result);
    })


    app.get('/users/instructor/:email',verifyJWT, async(req,res)=>{
      const email = req.params.email;
      if(req.decoded.email !== email){
        res.send({instructor:false})
      }
      const query ={email:email}
      const user = await usersCollection.findOne(query);
      const result = {instructor: user ?.role === 'instructor'}
      res.send(result);
    })

    app.patch('/users/instructor/:id',async(req,res)=>{
      // console.log(id);
      const id = req.params.id;
      const filter ={_id: new ObjectId(id)};
      const updatedDoc ={
        $set: {
          role: 'instructor'
        }
      }
      const result = await usersCollection.updateOne(filter,updatedDoc);
      res.send(result);
    })

    app.get('/class',async(req,res)=>{
        const result = await classCollection.find().toArray();
        res.send(result);
    })
    

    app.get('/cart',verifyJWT,async(req,res)=>{
        const email = req.query.email;
        
        if(!email){
          res.send([]);
        }
        const decodedEmail = req.decoded.email;
      if(email !==decodedEmail){
        return res.status(403).send({error: true, message: 'Forbidden access'})
      }
        const query = {email: email};
        const result = await cartCollection.find(query).toArray();
        res.send(result)
      });




    app.post('/class',async(req,res)=>{
      const newItem = req.body;
      const result = await classCollection.insertOne(newItem);
      res.send(result);
    })

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
       
      app.delete('/class/:id', verifyJWT, async(req,res)=>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)}
        const result = await classCollection.deleteOne(query);
        res.send(result);
      })

      //payment
      app.post('/create-payment-intent',verifyJWT,async(req,res)=>{
        const {price}= req.body;
        const amount = price *100;
        
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency:'usd',
          payment_method_types:['card']
        });
        res.send(
          {
            clientSecret: paymentIntent.client_secret,
          }
        )
      })
      app.get('/payments',  async (req, res) => {
        const email = req.query.email;
  
        if (!email) {
          res.send([]);
        }

        const query = { email: email };
        const result = await paymentsCollection.find(query).toArray();
        res.send(result);
      });

      app.post('/payments',verifyJWT,async(req,res)=>{
        const payment = req.body;
        const insertResult = await paymentsCollection.insertOne(payment);
        const query = {_id: {$in: payment.items.map(id=> new ObjectId(id))}}
        const deleteResult = await cartCollection.deleteMany(query)
        res.send({insertResult,deleteResult});
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
