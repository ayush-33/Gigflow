import mongoose from 'mongoose';
const { Schema, model, Types: { ObjectId } } = mongoose;

const notificationSchema = new Schema({
  userId: { type: ObjectId, ref: 'User', required: true },
  type:   {
    type: String,
    enum: ['message', 'bid_accepted', 'bid_rejected', 'payment_received', 'offer'],
    required: true,
  },
  title:  { type: String, required: true },
  body:   { type: String, required: true },
  link:   { type: String, default: '/' },
  read:   { type: Boolean, default: false },
  meta:   { type: Schema.Types.Mixed },
}, { timestamps: true });

export default model('Notification', notificationSchema);
