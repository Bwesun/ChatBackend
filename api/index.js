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


  // --------------- ACTIVATE ORGANIZATION ---------------
app.post("/api/org", async (req, res) => {
  try {
      console.log("Received request body:", req.body); //for testing
      const { instituteName, instituteType, otherType, email, phone, address, status, review_status,  owner_id } = req.body;
      if (!instituteName || !instituteType || !otherType || !email || !phone || !address || !status || !review_status || !owner_id) {
        console.log(req);
        return res.status(400).json({ error: "One of the data is not captured!" });
      }
       
      // Add Organization
      const docRef = await addDoc(orgRef, { 
        instituteName, instituteType, otherType, email, phone, address, owner_id, review_status
      });
      
      // Update User to add Organization activation status and organization id
      const userRef = await doc(db, 'users', owner_id);
      updateDoc(userRef, {
        org_status: status,
        org_id: docRef.id
      });
      
      console.log("Request After sending:", req.body); //for testing
      
      res.status(201).json({ id: docRef.id, instituteName, instituteType, otherType, email, phone, address, owner_id, review_status });
    } catch (error) {
      console.error("Error Activating Organization:", error);
      res.status(500).json({ error: "Failed to Add Organization to database", details: error.message });
    }
  });


  // --------------- ADD FEES ---------------
app.post("/api/fees", async (req, res) => {
  try {
      console.log("Received request body:", req.body); //for testing
      const { title, amount, description, org_id } = req.body;
      if (!title || !amount || !description || !org_id ) {
        console.log(req.body);
        return res.status(400).json({ error: "One of the data is not captured!" });
      }


      // Add Fee
      const docRef = await addDoc(payRef, { 
        title,
        amount,
        description,
        org_id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }); 
       console.log("Request After sending:", req.body); //for testing
      
      res.status(201).json({ id: docRef.id, title, amount, description, org_id });
    } catch (error) {
      console.error("Error Adding Fee :", error);
      res.status(500).json({ error: "Failed to Add Fee", details: error.message });
    }
  });


  // ---------------- ADD TRANSACTION -----------------------
  app.post("/api/transactions", async (req, res) => {
    try {
        // console.log("Received request body:", req.body); //for testing
        const { email, amount, name, user_id, status, reference,  description, to, org_id } = req.body;
        if (!email || !amount || !name || !user_id || !status || !reference  || !to || !org_id) {
          console.log(req);
          return res.status(400).json({ error: "One of the data is not captured!", status });
        }
        //const userRef = doc(db, "users", user_id); //Create doc
        const docRef = await addDoc(transRef, { 
          user_id, email, amount, name, status, createdAt: new Date(), reference, description, to, org_id
         });
        res.status(201).json({ id: docRef.id, user_id, email, amount, name, status, reference, description });
      } catch (error) {
        console.error("Error Storing Transaction:", error);
        res.status(500).json({ error: "Failed to Store Transaction", details: error.message });
      }
    });

  
  // ----------------- GET FEES ---------------------
  app.get('/api/fees', async (req, res) => {
    const { org_id } = req.query;
  
    if (!org_id) {
      return res.status(400).json({ error: 'Organization ID is required.' });
    }
  
    try {
      const q = query(payRef, where('org_id', '==', org_id));
      const snapshot = await getDocs(q);
  
      const fees = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
  
      res.status(200).json(fees);
    } catch (error) {
      console.error('Error fetching fees:', error);
      res.status(500).json({ error: 'Failed to fetch fees.' });
    }
  });


  // ----------------- UPDATE FEE ---------------------
  app.put("/api/fees/:id", async (req, res) => {
    try {
        const feeId = req.params.id; // Extract fee ID from URL
        const docRef = await doc(db, 'payments', feeId);
        updateDoc(docRef, {
          title: req.body.title,
          amount: req.body.amount,
          description: req.body.description,
          updatedAt: new Date(),
        });
        res.status(201).json({ id: docRef.id });
      } catch (error) {
        console.error("Error updating fee:", error);
        res.status(500).json({ error: "Failed to update fee", details: error.message });
      }
  });


  // ----------------- DELETE FEE ---------------------
  app.delete("/api/fees/:id", async (req, res) => {
    try {
      const feeId = req.params.id; // Extract fee ID from URL
        const docRef = await doc(db, 'payments', feeId);
        deleteDoc(docRef);
        res.status(201).json({ id: docRef.id });
      } catch (error) {
        console.error("Error deleting fee:", error);
        res.status(500).json({ error: "Failed to delete fee", details: error.message });
      }
  });



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
  