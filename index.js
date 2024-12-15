require('dotenv').config()
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1tebz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const app = express()

const port = process.env.PORT || 3000;

app.use(cors())
app.use(express.json())





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
    await client.connect();


    app.post('/jwt', async(req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})
      res.send({token})
    })

    const verifyToken = (req, res, next) => {
      if(!req.headers.authorization){
        return res.status(401).send({message: 'unauthorized access'})
      }
      const token = req.headers.authorization.split(' ')[1]
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if(err){
          return res.status(401).send({message: 'unauthorized access'})
        }
        req.decoded = decoded
        next()
      })
    }
    const verifyAdmin = async(req, res, next) => {
      const email = req.decoded.email
      const query = {email: email}
      const user = await usersCollection.findOne(query)
      const isAdmin = user?.role === 'admin'
      if(!isAdmin) {
        return res.status(403).send({message: 'forbidden access'})
      }
      next()
    }
    const FoodMenuCollection = client.db('BistroBoss').collection('foodMenu')
    const CartCollection = client.db('BistroBoss').collection('cart')
    const usersCollection = client.db('BistroBoss').collection('users')
    const PaymentCollection = client.db('BistroBoss').collection('payment')

    app.get('/foodMenu', async(req, res) => {
        let query = {}
        if(req.query.category)
        {
            query.category = {$regex: req.query.category, $options: "i"}
        }
        if(req.query.page)
        {
          const page = parseInt(req.query.page) || 1;
          const limit = parseInt(req.query.limit) || 10;
          const skip = (page - 1) * limit;
          const cursor = FoodMenuCollection.find(query).skip(skip).limit(limit)
          const result = await cursor.toArray()
          const totalItems = await FoodMenuCollection.countDocuments(query)
          return res.send({
            data: result,
            totalItems,
            totalPage: Math.ceil(totalItems / limit),
            currentPage: page
          })
        }
        const skip = parseInt(req.query.skip) || 0
        const limit = parseInt(req.query.limit) || 0
        const cursor = FoodMenuCollection.find(query).skip(skip).limit(limit)
        const result = await cursor.toArray()
        res.send(result)
    })
    app.get('/foodMenu/:id', async(req, res) => {
      const id = req.params.id
      const filter = {_id: new ObjectId(id)}
      const result = await FoodMenuCollection.findOne(filter)
      res.send(result)
    })
    app.post('/foodMenu', verifyToken, verifyAdmin, async(req,res) => {
        const food = req.body
        const result = await FoodMenuCollection.insertOne(food)
        res.send(result)
    })
    app.patch('/foodMenu/:id', async(req, res) => {
      const item = req.body
      console.log(item)
      const id = req.params.id
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          name: item.name,
          recipe: item.recipe,
          image: item.image,
          category: item.category,
          price: item.price,
        }
      }
      const result = await FoodMenuCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    app.delete('/foodMenu/:id', async(req, res) => {
      const id = req.params.id
      const filter = {_id: new ObjectId(id)}
      const result = await FoodMenuCollection.deleteOne(filter)
      res.send(result)
    })

    app.get('/cart', async(req,res) => {
      if(req.query.email) {
        const query = {email: req.query.email}
        const result = await CartCollection.find(query).toArray()
        return res.send(result)
      }
      const result = await CartCollection.find().toArray()
      return res.send(result)
    })
    app.get('/cart/:id', async(req, res) => {
      const id = req.params.id
      const filter = {_id: new ObjectId(id)}
      const result = await CartCollection.findOne(filter)
      res.send(result)

    })
    app.post('/cart', async(req, res) => {
      const food = req.body
      const result = await CartCollection.insertOne(food)
      res.send(result)
    })
    app.delete('/cart/:id', async(req, res) => {
      const id = req.params.id
      const filter = {_id : new ObjectId(id)}
      const result = await CartCollection.deleteOne(filter)
      res.send(result)
    })
    
    app.get('/users', verifyToken,verifyAdmin, async(req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    app.post('/users', async(req, res) => {
      const user = req.body
      const query = {email: user.email}
      const existingUser = await usersCollection.findOne(query)
      if(existingUser){
        return res.send({message: "user already exist"})
      }
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })
    app.delete('/users/:id', verifyToken, verifyAdmin, async(req, res) => {
      const id = req.params.id
      const filter = {_id: new ObjectId(id)}
      const result = await usersCollection.deleteOne(filter)
      res.send(result)
    })

    app.get('/users/admin/:email', verifyToken, async(req, res) => {
      const email = req.params.email;
      if(email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      const query = {email: email}
      const user = await usersCollection.findOne(query)
      let admin = false
      if(user) {
        admin = user?.role === 'admin'
      }
      res.send({admin})
    })

    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async(req, res) => {
      const id = req.params.id
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set:{
          role: 'admin',
        }
      }
      const result = await usersCollection.updateOne(filter, updateDoc)
      res.send(result)
    })


    app.post('/create-payment-intent', async(req, res) => {
      const {price} = req.body
      const amount = parseInt(price * 100)
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        payment_method_types: [
          "card"
        ],
      })
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    // payment

    app.post('/payment', async(req, res) => {
      const pay = req.body
      const paymentAddResult = await PaymentCollection.insertOne(pay)
      const query = {_id: {
        $in: pay.cartIds.map(id => new ObjectId(id))
      }}
      const deleteCartResult = await CartCollection.deleteMany(query)
      res.send({paymentAddResult, deleteCartResult})
    })

    app.get('/payment', verifyToken, async(req, res) => {
      if(req.query.email)
      {
        const query = {email: req.query.email}
        const result = await PaymentCollection.find(query).toArray()
        return res.send(result)
      }
      return verifyAdmin(req, res, async () => {
        const result = await PaymentCollection.find().toArray()
        return res.send(result)
      })
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




app.get('/', (req, res) => {
    res.send('running')
})
app.listen(port, () => {
    console.log(`running port : ${port}`)
})