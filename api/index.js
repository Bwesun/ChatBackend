import express from "express";
import cors from "cors";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, updateDoc, setDoc, query, where } from "firebase/firestore";
import { getAuth } from 'firebase/auth' //Authentication with firebase
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { body, validationResult } from 'express-validator';

dotenv.config()

if (!process.env.PAYSTACK_PUBLIC_KEY) {
  throw new Error("PAYSTACK_API_KEY is not defined in the environment variables.");
}

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet()); //To enforce HTTPS and other security headers
 
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs 
  message: "Too many requests from this IP, please try again later.",
});

app.use(limiter); //Enforce rate limiting

// Firebase Config
const firebaseConfig = {
    apiKey: process.env.APIKEY,
    authDomain: process.env.AUTHDOMAIN,
    projectId: process.env.PROJECTID,
    storageBucket: process.env.STORAGEBUCKET, 
    messagingSenderId: process.env.MESSAGESENDERID,
    appId: process.env.APPID
};

// Initialize Firebase
const appinit = initializeApp(firebaseConfig);

// Initialize Firestore and Auth
const db = getFirestore(appinit);
const auth = getAuth()

// Collection reference for USERS
const colRef = collection(db, "users");

// Collection ref for SUPPORT
const supportRef = collection(db, "support");

// Authentication middleware
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// API Routes
// --------------- ADD USERS ---------------
app.post(
  "/api/users",
  [
    body("surname").isString().notEmpty(),
    body("firstname").isString().notEmpty(),
    body("email").isEmail(),
    body("phone").isString().notEmpty(),
    body("user_id").isString().notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      // console.log("Received request body:", req.body); //for testing
      const { surname, firstname, email, phone, user_id } = req.body;
      if (!surname || !firstname || !email || !phone || !user_id) {
        console.log(req);
        return res.status(400).json({ error: "One of the data is not captured!" });
      }
      const userRef = doc(db, "users", user_id); //Create doc
      const docRef = await setDoc(userRef, { 
        uid: user_id,
        email: email,
        surname: surname,
        firstname: firstname,
        phone: phone,
        org_status: 'false',
        createdAt: new Date(),
       });
      res.status(201).json({ id: userRef.id, surname, firstname, email, phone });
    } catch (error) {
      console.error("Error Adding User:", error);
      res.status(500).json({ error: "Failed to Add User to database", details: error.message });
    }
  }
);


// --------------- SEND MESSAGES ---------------



  // ----------------- ADD COMPAINTS ---------------------
    app.post('/api/support', async (req, res) => {
    const { name, email, complaint } = req.body;
  
    if (!name || !email || !complaint) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
  
    try {
      await addDoc(supportRef, {
        name,
        email,
        complaint,
        createdAt: new Date(),
      });
      res.status(200).json({ message: 'Complaint submitted successfully!' });
    } catch (error) {
      console.error('Error submitting complaint:', error);
      res.status(500).json({ error: 'Failed to submit complaint.' });
    }
  });

  // Start the server
  app.listen(4000, () => console.log("Listening on Port 4000"));
  