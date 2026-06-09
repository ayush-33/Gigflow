import mongoose from 'mongoose';
const { Schema, model, Types: { ObjectId } } = mongoose;

const orderSchema = new Schema({
  gigId:         { type: ObjectId, ref: 'Gig',  required: true },
  bidId:         { type: ObjectId, ref: 'Bid',  required: true },
  clientId:      { type: ObjectId, ref: 'User', required: true },
  freelancerId:  { type: ObjectId, ref: 'User', required: true },
  amount:        { type: Number,   required: true },
  platformFee:   { type: Number,   required: true },
  paymentMethod: { type: String,   enum: ['card','upi','wallet'], required: true },
  status:        { type: String,   enum: ['pending','completed','failed'], default: 'completed' },
  orderRef:      { type: String,   required: true },
}, { timestamps: true });

export default model('Order', orderSchema);
