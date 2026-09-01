import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs } from 'firebase/firestore'
import dotenv from 'dotenv'
dotenv.config()
const cfg={
  apiKey:process.env.VITE_FIREBASE_API_KEY,
  authDomain:process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:process.env.VITE_FIREBASE_APP_ID
}
const app=initializeApp(cfg)
const db=getFirestore(app)
const vendors=await getDocs(collection(db,'vendors'))
console.log('Vendors:',vendors.size)
vendors.forEach(d=>console.log(' ',d.id, JSON.stringify(d.data().items)))
const entries=await getDocs(collection(db,'daily_entries'))
console.log('daily_entries total:',entries.size)
let rTotal=0,kTotal=0,rTea=0,kTea=0
entries.forEach(d=>{
  const e=d.data()
  if(e.vendorId==='morning-ramakrishna'){ rTotal+=e.totalAmount; rTea+=e.items.tea.quantity }
  if(e.vendorId==='evening-kumar'){ kTotal+=e.totalAmount; kTea+=e.items.tea.quantity }
})
console.log('Ramakrishna Aug total: ₹'+rTotal, 'tea:',rTea)
console.log('Kumar Aug total: ₹'+kTotal, 'tea:',kTea)
console.log('Grand: ₹'+(rTotal+kTotal))
process.exit(0)
