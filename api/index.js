import express from "express";
import cors from "cors";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, updateDoc, setDoc, query, where, getDoc } from "firebase/firestore";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { body, validationResult } from 'express-validator';

dotenv.config()

// CHECK FOR API KEY AVAILABILITY
// if (!process.env.PAYSTACK_PUBLIC_KEY) {
//   throw new Error("PAYSTACK_API_KEY is not defined in the environment variables.");
// }

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
// --------------- SEND MESSAGE ---------------
app.post("/api/message", async (req, res) => {
  const { id, to_user_id, from_user_id, text, timestamp, status } = req.body;
  if (!id || !to_user_id || !from_user_id || !text || !timestamp || !status) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  try {
    await setDoc(doc(collection(db, "messages"), id), {
      id,
      to_user_id,
      from_user_id,
      text,
      timestamp,
      status,
      unread: true,
      createdAt: new Date(),
    });
    console.log("Message stored successfully:", { id, to_user_id, from_user_id, text, timestamp, status });
    res.status(201).json({ message: "Message stored successfully." });
  } catch (error) {
    console.error("Error storing message:", error);
    res.status(500).json({ error: "Failed to store message." });
  }
});


// GET USERS (all users except current user)
app.get('/api/contacts/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const usersRef = collection(db, 'users');
    // Use the where clause to exclude the current user by uid
    const q = query(usersRef, where('uid', '!=', uid));
    const snapshot = await getDocs(q);
    const contacts = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      contacts.push({
        id: doc.id,
        name: `${data.firstname || ''} ${data.surname || ''}`.trim(),
        email: data.email || '',
        avatar: data.avatar || ''
      });
    });
    res.json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts.' });
  }
});


// GET USER
app.get('/api/user/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const userRef = doc(db, 'users', id);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      res.json({ id: userDoc.id, ...userDoc.data() });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});


// --------------- GET CONTACTS ---------------
app.get('/api/contacts/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('uid', '!=', uid));
    const snapshot = await getDocs(q);
    const contacts = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      contacts.push({
        id: doc.id,
        firstname: data.firstname || '',
        surname: data.surname || '',
        email: data.email || ''
      });
    });
    console.log("Contacts fetched successfully:", contacts);
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contacts.' });
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
