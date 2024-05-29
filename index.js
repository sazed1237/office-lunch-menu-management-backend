const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')

const app = express()
const port = process.env.PORT || 5000


// middleware 
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}))
app.use(express.json())
app.use(cookieParser())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hhlnjmu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// console.log(uri)

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

        const userCollections = client.db("officeLunchManagement").collection("users");
        const menuCollections = client.db("officeLunchManagement").collection("menus");
        const bookingCollections = client.db("officeLunchManagement").collection("booking");


        // verifyJWT
        const verifyJWT = async (req, res, next) => {
            try {

                const token = req.cookies?.token
                // console.log(" in verifyJwt", token)

                if (!token) {
                    return res.status(401).json({
                        message: "Please login",
                        error: true,
                        success: false
                    })
                }

                // verify current user requested token is valid
                jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
                    if (err) {
                        return res.status(401).json({
                            message: "Invalid or expired token. Please login again",
                            error: true,
                            success: true
                        })
                    }

                    req.decoded = decoded
                    // console.log(decoded)
                    next()
                })

            } catch (error) {
                res.status(400).json({
                    message: error.message || error,
                    error: true,
                    success: false,
                    data: []
                })
            }
        }


        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollections.findOne(query)
            const isAdmin = user?.role === 'ADMIN'

            if (!isAdmin) {
                return res.status(403).json({
                    message: "Access denied",
                    error: true,
                    success: false
                })
            }

            next()
        }


        // user routes
        app.get('/all-users', verifyJWT, verifyAdmin, async (req, res) => {
            const users = await userCollections.find().toArray()
            res.json({
                message: "all users",
                success: true,
                error: true,
                data: users
            })
        })

        // make admin
        app.patch('/user/admin', verifyJWT, verifyAdmin, async (req, res) => {
            const userDetails = req.body;
            // console.log(userDetails)
            const id = userDetails.userId
            const filter = { _id: new ObjectId(id) }
            const updateRole = {
                $set: {
                    role: userDetails.role
                }
            }

            const result = await userCollections.updateOne(filter, updateRole)

            res.json({
                message: "Update User Role",
                success: true,
                error: false,
                data: result
            })
        })

        app.get('/user-details', verifyJWT, async (req, res) => {
            try {

                // const email = req.params.email;
                // console.log(email)

                // if (email !== req.decoded.email) {
                //     return res.status(403).json({
                //         message: 'forbidden access',
                //         error: true,
                //         success: false
                //     })
                // }

                const email = req.decoded.email

                const query = { email: email }
                const user = await userCollections.findOne(query)

                res.json({
                    message: 'User details',
                    success: true,
                    error: false,
                    data: user
                })

            } catch (error) {
                res.status(400).json({
                    message: error.message || message,
                    error: true,
                    success: false
                })
            }
        })

        app.delete('/user/:id', async (req, res) => {
            const id = req.params.id
            console.log(id)

            const filter = { _id: new ObjectId(id) }
            const result = await userCollections.deleteOne(filter)

            res.json({
                message: "user deleted successful",
                success: true,
                error: false,
                data: result
            })
        })


        app.post('/sing-up', async (req, res) => {
            try {

                const user = req.body;
                console.log(user)
                const { email } = user
                const query = { email: email }
                const existUser = await userCollections.findOne(query)

                if (existUser) {
                    return res.status(400).json({
                        message: 'user already exists',
                        success: false,
                        error: true
                    })
                }
                const result = await userCollections.insertOne(user)

                // set token
                const tokenData = {
                    email: existUser?.email
                }

                // token 
                const token = jwt.sign(tokenData, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5h' })

                const tokenOption = {
                    httpOnly: true,
                    secure: true,
                    sameSite: "None"
                }

                return res.cookie("token", token, tokenOption).json({
                    message: 'User created successful',
                    success: true,
                    error: false,
                    token: token,
                    data: result
                })

            } catch (error) {
                res.status(400).json({
                    message: error.message || message,
                    error: true,
                    success: false
                })
            }
        })


        app.post('/login', async (req, res) => {
            try {
                const user = req.body
                const query = { email: user.email }
                const existUser = await userCollections.findOne(query)

                if (existUser) {
                    if (existUser.password === user.password) {

                        const tokenData = {
                            _id: existUser._id,
                            email: existUser.email
                        }

                        // token 
                        const token = jwt.sign(tokenData, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5h' })

                        const tokenOption = {
                            httpOnly: true,
                            secure: true,
                            sameSite: "None"
                        }

                        return res.cookie("token", token, tokenOption).json({
                            message: 'login successful',
                            success: true,
                            error: false,
                            token: token,
                            data: existUser
                        })

                    } else {

                        return res.status(400).json({
                            message: 'Please check password',
                            success: false,
                            error: true
                        })
                    }
                } else {
                    res.status(400).json({
                        message: 'User not found',
                        success: false,
                        error: true
                    })
                }
            } catch (error) {
                res.status(400).json({
                    message: error.message || message,
                    error: true,
                    success: false
                })
            }
        })


        app.get('/logout', async (req, res) => {
            try {
                res.clearCookie('token')
                res.json({
                    message: "Logout successful",
                    error: false,
                    success: true,
                    data: []
                })
            } catch (error) {
                res.status(400).json({
                    message: error.message || message,
                    error: true,
                    success: false
                })
            }
        })


        // menu Routes
        app.get('/menus', async (req, res) => {
            try {
                const menu = await menuCollections.find().toArray()

                res.status(200).json({
                    message: "All Menus Data",
                    success: true,
                    error: false,
                    data: menu
                })

            } catch (error) {
                res.json({
                    message: error.message || error,
                    error: true,
                    success: false,
                })
            }
        })

        // get menu by date
        app.post('/menus-by-date', async (req, res) => {
            const date = req.body;
            // console.log(date)

            const query = { date: date?.date }
            const menus = await menuCollections.find(query).toArray()
            // console.log("exits menu", menus)

            res.json({
                message: "Menus by Date",
                success: true, 
                error: false,
                data: menus
            })
        })

        app.get('/menu/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await menuCollections.findOne(query)
            res.send(result)
        })

        app.post('/upload-menu', verifyJWT, verifyAdmin, async (req, res) => {
            const menu = req.body;
            const result = await menuCollections.insertOne(menu)

            res.json({
                message: "Menu uploaded successfully",
                error: false,
                success: true,
                data: result
            })

        })

        app.delete('/menu/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id
            console.log(id)

            const filter = { _id: new ObjectId(id) }
            const result = await menuCollections.deleteOne(filter)

            res.json({
                message: "deleted successful",
                success: true,
                error: false,
                data: result
            })
        })


        // booking lunch
        app.get('/booking', verifyJWT, verifyAdmin, async (req, res) => {
            const booking = await bookingCollections.find().toArray()

            res.send(booking)
        })


        app.post('/booking-lunch', verifyJWT, async (req, res) => {
            const booking = req?.body;
            console.log(booking)

            const query = { email: booking.email, date: booking.date }
            const existBooking = await bookingCollections.findOne(query)
            // console.log("exist", existBooking)
            // check the multiple lunch order one day
            if (existBooking) {
                return res.json({
                    message: "already booked today lunch",
                    error: true,
                    success: false
                })
            }

            const bookingConfirm = await bookingCollections.insertOne(booking)


            res.json({
                message: "Your lunch booking confirm",
                success: true,
                error: false,
                data: bookingConfirm
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





app.get('/', async (req, res) => {
    res.send('welcome to lunch')
})

app.listen(port, () => {
    console.log(`app is running on ${port}`)
})