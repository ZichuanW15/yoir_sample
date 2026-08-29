import { AvailabilitySlot, Order, RegisterRequest, Service, Session, StubPaymentConfirmation, User } from './types';

const services: Service[] = [
  {id:'svc_interview',title:'Interview confidence coaching',description:'A focused one-to-one session covering behavioural questions, confident delivery and practical feedback for your next interview.',priceMinor:9500,currency:'AUD',modalities:['online'],active:true,averageRating:4.9,reviewCount:28,counsellor:{id:'counsellor_maya',displayName:'Maya Chen',introduction:'Career counsellor specialising in early-career transitions and interview preparation.',verificationStatus:'verified',overallRating:4.9,reviewCount:46}},
  {id:'svc_resume',title:'Resume and cover letter review',description:'Detailed, actionable feedback to make your application clearer, more relevant and easier for recruiters to scan.',priceMinor:7000,currency:'AUD',modalities:['online','in_person'],location:{state:'VIC',cityOrRegion:'Melbourne'},active:true,averageRating:4.7,reviewCount:19,counsellor:{id:'counsellor_jordan',displayName:'Jordan Lee',introduction:'Recruitment and career-development specialist with experience across technology and consulting.',verificationStatus:'verified',overallRating:4.8,reviewCount:32}},
];
const pause = () => new Promise((resolve) => setTimeout(resolve, 300));
export async function demoLogin(email:string,password:string):Promise<Session>{await pause();if(!email||!password)throw new Error('Enter your email and password.');return{accessToken:'demo-access-token',expiresAt:new Date(Date.now()+3600000).toISOString(),user:{id:'demo-user',name:'Demo Job Seeker',email,role:'job_seeker'}}}
export async function demoRegister(input:RegisterRequest):Promise<User>{await pause();return{id:'demo-new-user',name:input.name,email:input.email,role:input.role}}
export async function demoListServices(query=''):Promise<Service[]>{await pause();const term=query.trim().toLowerCase();return term?services.filter((item)=>`${item.title} ${item.counsellor.displayName}`.toLowerCase().includes(term)):services}
export async function demoGetService(id:string):Promise<Service>{await pause();const service=services.find((item)=>item.id===id);if(!service)throw new Error('Service not found.');return service}

const demoSlots: Record<string, AvailabilitySlot[]> = Object.fromEntries(
  services.map((service, serviceIndex) => [service.id, [0, 1, 3].map((offset, index) => {
    const startsAt = new Date(Date.now() + (offset + 1) * 86_400_000);
    startsAt.setHours([9, 14, 11][index], 0, 0, 0);
    return {id:`demo-slot-${serviceIndex}-${index}`,serviceId:service.id,startsAt:startsAt.toISOString(),endsAt:new Date(startsAt.getTime()+3_600_000).toISOString(),status:'open' as const};
  })]),
);

export async function demoListSlots(serviceId:string):Promise<AvailabilitySlot[]>{await pause();return demoSlots[serviceId]??[]}
export async function demoCreateOrder(serviceId:string,slotId:string):Promise<Order>{await pause();const service=services.find((item)=>item.id===serviceId);if(!service)throw new Error('Service not found.');return{id:`demo-order-${Date.now()}`,serviceId,slotId,amountMinor:service.priceMinor,currency:'AUD',status:'awaiting_payment',paymentStatus:'not_started'}}
export async function demoCompletePayment(order:Order):Promise<StubPaymentConfirmation>{await pause();const service=services.find((item)=>item.id===order.serviceId)!;const slot=Object.values(demoSlots).flat().find((item)=>item.id===order.slotId)!;return{paymentId:`stub-${Date.now()}`,paymentStatus:'paid',booking:{id:`demo-booking-${Date.now()}`,orderId:order.id,serviceId:service.id,serviceTitle:service.title,startsAt:slot.startsAt,endsAt:slot.endsAt,timezone:'Australia/Sydney',modality:service.modalities[0],status:'confirmed',paymentStatus:'paid'}}}
