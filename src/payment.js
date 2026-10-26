// Manual centre-admin reconciliation is the active payment integration.
// External providers can implement the same interface without changing booking state.
const {db,audit}=require('./db');
const manualPaymentProvider={
 id:'manual-centre',
 acceptsOnlinePayment:false,
 createCheckout(){throw new Error('Online payment is not enabled. Contact your test centre.');},
 reconcile({bookingId,status,actorId}){
  if(!['pending','paid'].includes(status))throw Error('Invalid payment status');
  const booking=db.prepare("SELECT id,status FROM bookings WHERE id=?").get(bookingId);
  if(!booking||booking.status!=='booked')throw Error('Booking not available');
  if(db.prepare('SELECT id FROM payment_orders WHERE booking_id=?').get(bookingId))throw Error('This booking is managed by sandbox checkout, not manual reconciliation.');
  db.prepare('UPDATE bookings SET payment_status=? WHERE id=?').run(status,bookingId);
  audit(actorId,'payment_status','booking',bookingId,{status,provider:this.id});
 }
};
module.exports={paymentProvider:manualPaymentProvider};
